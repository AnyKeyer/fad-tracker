// Monitoring page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const keywordsList = document.getElementById('keywordsList');
  const excludedTermsContainer = document.getElementById('excludedTermsContainer');
  const excludedTermsList = document.getElementById('excludedTermsList');
  const totalPosts = document.getElementById('totalPosts');
  const posts5min = document.getElementById('posts5min');
  const posts15min = document.getElementById('posts15min');
  const posts30min = document.getElementById('posts30min');
  const posts60min = document.getElementById('posts60min');
  const filteredPosts = document.getElementById('filteredPosts');
  const trend5min = document.getElementById('trend5min');
  const trend15min = document.getElementById('trend15min');
  const trend30min = document.getElementById('trend30min');
  const trend60min = document.getElementById('trend60min');
  const stopAnalysisBtn = document.getElementById('stopAnalysisBtn');
  const accountInfo = document.getElementById('accountInfo');
  const accountLink = document.getElementById('accountLink');
  const tweetsList = document.getElementById('tweetsList');
  
  // Stats tracking
  let stats = {
    totalPosts: 0,
    filteredPosts: 0,
    posts: [], // Array to store post timestamps
    previousStats: {
      '5min': 0,
      '15min': 0,
      '30min': 0,
      '60min': 0
    },
    processedTweetIds: new Set(), // Track unique tweet IDs
    excludedTerms: [] // Сохраняем исключенные термины
  };
  
  // Load user information for the account display
  async function loadTwitterUserInfo() {
    try {
      const userInfo = await window.api.getTwitterUserInfo();
      
      if (userInfo && userInfo.username) {
        // Update account link in the header
        accountLink.textContent = userInfo.username;
        
        // Set Twitter profile URL
        const twitterHandle = userInfo.username.startsWith('@') ? 
          userInfo.username.substring(1) : userInfo.username;
        
        // Only set the link if we have a valid username (not the default @user)
        if (twitterHandle !== 'user') {
          accountLink.href = `https://twitter.com/${twitterHandle}`;
        } else {
          accountLink.href = '#';
        }
      }
    } catch (error) {
      console.error('Error loading Twitter user info:', error);
    }
  }
  
  // Load user info on page load
  loadTwitterUserInfo();
  
  // Initialize monitoring stats display
  window.api.onSearchInfo(info => {
    // Display keywords
    keywordsList.innerHTML = ''; // Clear existing keywords
    info.keywords.forEach(keyword => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag';
      tag.textContent = keyword;
      keywordsList.appendChild(tag);
    });
    
    // Display excluded terms if any
    if (info.excludedTerms && info.excludedTerms.length > 0) {
      excludedTermsContainer.style.display = 'block';
      excludedTermsList.innerHTML = ''; // Clear existing excluded terms
      
      // Сохраняем исключенные термины для дальнейшего использования
      stats.excludedTerms = [...info.excludedTerms];
      
      info.excludedTerms.forEach(term => {
        const tag = document.createElement('span');
        tag.className = 'keyword-tag';
        tag.textContent = term;
        excludedTermsList.appendChild(tag);
      });
    }
  });
  
  // Receive post data from main process (coming from Puppeteer)
  window.api.onPostData(postData => {
    console.log('MONITORING UI: Received post data:', postData);
    
    // Проверяем корректность данных
    if (!postData || !postData.id) {
      console.error('MONITORING UI: Received invalid post data:', postData);
      return;
    }
    
    try {
      // Проверяем уникальность твита
      if (stats.processedTweetIds.has(postData.id)) {
        console.log(`MONITORING UI: Дубликат твита с ID ${postData.id} пропущен`);
        return; // Пропускаем дубликаты
      }
      
      // Добавляем ID твита в обработанные
      stats.processedTweetIds.add(postData.id);
      
      console.log(`MONITORING UI: Обработка нового твита: ${postData.id}`);
      
      // Текущее время для статистики
      const timestamp = Date.now();
      
      // Показываем уведомление о новом твите
      showTweetNotification(postData);
      
      // Добавляем твит в список твитов в интерфейсе
      addTweetToList(postData);
      
      // Проверяем, должен ли твит быть отфильтрован
      const excluded = isPostExcluded(postData.text);
      
      if (excluded) {
        stats.filteredPosts++;
        filteredPosts.textContent = stats.filteredPosts;
        console.log(`MONITORING UI: Твит отфильтрован: ${postData.id}`);
      } else {
        // Увеличиваем общий счетчик
        stats.totalPosts++;
        totalPosts.textContent = stats.totalPosts;
        console.log(`MONITORING UI: Твит добавлен в статистику: ${postData.id}, всего твитов: ${stats.totalPosts}`);
        
        // Добавляем временную метку для подсчета твитов по временным интервалам
        stats.posts.push(timestamp);
      }
      
      // Обновляем статистику в любом случае
      updateStatistics();
    } catch (error) {
      console.error('MONITORING UI: Ошибка при обработке данных твита:', error);
    }
  });
  
  // Добавляем твит в список твитов
  function addTweetToList(postData) {
    if (!postData || !postData.text) {
      console.error("Некорректные данные твита:", postData);
      return;
    }
    
    console.log("Добавление твита в список:", postData.text.substring(0, 30) + "...");
    
    // Создаем элемент твита
    const tweetElement = document.createElement('div');
    tweetElement.className = 'tweet-item';
    
    // Форматируем дату для отображения
    const tweetDate = postData.timestamp ? new Date(postData.timestamp) : new Date();
    const formattedDate = tweetDate.toLocaleString();
    
    // Определяем автора твита
    const author = postData.author || 'Unknown Author';
    
    // Проверяем, исключен ли твит по фильтрам
    const excluded = isPostExcluded(postData.text);
    if (excluded) {
      tweetElement.classList.add('excluded-tweet');
    }
    
    // Создаем HTML-структуру твита
    tweetElement.innerHTML = `
      <div class="card-header ${excluded ? 'bg-secondary' : 'bg-info'}" style="background-color: ${excluded ? '#6c757d' : '#17a2b8'}; color: white;">
        <span style="font-weight: bold;">${author}</span>
        <small>${formattedDate}</small>
      </div>
      <div class="card-body">
        <p class="tweet-text">${postData.text}</p>
      </div>
    `;
    
    // Проверяем, существует ли контейнер tweetsList
    if (!tweetsList) {
      console.error("Контейнер tweetsList не найден!");
      return;
    }
    
    // Добавляем твит в начало списка
    if (tweetsList.firstChild) {
      tweetsList.insertBefore(tweetElement, tweetsList.firstChild);
    } else {
      tweetsList.appendChild(tweetElement);
    }
    
    // Ограничиваем количество отображаемых твитов для производительности
    const MAX_DISPLAYED_TWEETS = 100;
    while (tweetsList.children.length > MAX_DISPLAYED_TWEETS) {
      tweetsList.removeChild(tweetsList.lastChild);
    }
  }
  
  // Показываем уведомление о новом твите
  function showTweetNotification(postData) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = 'tweet-notification';
    
    // Добавляем информацию об авторе, если доступна
    if (postData.author) {
      const author = document.createElement('strong');
      author.textContent = postData.author;
      author.style.display = 'block';
      author.style.marginBottom = '5px';
      notification.appendChild(author);
    }
    
    // Обрезаем текст, если он слишком длинный
    const text = postData.text.length > 100 ? 
      postData.text.substring(0, 100) + '...' : 
      postData.text;
    
    const content = document.createElement('p');
    content.style.margin = '0';
    content.style.fontSize = '14px';
    content.textContent = text;
    notification.appendChild(content);
    
    // Добавляем в документ
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Удаляем через несколько секунд
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
  
  // Проверяем, должен ли пост быть исключен на основе списка исключенных терминов
  function isPostExcluded(postText) {
    // Используем сохраненные исключенные термины вместо извлечения их из DOM
    const excludedTerms = stats.excludedTerms;
    
    if (!excludedTerms || !excludedTerms.length || !postText) return false;
    
    return excludedTerms.some(term => 
      postText.toLowerCase().includes(term.toLowerCase())
    );
  }
  
  // Обновляем статистику
  function updateStatistics() {
    // Обновляем общее количество постов
    totalPosts.textContent = stats.totalPosts;
    
    // Текущее время
    const now = Date.now();
    
    // Сохраняем предыдущие значения для сравнения
    const lastStats = { ...stats.previousStats };
    
    // Рассчитываем текущую статистику
    const posts5MinCount = countPostsInRange(now - 5 * 60 * 1000, now);
    const posts15MinCount = countPostsInRange(now - 15 * 60 * 1000, now);
    const posts30MinCount = countPostsInRange(now - 30 * 60 * 1000, now);
    const posts60MinCount = countPostsInRange(now - 60 * 60 * 1000, now);
    
    // Обновляем отображение
    posts5min.textContent = posts5MinCount;
    posts15min.textContent = posts15MinCount;
    posts30min.textContent = posts30MinCount;
    posts60min.textContent = posts60MinCount;
    
    // Обновляем индикаторы тренда
    updateTrendIndicator(trend5min, posts5MinCount, lastStats['5min']);
    updateTrendIndicator(trend15min, posts15MinCount, lastStats['15min']);
    updateTrendIndicator(trend30min, posts30MinCount, lastStats['30min']);
    updateTrendIndicator(trend60min, posts60MinCount, lastStats['60min']);
    
    // Сохраняем текущую статистику для следующего сравнения
    stats.previousStats = {
      '5min': posts5MinCount,
      '15min': posts15MinCount,
      '30min': posts30MinCount,
      '60min': posts60MinCount
    };
    
    // Очищаем старые данные (старше 1 часа)
    cleanupOldPosts(now - 60 * 60 * 1000);
  }
  
  // Обновляем индикатор тренда
  function updateTrendIndicator(element, currentValue, previousValue) {
    if (currentValue > previousValue) {
      element.textContent = '↑';
      element.className = 'trend-indicator trend-up';
    } else if (currentValue < previousValue) {
      element.textContent = '↓';
      element.className = 'trend-indicator trend-down';
    } else {
      element.textContent = '—';
      element.className = 'trend-indicator trend-neutral';
    }
  }
  
  // Подсчитываем количество постов в заданном временном диапазоне
  function countPostsInRange(startTime, endTime) {
    return stats.posts.filter(timestamp => 
      timestamp >= startTime && timestamp <= endTime
    ).length;
  }
  
  // Очищаем старые посты для экономии памяти
  function cleanupOldPosts(cutoffTime) {
    stats.posts = stats.posts.filter(timestamp => timestamp >= cutoffTime);
  }
  
  // Запускаем регулярное обновление статистики
  setInterval(updateStatistics, 5000);
  
  // Обработчик кнопки остановки анализа
  stopAnalysisBtn.addEventListener('click', async () => {
    try {
      const result = await window.api.stopAnalysis();
      if (result.success) {
        // Окно будет закрыто основным процессом
      } else {
        alert(`Ошибка остановки анализа: ${result.error}`);
      }
    } catch (error) {
      alert(`Ошибка: ${error.message}`);
    }
  });
});