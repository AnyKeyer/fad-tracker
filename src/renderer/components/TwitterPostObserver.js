// Twitter post observer utility
class TwitterPostObserver {
  constructor(options = {}) {
    this.options = {
      postSelector: 'article, [data-testid="tweet"], [role="article"], div[data-testid^="cellInnerDiv"]', // Расширенный селектор для твитов
      contentSelector: '[data-testid="tweetText"], [lang]', // Расширенный селектор для контента
      pollingInterval: 1000, // Увеличиваем интервал проверки до 1 секунды для стабильности
      refreshInterval: 30000, // Оставляем стандартный интервал обновления 30 секунд
      askContinue: false, // Whether to ask before continuing iterations
      askContinueInterval: 300000, // Ask every 5 minutes by default
      maxTweetsPerCheck: 50, // Максимальное количество обрабатываемых твитов за одну проверку
      ...options
    };
    
    this.knownPostIds = new Set();
    this.lastPostCheckedTime = Date.now();
    this.lastConfirmationTime = Date.now();
    this.callbacks = {
      onNewPost: null,
      onContinueRequested: null
    };
    this.initialized = false;
    this.refreshInterval = null;
    this.waitingForConfirmation = false;
  }
  
  // Start observing the Twitter feed for new posts
  start() {
    // First ensure we've clicked on Latest tab if not initialized
    if (!this.initialized) {
      this.clickLatestTab();
    }
    
    if (this.observerInterval) {
      this.stop();
    }
    
    // Set up periodic checking for new posts
    this.observerInterval = setInterval(() => {
      // Check if we need to ask for confirmation before continuing
      if (this.options.askContinue && 
          Date.now() - this.lastConfirmationTime >= this.options.askContinueInterval &&
          !this.waitingForConfirmation) {
        
        this.waitingForConfirmation = true;
        this.pauseObservation();
        
        // If we have a callback for continue requests, use it
        if (typeof this.callbacks.onContinueRequested === 'function') {
          this.callbacks.onContinueRequested(() => {
            // User confirmed, resume observation
            this.lastConfirmationTime = Date.now();
            this.waitingForConfirmation = false;
            this.resumeObservation();
          }, () => {
            // User declined, stop completely
            this.stop();
          });
        } else {
          // Default built-in confirmation
          if (confirm('Continue to iterate?')) {
            this.lastConfirmationTime = Date.now();
            this.waitingForConfirmation = false;
            this.resumeObservation();
          } else {
            this.stop();
          }
        }
      } else {
        // Regular operation, check for new posts
        this.checkForNewPosts();
      }
    }, this.options.pollingInterval);
    
    // Set up periodic refreshing of the timeline
    this.refreshInterval = setInterval(() => {
      if (!this.waitingForConfirmation) {
        this.refreshTimeline();
      }
    }, this.options.refreshInterval);
    
    console.log("📊 Tweet observer started with auto-refresh every", 
      this.options.refreshInterval / 1000, "seconds");
    
    return this;
  }
  
  // Click on Latest tab to ensure we see the most recent tweets
  async clickLatestTab() {
    try {
      console.log("📊 Attempting to switch to 'Latest' tab...");
      
      // Найти и кликнуть на вкладку "Latest"
      const latestTabSelector = [
        'a[href*="f=live"]', 
        '[role="tab"][data-testid*="latest"]',
        '[role="tab"]:nth-child(2)',
        '[data-testid="ScrollSnap-List"] > div:nth-child(2)',
        'nav > div > div > a:nth-child(2)'
      ].join(', ');
      
      const latestTab = document.querySelector(latestTabSelector);
      
      if (latestTab) {
        console.log("📊 Found 'Latest' tab, clicking with STRICT 17-second delay");
        latestTab.click();
        
        // ВАЖНО: Отложить обработку после клика на СТРОГО 17 секунд
        setTimeout(() => {
          console.log("📊 Tab clicked, initializing after strict 17-second delay");
          this.initialized = true;
          
          // Выполняем проверку сразу после инициализации
          this.scheduleDelayedChecks();
        }, 17000); // СТРОГАЯ задержка 17 секунд для инициализации
      } else {
        console.log("📊 Can't find 'Latest' tab, trying alternative methods");
        // Try to find top tab elements for inspection
        const tabs = document.querySelectorAll('[role="tab"]');
        console.log(`📊 Found ${tabs.length} potential tabs`);
        if (tabs.length >= 2) {
          console.log("📊 Clicking on second tab, which is likely 'Latest'");
          tabs[1].click();
          
          // ВАЖНО: Отложить обработку после клика на СТРОГО 17 секунд
          setTimeout(() => {
            console.log("📊 Tab clicked, initializing after strict 17-second delay");
            this.initialized = true;
            
            // Выполняем проверку сразу после инициализации
            this.scheduleDelayedChecks();
          }, 17000); // СТРОГАЯ задержка 17 секунд для инициализации
        }
      }
    } catch (error) {
      console.error("❌ Error switching to 'Latest' tab:", error);
    }
  }
  
  // Новый, более безопасный метод для запуска проверок со СТРОГИМ интервалом в 17 секунд
  scheduleDelayedChecks() {
    // Очищаем множество известных ID перед проверками
    this.knownPostIds.clear();
    
    console.log("📊 Starting tweet checks with STRICT 17-second intervals");
    
    // Единственная проверка после СТРОГОГО интервала в 17 секунд
    setTimeout(() => {
      console.log("📊 Running tweet check after STRICT 17-second delay");
      this.checkForNewPosts();
      
      // После проверки твитов ждем еще 17 секунд и выполняем прокрутку ленты
      setTimeout(() => {
        console.log("📊 Performing timeline scroll after STRICT 17-second delay");
        this.scrollTimeline();
        
        // После прокрутки ждем еще 17 секунд и выполняем финальную проверку
        setTimeout(() => {
          console.log("📊 Running final tweet check after STRICT 17-second delay");
          this.knownPostIds.clear();
          this.checkForNewPosts();
          
          // Завершающее сообщение
          console.log("📊 Initial tweet scanning complete with STRICT 17-second intervals");
        }, 17000); // СТРОГАЯ задержка 17 секунд перед финальной проверкой
      }, 17000); // СТРОГАЯ задержка 17 секунд перед прокруткой
    }, 17000); // СТРОГАЯ задержка 17 секунд перед первой проверкой
  }
  
  // Новый метод - запланировать несколько последовательных проверок твитов со СТРОГИМ интервалом в 17 секунд
  scheduleMultipleChecks() {
    // Очищаем множество известных ID перед проверками
    this.knownPostIds.clear();
    
    console.log("📊 Starting tweet checks with STRICT 17-second intervals");
    
    // Первая проверка через СТРОГО 17 секунд
    setTimeout(() => {
      console.log("📊 Running initial tweet check after STRICT 17-second delay");
      this.checkForNewPosts();
      
      // Прокрутка ленты через СТРОГО 17 секунд после первой проверки
      setTimeout(() => {
        console.log("📊 Performing timeline scroll after STRICT 17-second delay");
        this.scrollTimeline();
        
        // Вторая проверка через СТРОГО 17 секунд после прокрутки
        setTimeout(() => {
          console.log("📊 Running second tweet check after STRICT 17-second delay");
          this.knownPostIds.clear();
          this.checkForNewPosts();
          
          // Вторая прокрутка через СТРОГО 17 секунд
          setTimeout(() => {
            console.log("📊 Performing second timeline scroll after STRICT 17-second delay");
            this.scrollTimeline();
            
            // Финальная проверка через СТРОГО 17 секунд
            setTimeout(() => {
              console.log("📊 Running final tweet check after STRICT 17-second delay");
              this.knownPostIds.clear();
              this.checkForNewPosts();
              
              // Завершающее сообщение
              console.log("📊 Initial tweet scanning complete with STRICT 17-second intervals");
            }, 17000); // СТРОГАЯ задержка 17 секунд перед финальной проверкой
          }, 17000); // СТРОГАЯ задержка 17 секунд перед второй прокруткой
        }, 17000); // СТРОГАЯ задержка 17 секунд перед второй проверкой
      }, 17000); // СТРОГАЯ задержка 17 секунд перед первой прокруткой
    }, 17000); // СТРОГАЯ задержка 17 секунд перед первой проверкой
  }
  
  // Новый метод для автоматической прокрутки ленты твитов
  scrollTimeline() {
    try {
      console.log("📊 Auto-scrolling the timeline to load more tweets");
      
      // Находим основной контейнер ленты
      const mainColumn = document.querySelector('[data-testid="primaryColumn"]');
      const timelineContainer = mainColumn || document.body;
      
      // Текущая позиция прокрутки
      const startScrollY = window.scrollY;
      
      // Плавная прокрутка на 2000 пикселей вниз
      const scrollDistance = 2000;
      const duration = 1000; // 1 секунда
      const startTime = Date.now();
      
      const scrollStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2; // плавное ускорение и замедление
        
        // Вычисляем новую позицию прокрутки
        const scrollY = startScrollY + scrollDistance * easeProgress;
        
        // Прокручиваем страницу
        window.scrollTo(0, scrollY);
        
        // Продолжаем анимацию, если она не закончена
        if (progress < 1) {
          requestAnimationFrame(scrollStep);
        } else {
          console.log("📊 Timeline scrolled down by", scrollDistance, "pixels");
          
          // После прокрутки ждем немного и проверяем твиты повторно
          setTimeout(() => {
            console.log("📊 Running additional check after scrolling");
            this.knownPostIds.clear();
            this.checkForNewPosts();
          }, 500);
        }
      };
      
      // Запускаем анимацию прокрутки
      requestAnimationFrame(scrollStep);
    } catch (error) {
      console.error("❌ Error auto-scrolling timeline:", error);
    }
  }
  
  // Refresh the timeline to get new tweets
  refreshTimeline() {
    try {
      console.log("📊 Refreshing Twitter timeline (30-second interval)...");
      
      // Method 1: Try to find and click refresh button - наиболее безопасный способ
      const refreshButton = document.querySelector('[data-testid="refresh"]');
      if (refreshButton) {
        console.log("📊 Found refresh button, clicking");
        refreshButton.click();
        
        // После нажатия на кнопку обновления, запланируем одну проверку твитов
        setTimeout(() => {
          console.log("📊 Running tweet check after refresh button click");
          this.knownPostIds.clear(); // Очищаем список известных ID для повторной обработки твитов
          this.checkForNewPosts();
        }, 1500);
        
        return;
      }
      
      // Method 2: Запрос на полную перезагрузку страницы
      console.log("📊 Refresh button not found, requesting full page reload");
      
      // Отправляем событие, которое будет перехвачено в main процессе
      window.postMessage({
        type: 'request-page-reload',
        timestamp: Date.now()
      }, '*');
      
      // Запускаем проверку на случай, если перезагрузка не произойдет
      setTimeout(() => {
        console.log("📊 Running tweet check as fallback");
        this.knownPostIds.clear();
        this.checkForNewPosts();
      }, 5000);
      
      return;
    } catch (error) {
      console.error("❌ Error refreshing feed:", error);
      
      // В случае ошибки, просто прокручиваем ленту как запасной вариант
      console.log("📊 Error occurred, using scroll method instead");
      this.scrollTimeline();
    }
  }
  
  // Stop observing
  stop() {
    if (this.observerInterval) {
      clearInterval(this.observerInterval);
      this.observerInterval = null;
      console.log("📊 Stopped tweet checking interval");
    }
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log("📊 Stopped timeline refresh interval");
    }
    
    return this;
  }
  
  // Register callback for new post events
  onNewPost(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onNewPost = callback;
      console.log("📊 Registered new tweet handler");
    }
    
    return this;
  }
  
  // Register callback for when continuation confirmation is needed
  onContinueRequested(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onContinueRequested = callback;
      console.log("📊 Registered continuation confirmation handler");
    }
    
    return this;
  }
  
  // Pause observation temporarily (without clearing intervals)
  pauseObservation() {
    console.log("📊 Pausing tweet observation until user confirms continuation");
  }
  
  // Resume observation after pause
  resumeObservation() {
    console.log("📊 Resuming tweet observation after user confirmation");
    // Immediately check for new posts to avoid waiting for the next interval
    this.checkForNewPosts();
  }
  
  // Enable the ask-continue feature
  enableContinuePrompt(interval = 300000) {
    this.options.askContinue = true;
    this.options.askContinueInterval = interval;
    console.log(`📊 Enabled continuation prompts every ${interval/60000} minutes`);
    return this;
  }
  
  // Disable the ask-continue feature
  disableContinuePrompt() {
    this.options.askContinue = false;
    console.log("📊 Disabled continuation prompts");
    return this;
  }
  
  // Check for new posts in the Twitter feed
  checkForNewPosts() {
    // При каждой проверке ОЧИЩАЕМ предыдущий список ID твитов
    // Это заставит обрабатывать все твиты заново при каждом обновлении
    this.knownPostIds.clear();
    
    // Найдем все элементы твитов в ленте
    const posts = document.querySelectorAll(this.options.postSelector);
    let processedPostsCount = 0;
    
    if (posts.length > 0) {
      console.log(`📊 Found ${posts.length} tweets in the timeline`);
    } else {
      console.log("📊 No tweets found in timeline");
      return;
    }
    
    // Обработаем все найденные твиты
    const currentBatch = [];
    
    // Сначала соберем информацию обо всех твитах в текущей ленте
    for (let i = 0; i < Math.min(posts.length, this.options.maxTweetsPerCheck); i++) {
      try {
        const post = posts[i];
        
        // Получаем ID и данные твита
        const postId = this.getPostId(post);
        if (!postId) continue;
        
        const content = this.getPostContent(post);
        if (!content) continue; // Пропускаем посты без контента
        
        const timestamp = this.getPostTimestamp(post);
        const author = this.getPostAuthor(post);
        const links = this.getPostLinks(post);
        
        // Добавляем в текущую партию для обработки
        currentBatch.push({
          id: postId,
          text: content,
          timestamp: timestamp,
          author: author,
          links: links
        });
        
        processedPostsCount++;
      } catch (error) {
        console.error("❌ Error extracting tweet data:", error);
      }
    }
    
    // Отправляем все твиты из текущей партии на обработку
    if (currentBatch.length > 0) {
      console.log(`📊 Processing ${currentBatch.length} tweets from timeline`);
      
      // Обрабатываем каждый твит
      currentBatch.forEach(postData => {
        this.processPost(postData);
      });
      
      console.log(`📊 Processed ${currentBatch.length} tweets in this check`);
    }
    
    // Обновляем время последней проверки
    this.lastPostCheckedTime = Date.now();
  }
  
  // Extract post ID from post element
  getPostId(postElement) {
    try {
      // Method 1: Look for Twitter's official tweet ID in the article
      const officialIdContainers = postElement.querySelectorAll('a[href*="/status/"]');
      for (const container of officialIdContainers) {
        const href = container.getAttribute('href');
        const hrefMatch = href.match(/\/status\/(\d+)/);
        if (hrefMatch && hrefMatch[1]) {
          return `tweet_${hrefMatch[1]}`;
        }
      }
      
      // Method 2: Try to find data attribute that might contain a unique ID
      const idAttr = postElement.getAttribute('data-testid') || 
                    postElement.getAttribute('data-tweet-id') ||
                    postElement.getAttribute('aria-labelledby');
      
      if (idAttr) return `attr_${idAttr}`;
      
      // Method 3: Generate ID based on first few words of content and timestamp
      const contentEl = postElement.querySelector(this.options.contentSelector);
      if (contentEl) {
        const contentText = contentEl.textContent.trim().substring(0, 50);
        const words = contentText.split(/\s+/).slice(0, 5).join('_');
        const timestamp = Date.now();
        return `content_${timestamp}_${words}`;
      }
      
      // Method 4: Last resort - use a random ID with timestamp
      return `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    } catch (e) {
      console.error("❌ Error getting post ID:", e);
      return `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
  }
  
  // Extract post content from post element
  getPostContent(postElement) {
    try {
      // Try to find tweet text using the content selector
      const contentEl = postElement.querySelector(this.options.contentSelector);
      
      if (contentEl) {
        // Get the raw content
        const rawContent = contentEl.innerHTML;
        
        // Create a temporary element to extract text while preserving emojis
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = rawContent;
        
        // Ensure we get all the text, including the text from nested elements
        return this.getTextWithEntities(tempDiv).trim();
      }
      
      // Fallback: try alternative selectors if main selector doesn't work
      const alternativeSelectors = [
        '[data-testid="tweet"] div[lang]',
        'div[lang]',
        '[role="article"] div[dir="auto"]',
        '[data-testid="tweetText"]'
      ];
      
      for (const selector of alternativeSelectors) {
        const element = postElement.querySelector(selector);
        if (element) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = element.innerHTML;
          return this.getTextWithEntities(tempDiv).trim();
        }
      }
      
      // Last fallback: just get all the text from the article
      return postElement.textContent.trim();
    } catch (e) {
      console.error("❌ Error getting post content:", e);
      return '';
    }
  }
  
  // Extract text content while maintaining entities like emojis
  getTextWithEntities(element) {
    let text = '';
    
    element.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } 
      else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip hidden elements
        if (window.getComputedStyle(node).display === 'none') return;
        
        // Handle images that represent emojis
        if (node.tagName === 'IMG') {
          const alt = node.getAttribute('alt');
          if (alt) text += alt;
        }
        // Handle spans that might contain emojis
        else if (node.tagName === 'SPAN' && node.getAttribute('aria-label')) {
          text += node.getAttribute('aria-label');
        } 
        // Recursively get text from other elements
        else {
          text += this.getTextWithEntities(node);
        }
      }
    });
    
    return text;
  }
  
  // Extract post timestamp from post element
  getPostTimestamp(postElement) {
    try {
      // Look for timestamp in the time element
      const timeElement = postElement.querySelector('time');
      if (timeElement && timeElement.getAttribute('datetime')) {
        return new Date(timeElement.getAttribute('datetime')).getTime();
      }
      
      // Fallback to current time if no timestamp found
      return Date.now();
    } catch (e) {
      console.error("❌ Error getting post timestamp:", e);
      return Date.now();
    }
  }
  
  // Extract post author from post element
  getPostAuthor(postElement) {
    try {
      // Method 1: Look for the username in the User-Name testid
      const authorElement = postElement.querySelector('[data-testid="User-Name"] a[role="link"]');
      if (authorElement) {
        return authorElement.textContent.trim();
      }
      
      // Method 2: Look for the username near the timestamp
      const timeParent = postElement.querySelector('time')?.closest('div');
      if (timeParent) {
        const authorNearTime = timeParent.querySelector('a[role="link"]');
        if (authorNearTime) {
          return authorNearTime.textContent.trim();
        }
      }
      
      // Method 3: Look for any link that could be a profile
      const profileLinks = postElement.querySelectorAll('a[href^="/"][role="link"]:not([href*="search"]):not([href*="status"])');
      for (const link of profileLinks) {
        const text = link.textContent.trim();
        if (text && text.includes('@')) {
          return text;
        }
      }
      
      return 'Unknown Author';
    } catch (e) {
      console.error("❌ Error getting post author:", e);
      return 'Unknown Author';
    }
  }
  
  // Extract links from a post
  getPostLinks(postElement) {
    try {
      const links = [];
      const anchorElements = postElement.querySelectorAll('a[href]');
      
      anchorElements.forEach(anchor => {
        const href = anchor.getAttribute('href');
        
        // Skip profile and status links
        if (href && !href.match(/^\/[^\/]+\/?$/) && !href.includes('/status/')) {
          // Handle Twitter shortened links (t.co)
          if (href.includes('t.co/') || href.startsWith('http')) {
            links.push(href);
          }
          // Handle relative URLs
          else if (href.startsWith('/')) {
            links.push(`https://twitter.com${href}`);
          }
        }
      });
      
      return links;
    } catch (e) {
      console.error("❌ Error getting post links:", e);
      return [];
    }
  }
  
  // Process a new post
  processPost(postData) {
    // Send data to the main process
    this.sendPostToMain(postData);
    
    // Call registered callback
    if (this.callbacks.onNewPost) {
      this.callbacks.onNewPost(postData);
    }
  }
  
  // Send post data to the main process via IPC
  sendPostToMain(postData) {
    try {
      if (!postData || !postData.id || !postData.text) {
        console.error("❌ Invalid tweet data:", postData);
        return;
      }
      
      // Ensure text is properly encoded
      const sanitizedPostData = {
        ...postData,
        text: this.sanitizeText(postData.text || ''),
        author: this.sanitizeText(postData.author || 'Unknown Author')
      };
      
      // Добавляем визуальную индикацию обнаружения твита (для отладки)
      this.showTweetDetectionIndicator(sanitizedPostData);
      
      // ПЕРВЫЙ МЕТОД: Используем window.postMessage для передачи через preload скрипт
      console.log(`📊 Sending tweet to main process via postMessage: ${sanitizedPostData.author}`);
      window.postMessage({
        type: 'post-detected',
        postData: sanitizedPostData
      }, '*');
      
      // ВТОРОЙ МЕТОД: Попробуем использовать прямой API, если он доступен
      try {
        if (window.electronAPI && typeof window.electronAPI.sendTweet === 'function') {
          console.log(`📊 Sending tweet via direct electronAPI: ${sanitizedPostData.author}`);
          window.electronAPI.sendTweet(sanitizedPostData);
        }
      } catch (apiError) {
        console.warn("ℹ️ Direct electronAPI not available:", apiError);
      }
      
      // ТРЕТИЙ МЕТОД: Сохраняем в глобальную переменную для отладки и резервного извлечения
      window.lastDetectedTweet = sanitizedPostData;
      window.allDetectedTweets = window.allDetectedTweets || [];
      window.allDetectedTweets.push({
        ...sanitizedPostData,
        detectedAt: Date.now()
      });
      
      // Ограничиваем размер истории твитов
      if (window.allDetectedTweets.length > 100) {
        window.allDetectedTweets = window.allDetectedTweets.slice(-100);
      }
      
      return true;
    } catch (error) {
      console.error("❌ Error sending post data to main process:", error);
      return false;
    }
  }
  
  // Визуальная индикация обнаружения твита (для отладки)
  showTweetDetectionIndicator(tweetData) {
    try {
      // Создаем индикатор
      const indicator = document.createElement('div');
      
      // Стилизуем индикатор
      Object.assign(indicator.style, {
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: 'rgba(29, 161, 242, 0.9)', // Twitter blue
        color: 'white',
        padding: '10px 15px',
        borderRadius: '50px',
        zIndex: '9999',
        fontWeight: 'bold',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        fontSize: '14px',
        maxWidth: '300px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        transition: 'opacity 0.5s, transform 0.3s',
        transform: 'translateY(20px)',
        opacity: '0'
      });
      
      // Добавляем текст
      indicator.textContent = `📝 Твит от ${tweetData.author}: ${tweetData.text.substring(0, 30)}...`;
      
      // Добавляем в DOM
      document.body.appendChild(indicator);
      
      // Анимируем появление
      setTimeout(() => {
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateY(0)';
      }, 10);
      
      // Удаляем через некоторое время
      setTimeout(() => {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 500);
      }, 3000);
    } catch (err) {
      console.error("❌ Error showing tweet indicator:", err);
    }
  }
  
  // Sanitize text to ensure proper encoding
  sanitizeText(text) {
    if (!text) return '';
    try {
      // Convert text to a normalized form that properly handles all Unicode characters
      const normalizedText = text.normalize('NFC');
      
      // Enhanced sanitization to handle all special characters and emojis
      return normalizedText
        // Remove control characters but preserve newlines
        .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        // Remove Unicode replacement character
        .replace(/\uFFFD/g, '')
        // Remove zero-width and other invisible unicode characters
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
        // Comprehensive HTML entity handling
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        // Handle decimal HTML entities
        .replace(/&#(\d+);/g, (match, dec) => {
          try {
            return String.fromCodePoint(dec);
          } catch {
            return match;
          }
        })
        // Handle hex HTML entities
        .replace(/&#x([0-9A-Fa-f]+);/gi, (match, hex) => {
          try {
            return String.fromCodePoint(parseInt(hex, 16));
          } catch {
            return match;
          }
        })
        // Preserve newlines but normalize other whitespace
        .replace(/[\t\f\v ]+/g, ' ')
        // Explicitly handle emojis with surrogate pairs
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, match => {
          // Keep emoji as is, just ensure it's properly handled
          return match;
        })
        .trim();
    } catch (e) {
      console.error("❌ Error sanitizing text:", e);
      // Fallback approach
      try {
        // Use TextEncoder/TextDecoder for robust UTF-8 handling
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', {fatal: false});
        
        // First encode to UTF-8 bytes, then decode to ensure proper handling
        const bytes = encoder.encode(text);
        const decodedText = decoder.decode(bytes);
        
        // Additional emoji handling for surrogate pairs
        return decodedText
          .normalize('NFC')
          .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F\uFFFD]/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .trim();
      } catch (fallbackError) {
        console.error("❌ Fallback text sanitization failed:", fallbackError);
        // Enhanced last resort fallback for problematic text
        try {
          // Try a different approach using JSON stringify/parse which handles some Unicode edge cases
          const jsonSafe = JSON.stringify(text);
          const parsed = JSON.parse(jsonSafe);
          return parsed.replace(/[\x00-\x1F\x7F]/g, '').trim();
        } catch {
          // Absolute last resort: just return with basic cleaning
          return text.replace(/[\x00-\x1F\x7F]/g, '').trim();
        }
      }
    }
  }
  
  // Clean up old post IDs to prevent memory leaks
  cleanupOldPosts() {
    // If we've accumulated too many known posts, remove the oldest ones
    const MAX_KNOWN_POSTS = 1000;
    if (this.knownPostIds.size > MAX_KNOWN_POSTS) {
      const postsToRemove = this.knownPostIds.size - MAX_KNOWN_POSTS;
      const idsArray = Array.from(this.knownPostIds);
      for (let i = 0; i < postsToRemove; i++) {
        this.knownPostIds.delete(idsArray[i]);
      }
      console.log(`📊 Cleaned up ${postsToRemove} old tweet IDs from memory`);
    }
  }
}

// Export the TwitterPostObserver class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TwitterPostObserver };
}