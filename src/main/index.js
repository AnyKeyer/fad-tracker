const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const puppeteer = require('puppeteer');
const log = require('./logger'); // Import our logger

// Initialize store for saving settings
const store = new Store();

// Keep a global reference of the window objects
let mainWindow = null;
let monitoringWindow = null;
let browser = null;
let page = null;

// Initialize puppeteer browser
async function initBrowser() {
  try {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--window-size=1200,800'
      ]
    });
    return browser;
  } catch (error) {
    log.error('Failed to launch browser:', error);
    throw error;
  }
}

// Close puppeteer browser
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

// Create the main application window
async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the main HTML file
  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools only in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  // Add error handlers to see errors in console
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    log.error(`Load Error: ${errorDescription} (${errorCode}) for URL: ${validatedURL}`);
  });
  
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['log', 'warning', 'error', 'info', 'debug'];
    const levelName = levels[level] || 'log';
    log.info(`[Renderer][${levelName}] ${message}`);
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    
    // Close monitoring window if main window is closed
    if (monitoringWindow) {
      monitoringWindow.close();
      monitoringWindow = null;
    }
  });
}

// Create the monitoring window
async function createMonitoringWindow() {
  monitoringWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Enable webview tag
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the monitoring HTML file
  await monitoringWindow.loadFile(path.join(__dirname, '../renderer/monitoring.html'));

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    monitoringWindow.webContents.openDevTools();
  }
  
  monitoringWindow.on('closed', () => {
    monitoringWindow = null;
  });
}

// App ready event
app.whenReady().then(createMainWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle Twitter login
ipcMain.handle('twitter-login', async (event) => {
  try {
    if (!browser) {
      browser = await initBrowser();
    }
    
    page = await browser.newPage();
    await page.goto('https://twitter.com/login', { waitUntil: 'networkidle2' });
    
    // Wait for login to complete - detect either home timeline or navigation to Twitter home
    await Promise.race([
      page.waitForNavigation({ timeout: 120000 }), // 2 minutes timeout for manual login
      page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 120000 })
    ]);
    
    // Extract user information
    const userInfo = await extractTwitterUserInfo(page);
    
    // Save cookies and user information after successful login
    const cookies = await page.cookies();
    store.set('twitterCookies', cookies);
    store.set('twitterLoggedIn', true);
    store.set('twitterUserInfo', userInfo);
    
    // Close the entire browser after successful login
    await closeBrowser();
    
    return { success: true, userInfo };
  } catch (error) {
    log.error('Error during Twitter login:', error);
    
    // Make sure to close the browser if there was an error
    await closeBrowser();
    
    return { success: false, error: error.message };
  }
});

// Handle Twitter logout
ipcMain.handle('twitter-logout', async (event) => {
  try {
    // Clear stored Twitter session data
    store.delete('twitterCookies');
    store.delete('twitterLoggedIn');
    store.delete('twitterUserInfo');
    
    // Close any active browser
    await closeBrowser();
    
    return { success: true };
  } catch (error) {
    log.error('Error during Twitter logout:', error);
    return { success: false, error: error.message };
  }
});

// Get Twitter user profile information
async function extractTwitterUserInfo(page) {
  try {
    // Get username and avatar from the Twitter page
    const userInfo = await page.evaluate(() => {
      // Try multiple selectors for getting the user information
      
      // Method 1: Try to find the profile link in the sidebar
      const profileLink = document.querySelector('a[href*="/home"] + a[role="link"], [data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = profileLink.getAttribute('href');
        const username = href ? href.substring(1) : null; // Remove the leading slash
        
        // Find avatar image
        const avatar = profileLink.querySelector('img') || document.querySelector('nav img[src*="profile_images"]');
        const avatarSrc = avatar ? avatar.src : '';
        
        return { username, avatarSrc };
      }
      
      // Method 2: Try to find the account menu
      const accountMenu = document.querySelector('[data-testid="accountSwitcher"], [aria-label*="account"]');
      if (accountMenu) {
        const usernameElement = accountMenu.querySelector('span[dir="ltr"], div[dir="ltr"]');
        const username = usernameElement ? usernameElement.textContent.trim() : null;
        
        // Find avatar image
        const avatar = accountMenu.querySelector('img');
        const avatarSrc = avatar ? avatar.src : '';
        
        return { username, avatarSrc };
      }
      
      // Method 3: Look for any profile images and associated text
      const profileImages = Array.from(document.querySelectorAll('img[src*="profile_images"]'));
      for (const img of profileImages) {
        const parent = img.closest('[role="button"]');
        if (parent) {
          const usernameElement = parent.querySelector('span, div');
          const username = usernameElement ? usernameElement.textContent.trim() : null;
          if (username && username.startsWith('@')) {
            return { username, avatarSrc: img.src };
          }
        }
      }
      
      return { username: null, avatarSrc: '' };
    });
    
    // Make sure we prefix with @ for display purposes
    if (userInfo.username) {
      // If username doesn't start with @, add it
      userInfo.username = userInfo.username.startsWith('@') ? 
        userInfo.username : `@${userInfo.username}`;
    } else {
      // Set a default username for debugging
      userInfo.username = '@user';
      
      // As a last resort, try to find the username in the URL
      const url = page.url();
      const match = url.match(/twitter\.com\/([a-zA-Z0-9_]+)/);
      if (match && match[1] && match[1] !== 'home' && match[1] !== 'login') {
        userInfo.username = `@${match[1]}`;
      }
    }
    
    log.info("Extracted Twitter user info:", userInfo);
    return userInfo;
  } catch (error) {
    log.error('Error extracting Twitter user info:', error);
    return { username: '@user', avatarSrc: '' };
  }
}

// Get user information
ipcMain.handle('get-twitter-user-info', async (event) => {
  const userInfo = store.get('twitterUserInfo', { username: '@user', avatarSrc: '' });
  return userInfo;
});

// Check if user is already logged in to Twitter
ipcMain.handle('check-twitter-login-status', async (event) => {
  const isLoggedIn = store.get('twitterLoggedIn', false);
  const userInfo = store.get('twitterUserInfo', { username: '@user', avatarSrc: '' });
  
  return { 
    loggedIn: isLoggedIn,
    userInfo
  };
});

// Get Twitter cookies
ipcMain.handle('get-twitter-cookies', async (event) => {
  const cookies = store.get('twitterCookies', []);
  return cookies;
});

// IPC handlers for renderer process communication
ipcMain.handle('start-analysis', async (event, { keywords, excludedTerms }) => {
  try {
    // Check if user is logged in
    const isLoggedIn = store.get('twitterLoggedIn', false);
    if (!isLoggedIn) {
      return { success: false, error: 'You must login to Twitter first' };
    }
    
    // Create monitoring window
    await createMonitoringWindow();
    
    // Store keywords and excluded terms
    store.set('keywords', keywords);
    store.set('excludedTerms', excludedTerms);
    
    // Format keywords for Twitter search
    const searchQuery = keywords.join(' OR ');
    
    // Launch a separate Puppeteer browser window for Twitter
    if (!browser) {
      browser = await initBrowser();
    }
    
    // Open Twitter and perform search
    page = await browser.newPage();
    
    // Use saved cookies for authentication
    const twitterCookies = store.get('twitterCookies');
    if (twitterCookies) {
      await page.setCookie(...twitterCookies);
    }
    
    // Navigate to Twitter search
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(searchQuery)}&f=live`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    
    // Wait a moment to allow the page to fully load
    await page.waitForTimeout(2000);
    
    // Click on Latest tab if needed
    try {
      // Try various selectors to find and click the Latest tab
      const latestTabSelectors = [
        'a[href*="f=live"]', 
        '[role="tab"][data-testid*="latest"]',
        '[role="tab"]:nth-child(2)',
        '[data-testid="ScrollSnap-List"] > div:nth-child(2)',
        'nav > div > div > a:nth-child(2)'
      ];
      
      for (const selector of latestTabSelectors) {
        const latestTabExists = await page.$(selector);
        if (latestTabExists) {
          await page.click(selector);
          log.info(`Clicked Latest tab using selector: ${selector}`);
          break;
        }
      }
    } catch (err) {
      log.error("Error clicking Latest tab:", err);
    }
    
    // Set up tweet monitoring in the Puppeteer page
    await setupTweetMonitoring(page);
    
    // Send search info to monitoring window
    if (monitoringWindow) {
      monitoringWindow.webContents.send('search-info', { 
        keywords, 
        excludedTerms
      });
    }
    
    return { success: true };
  } catch (error) {
    log.error('Error starting analysis:', error);
    await closeBrowser();
    return { success: false, error: error.message };
  }
});

// Stop analysis
ipcMain.handle('stop-analysis', async () => {
  try {
    log.info("\n🛑 ===============================================");
    log.info("🛑 STOPPING TWEET MONITORING");
    log.info("🛑 ===============================================\n");
    
    // Close monitoring window if open
    if (monitoringWindow) {
      monitoringWindow.close();
      monitoringWindow = null;
    }
    
    // Close browser instance if open
    if (browser) {
      log.info("🔒 Closing browser instance...");
      try {
        // First try to close individual pages
        if (page) {
          log.info("🔒 Closing Twitter page...");
          await page.close().catch(e => log.error("Error closing page:", e));
          page = null;
        }
        
        // Then close the entire browser
        await browser.close().catch(e => log.error("Error closing browser:", e));
        browser = null;
        log.info("✅ Browser successfully closed");
      } catch (err) {
        log.error("❌ Error while closing browser:", err);
        // Force browser to null even if there was an error
        browser = null;
        page = null;
      }
    } else {
      log.info("ℹ️ Browser already closed");
    }
    
    log.info("✅ Tweet monitoring stopped");
    return { success: true };
  } catch (error) {
    log.error("❌ Error stopping analysis:", error);
    
    // Force variables to null to prevent hanging references
    monitoringWindow = null;
    browser = null;
    page = null;
    
    return { success: false, error: error.message };
  }
});

// Listen for post monitoring events from the renderer process
ipcMain.on('post-detected', (event, postData) => {
  try {
    log.info(`Post detected event received in main process: ${postData.id}`);
    log.info(`Tweet from: ${postData.author}, text: ${postData.text ? postData.text.substring(0, 30) + "..." : "No text"}`);
    
    // Проверяем формат полученных данных
    if (!postData || !postData.id) {
      log.error("Invalid post data received:", postData);
      return;
    }
    
    // Нормализуем данные, чтобы гарантировать их корректность
    const normalizedData = {
      id: postData.id,
      text: postData.text || "No content available",
      timestamp: postData.timestamp || Date.now(),
      author: postData.author || "Unknown Author"
    };
    
    // Forward post data to monitoring window
    if (monitoringWindow) {
      log.info(`Forwarding tweet to monitoring window: ${normalizedData.id}`);
      monitoringWindow.webContents.send('post-data', normalizedData);
    } else {
      log.error("Monitoring window not available, can't forward tweet data");
    }
  } catch (error) {
    log.error("Error processing post-detected event:", error);
  }
});

// Setup tweet monitoring in Puppeteer window
async function setupTweetMonitoring(page) {
  try {
    log.info("STARTING TWEET MONITORING SETUP");
    
    // Capture console logs from Puppeteer page
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      
      switch (type) {
        case 'error':
          log.error(`Browser: ${text}`);
          break;
        case 'warning':
          log.warn(`Browser: ${text}`);
          break;
        default:
          log.info(`Browser: ${text}`);
      }
    });
    
    // Track the last page refresh time
    let lastRefreshTime = Date.now();
    let refreshIntervalId = null;

    // Instead of injecting a script element (which is blocked by CSP),
    // we'll evaluate the code directly using page.evaluate
    async function injectObserver() {
      log.info("Injecting TwitterPostObserver function through direct evaluation");
      
      // Create the observer directly via evaluate - this bypasses CSP restrictions
      // on inline scripts because it's executed through the DevTools protocol
      const result = await page.evaluate(() => {
        try {
          // Clean up any previous instances
          if (window.twitterObserver) {
            try {
              window.twitterObserver.stop();
            } catch (e) {
              console.error("Error stopping previous observer:", e);
            }
            window.twitterObserver = null;
          }

          // Define the TwitterPostObserver class in the page context
          window.TwitterPostObserver = class {
            constructor(options = {}) {
              this.options = {
                postSelector: 'article',
                contentSelector: '[data-testid="tweetText"]',
                pollingInterval: 1000,
                refreshInterval: 30000,
                ...options
              };
              
              this.knownPostIds = new Set();
              this.callbacks = {
                onNewPost: null
              };
              this.initialized = false;
              this.observerInterval = null;
              this.refreshInterval = null;
              
              console.log("TwitterPostObserver created with settings:", JSON.stringify(this.options));
            }
            
            start() {
              if (!this.initialized) {
                this.clickLatestTab();
              }
              
              if (this.observerInterval) {
                this.stop();
              }
              
              this.observerInterval = setInterval(() => {
                this.checkForNewPosts();
              }, this.options.pollingInterval);
              
              this.refreshInterval = setInterval(() => {
                this.refreshTimeline();
              }, this.options.refreshInterval);
              
              console.log("Observer started with auto-refresh every", 
                this.options.refreshInterval / 1000, "seconds");
              
              return this;
            }
            
            clickLatestTab() {
              try {
                console.log("Attempting to switch to 'Latest' tab...");
                
                const latestTabSelector = [
                  'a[href*="f=live"]', 
                  '[role="tab"][data-testid*="latest"]',
                  '[role="tab"]:nth-child(2)',
                  '[data-testid="ScrollSnap-List"] > div:nth-child(2)',
                  'nav > div > div > a:nth-child(2)'
                ].join(', ');
                
                const latestTab = document.querySelector(latestTabSelector);
                
                if (latestTab) {
                  console.log("Found 'Latest' tab, clicking");
                  latestTab.click();
                  this.initialized = true;
                } else {
                  console.log("Can't find 'Latest' tab, trying alternative methods");
                  const tabs = document.querySelectorAll('[role="tab"]');
                  console.log(`Found ${tabs.length} potential tabs`);
                  if (tabs.length >= 2) {
                    console.log("Clicking on second tab, which is likely 'Latest'");
                    tabs[1].click();
                    this.initialized = true;
                  }
                }
              } catch (error) {
                console.error("Error switching to 'Latest' tab:", error);
              }
            }
            
            refreshTimeline() {
              try {
                console.log("Refreshing Twitter timeline...");
                
                const refreshButton = document.querySelector('[data-testid="refresh"]');
                if (refreshButton) {
                  console.log("Found refresh button, clicking");
                  refreshButton.click();
                  return;
                }
                
                console.log("Refresh button not found, switching between tabs");
                
                const tabs = document.querySelectorAll('[role="tab"]');
                if (tabs.length >= 2) {
                  console.log("Clicking first tab ('For you')");
                  tabs[0].click();
                  
                  setTimeout(() => {
                    console.log("Returning to 'Latest' tab");
                    tabs[1].click();
                  }, 1000);
                }
              } catch (error) {
                console.error("Error refreshing timeline:", error);
              }
            }
            
            stop() {
              if (this.observerInterval) {
                clearInterval(this.observerInterval);
                this.observerInterval = null;
                console.log("Stopped tweet checking interval");
              }
              
              if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
                console.log("Stopped timeline refresh interval");
              }
              
              return this;
            }
            
            onNewPost(callback) {
              if (typeof callback === 'function') {
                this.callbacks.onNewPost = callback;
                console.log("Registered new tweet handler");
              }
              
              return this;
            }
            
            checkForNewPosts() {
              const posts = document.querySelectorAll(this.options.postSelector);
              
              if (posts.length > 0) {
                console.log(`Found ${posts.length} tweets in feed`);
              } else {
                console.log("No tweets found, check selector: " + this.options.postSelector);
              }
              
              let newPostsCount = 0;
              
              posts.forEach(post => {
                const postId = this.getPostId(post);
                
                if (!postId || this.knownPostIds.has(postId)) {
                  return;
                }
                
                this.knownPostIds.add(postId);
                newPostsCount++;
                
                const content = this.getPostContent(post);
                const timestamp = this.getPostTimestamp(post);
                const author = this.getPostAuthor(post);
                
                console.log(`NEW TWEET: ${postId.substring(0, 10)}... - ${content.substring(0, 30)}...`);
                
                this.processPost({
                  id: postId,
                  text: content,
                  timestamp: timestamp,
                  author: author
                });
              });
              
              if (newPostsCount > 0) {
                console.log(`Detected ${newPostsCount} new tweets!`);
              }
              
              if (Math.random() < 0.1) {
                this.cleanupOldPosts();
              }
            }
            
            getPostId(postElement) {
              try {
                // Method 1: Look for Twitter's official tweet ID in the article
                const officialIdContainer = postElement.querySelector('a[href*="/status/"]');
                if (officialIdContainer) {
                  const hrefMatch = officialIdContainer.getAttribute('href').match(/\/status\/(\d+)/);
                  if (hrefMatch && hrefMatch[1]) {
                    return `tweet_${hrefMatch[1]}`;
                  }
                }
                
                // Method 2: Try to find data attribute that might contain a unique ID
                const idAttr = postElement.getAttribute('data-testid') || 
                              postElement.getAttribute('data-tweet-id') ||
                              postElement.getAttribute('aria-labelledby');
                
                if (idAttr) return `attr_${idAttr}`;
                
                // Method 3: Create a hash from content and timestamp
                const timeElement = postElement.querySelector('time');
                const timeStamp = timeElement ? timeElement.getAttribute('datetime') : '';
                
                // Get the text content and create a short hash from combination of timestamp and content
                const contentEl = postElement.querySelector(this.options.contentSelector);
                const contentText = contentEl ? contentEl.textContent.trim().substring(0, 40) : '';
                const textHash = contentText.replace(/\s+/g, '_').substring(0, 20);
                
                // If we have a timestamp and content, create a combined ID
                if (timeStamp && contentText) {
                  return `tweet_${timeStamp}_${textHash}`;
                }
                
                // Fallback to simple timestamp-based ID
                const randomId = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
                return `post_${randomId}`;
              } catch (e) {
                console.error("Error getting post ID:", e);
                return `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              }
            }
            
            getPostContent(postElement) {
              try {
                // Метод 1: Проверяем основной селектор для контента твита
                const contentEl = postElement.querySelector(this.options.contentSelector);
                
                if (contentEl) {
                  return contentEl.textContent.trim();
                }
                
                // Метод 2: Пытаемся найти текст твита через дополнительные селекторы
                const alternativeSelectors = [
                  '[data-testid="tweetText"]',
                  '[lang]',
                  'div[dir="auto"]',
                  '[role="article"] div[lang]'
                ];
                
                for (const selector of alternativeSelectors) {
                  const element = postElement.querySelector(selector);
                  if (element && element.textContent.trim()) {
                    return element.textContent.trim();
                  }
                }
                
                // Метод 3: Извлекаем весь текстовый контент элемента, исключая некоторые части
                // Выбираем только основной текстовый контент, исключая метаданные
                const text = Array.from(postElement.querySelectorAll('div'))
                  .filter(div => div.textContent.trim().length > 15 && 
                                !div.querySelector('time') && 
                                !div.querySelector('a[href*="/status/"]'))
                  .map(div => div.textContent.trim())
                  .sort((a, b) => b.length - a.length)[0];
                
                if (text) {
                  return text;
                }
                
                // Последний вариант: берем весь текст элемента
                return postElement.textContent.trim();
              } catch (e) {
                console.error("Error getting tweet text:", e);
                return 'Tweet with no text';
              }
            }
            
            getPostAuthor(postElement) {
              try {
                // Try to find the username through various selectors
                const authorElement = postElement.querySelector('[data-testid="User-Name"] a[role="link"]');
                if (authorElement) {
                  return authorElement.textContent.trim();
                }
                
                // Fallback selectors
                const timeParent = postElement.querySelector('time')?.closest('div');
                if (timeParent) {
                  const authorNearTime = timeParent.querySelector('a[role="link"]');
                  if (authorNearTime) {
                    return authorNearTime.textContent.trim();
                  }
                }
                
                return 'Unknown Author';
              } catch (e) {
                console.error("Error getting tweet author:", e);
                return 'Unknown Author';
              }
            }
            
            getPostTimestamp(postElement) {
              try {
                const timeElement = postElement.querySelector('time');
                if (timeElement && timeElement.getAttribute('datetime')) {
                  return new Date(timeElement.getAttribute('datetime')).getTime();
                }
                
                return Date.now();
              } catch (e) {
                console.error("Error getting tweet timestamp:", e);
                return Date.now();
              }
            }
            
            processPost(postData) {
              if (this.callbacks.onNewPost) {
                this.callbacks.onNewPost(postData);
              }
            }
            
            cleanupOldPosts(maxPosts = 1000) {
              if (this.knownPostIds.size > maxPosts) {
                const oldSize = this.knownPostIds.size;
                const postIdsArray = Array.from(this.knownPostIds);
                const newPostIds = postIdsArray.slice(postIdsArray.length - maxPosts);
                this.knownPostIds = new Set(newPostIds);
                console.log(`Cleaned tweet ID cache: ${oldSize} -> ${this.knownPostIds.size}`);
              }
            }
          };
          
          // Define the sendPostToMain function
          window.sendPostToMain = function(postData) {
            try {
              console.log(`Sending tweet to main process: ${postData.text ? postData.text.substring(0, 30) + "..." : "No text"}`);
              console.log(`Tweet ID: ${postData.id}, Author: ${postData.author}`);
              
              // Make sure we have all required data before sending
              const safePostData = {
                id: postData.id || `fallback_id_${Date.now()}`,
                text: postData.text || "No content available",
                timestamp: postData.timestamp || Date.now(),
                author: postData.author || "Unknown Author"
              };
              
              // ПРОБУЕМ ПРЯМОЙ ВЫЗОВ ГЛОБАЛЬНОЙ ФУНКЦИИ
              // Это добавит дополнительный способ передачи данных
              try {
                console.log("Attempting to use window.electronAPI.sendTweet directly");
                if (typeof window.electronAPI !== 'undefined' && typeof window.electronAPI.sendTweet === 'function') {
                  window.electronAPI.sendTweet(safePostData);
                  console.log("Successfully called window.electronAPI.sendTweet");
                } else {
                  console.log("window.electronAPI.sendTweet not available, using window.postMessage");
                }
              } catch (apiErr) {
                console.error("Error using direct electronAPI:", apiErr);
              }
              
              // ОСНОВНОЙ СПОСОБ - ЧЕРЕЗ WINDOW.POSTMESSAGE
              console.log("Using window.postMessage to send tweet data");
              window.postMessage({
                type: 'post-detected',
                postData: safePostData
              }, '*');
              
              // УСТАНАВЛИВАЕМ ГЛОБАЛЬНУЮ ПЕРЕМЕННУЮ С ПОСЛЕДНИМ ТВИТОМ
              // Это поможет диагностировать проблему
              window.lastDetectedTweet = safePostData;
              
              // Визуальная обратная связь
              const indicator = document.createElement('div');
              indicator.style.position = 'fixed';
              indicator.style.bottom = '10px';
              indicator.style.right = '10px';
              indicator.style.backgroundColor = 'green';
              indicator.style.color = 'white';
              indicator.style.padding = '5px 10px';
              indicator.style.borderRadius = '5px';
              indicator.style.zIndex = '9999';
              indicator.style.opacity = '0.8';
              indicator.style.fontWeight = 'bold';
              indicator.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
              indicator.textContent = `Tweet detected: ${safePostData.author}`;
              document.body.appendChild(indicator);
              
              setTimeout(() => {
                indicator.style.transition = 'opacity 1s';
                indicator.style.opacity = '0';
                setTimeout(() => indicator.remove(), 1000);
              }, 2000);
              
              return true;
            } catch (error) {
              console.error("Error in sendPostToMain:", error);
              return false;
            }
          };
          
          console.log("TwitterPostObserver class defined directly in page context");
          return true;
        } catch (error) {
          console.error("Error creating TwitterPostObserver:", error);
          return false;
        }
      });

      if (!result) {
        log.error("Failed to inject TwitterPostObserver through direct evaluation");
        return false;
      }

      log.info("TwitterPostObserver successfully injected through direct evaluation");
      return true;
    }

    // Initialize the observer instance
    async function initializeObserver() {
      const result = await page.evaluate(() => {
        try {
          // Check if TwitterPostObserver is available
          if (typeof window.TwitterPostObserver !== 'function') {
            console.error("TwitterPostObserver class not found in window scope!");
            return false;
          }
          
          // Create a new instance
          window.twitterObserver = new window.TwitterPostObserver({
            postSelector: 'article, [data-testid="tweet"], [role="article"], div[data-testid^="cellInnerDiv"]',
            contentSelector: '[data-testid="tweetText"], [lang]',
            pollingInterval: 300,
            refreshInterval: 30000
          });
          
          // Register the callback
          window.twitterObserver.onNewPost((postData) => {
            console.log("Found new tweet, sending to main process");
            window.sendPostToMain(postData);
          });
          
          // Start the observer
          window.twitterObserver.start();
          
          console.log("TwitterPostObserver initialized and running");
          return true;
        } catch (error) {
          console.error("Error initializing TwitterPostObserver:", error);
          return false;
        }
      });

      if (!result) {
        log.error("Failed to initialize TwitterPostObserver");
        return false;
      }

      log.info("TwitterPostObserver successfully initialized");
      return true;
    }

    // Expose a function to receive post data from the page
    await page.exposeFunction('sendPostToMain', (postData) => {
      log.info("NEW TWEET RECEIVED: " + (postData.text ? postData.text.substring(0, 50) + "..." : "No text"));
      
      // Убедимся, что данные имеют правильный формат
      const sanitizedPostData = {
        id: postData.id || `tweet_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,
        text: postData.text || 'No content',
        timestamp: postData.timestamp || Date.now(),
        author: postData.author || 'Unknown Author'
      };
      
      // Forward the post to the renderer process
      if (monitoringWindow) {
        log.info(`Forwarding tweet to monitoring window: ${sanitizedPostData.id}`);
        monitoringWindow.webContents.send('post-data', sanitizedPostData);
      } else {
        log.error("Monitoring window not available, can't forward tweet data");
      }
    });

    // Initial injection and initialization
    await injectObserver();
    await initializeObserver();
    
    // Set up function to refresh page every second
    const refreshPage = async () => {
      try {
        // Current time
        const now = new Date();
        const timeStr = now.toTimeString().substring(0, 8);
        log.info(`Refreshing Twitter page [${timeStr}]`);
        
        // Check if the TwitterPostObserver is still there
        const observerExists = await page.evaluate(() => {
          return typeof window.TwitterPostObserver === 'function' && 
                 typeof window.twitterObserver !== 'undefined';
        });
        
        if (!observerExists) {
          log.error("TwitterPostObserver lost from page context - reinjecting");
          await injectObserver();
          await initializeObserver();
        }
        
        // ПРОБУЕМ ПОЛУЧИТЬ ТВИТЫ НАПРЯМУЮ ИЗ СТРАНИЦЫ
        try {
          const lastTweet = await page.evaluate(() => {
            return window.lastDetectedTweet;
          });
          
          if (lastTweet && lastTweet.id) {
            log.info(`Direct tweet access - Last tweet ID: ${lastTweet.id}`);
            log.info(`Direct tweet access - Author: ${lastTweet.author}, Text: ${lastTweet.text ? lastTweet.text.substring(0, 30) + "..." : "No text"}`);
            
            // Если окно мониторинга существует, отправляем твит напрямую
            if (monitoringWindow) {
              monitoringWindow.webContents.send('post-data', lastTweet);
              log.info(`Direct tweet access - Sent to monitoring window: ${lastTweet.id}`);
            }
          }
        } catch (directErr) {
          log.error("Error in direct tweet access:", directErr);
        }
        
        // Try to toggle tabs which is faster than a full page refresh
        const tabsToggled = await page.evaluate(() => {
          const tabs = document.querySelectorAll('[role="tab"]');
          if (tabs.length >= 2) {
            tabs[0].click();
            setTimeout(() => tabs[1].click(), 300);
            return true;
          }
          return false;
        });
        
        if (tabsToggled) {
          log.info("Tab switching completed");
        } else {
          // Try to click the refresh button
          const refreshButtonExists = await page.evaluate(() => {
            const refreshButton = document.querySelector('[data-testid="refresh"]');
            if (refreshButton) {
              refreshButton.click();
              return true;
            }
            return false;
          });
          
          if (refreshButtonExists) {
            log.info("Refresh button clicked");
          } else {
            // If no refresh options available, do a full page reload less frequently
            const now = Date.now();
            if (now - lastRefreshTime > 5000) {
              log.info("Performing full page reload");
              await page.reload({ waitUntil: 'networkidle2' });
              
              // After reload we need to reinject our observer
              await page.waitForTimeout(1000);
              await injectObserver();
              await initializeObserver();
              
              // Click Latest tab
              await page.evaluate(() => {
                const latestTab = document.querySelector('[role="tab"]:nth-child(2)');
                if (latestTab) latestTab.click();
              });
              
              lastRefreshTime = now;
            } else {
              log.info("Full reload delayed (too frequent requests)");
            }
          }
        }
        
        // Force check for new tweets
        await page.evaluate(() => {
          if (window.twitterObserver) {
            window.twitterObserver.checkForNewPosts();
          } else {
            console.error("TwitterPostObserver not found in page context!");
          }
        });
        
      } catch (err) {
        log.error("Error refreshing page:", err);
      }
    };
    
    // Set up page refresh interval - now checking every 2 seconds instead of 1
    refreshIntervalId = setInterval(refreshPage, 2000);
    
    // Cleanup on page close
    page.on('close', () => {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
        log.info("Refresh interval cleared due to page close");
      }
    });
    
    log.info("TWEET MONITORING CONFIGURED - UPDATING EVERY SECOND");
    return true;
  } catch (error) {
    log.error("ERROR SETTING UP MONITORING:", error);
    return false;
  }
}