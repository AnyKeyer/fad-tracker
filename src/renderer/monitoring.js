// Monitoring page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const keywordsList = document.getElementById('keywordsList');
  const excludedTermsContainer = document.getElementById('excludedTermsContainer');
  const excludedTermsList = document.getElementById('excludedTermsList');
  const totalPosts = document.getElementById('totalPosts');
  const posts1min = document.getElementById('posts1min');
  const posts5min = document.getElementById('posts5min');
  const posts15min = document.getElementById('posts15min');
  const posts30min = document.getElementById('posts30min');
  const posts60min = document.getElementById('posts60min');
  const filteredPosts = document.getElementById('filteredPosts');
  const trend1min = document.getElementById('trend1min');
  const trend5min = document.getElementById('trend5min');
  const trend15min = document.getElementById('trend15min');
  const trend30min = document.getElementById('trend30min');
  const trend60min = document.getElementById('trend60min');
  const trendValue1min = document.getElementById('trendValue1min');
  const trendValue5min = document.getElementById('trendValue5min');
  const trendValue15min = document.getElementById('trendValue15min');
  const trendValue30min = document.getElementById('trendValue30min');
  const trendValue60min = document.getElementById('trendValue60min');
  const stopAnalysisBtn = document.getElementById('stopAnalysisBtn');
  const accountInfo = document.getElementById('accountInfo');
  const accountLink = document.getElementById('accountLink');
  const tweetsList = document.getElementById('tweetsList');
  
  // Кэш для информации о профилях пользователей
  const profileCache = new Map();
  
  // Получение информации о профиле с кэшированием
  async function fetchProfileInfo(username) {
    try {
      // Убираем @ из имени пользователя, если он есть
      const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
      
      // Проверяем кэш
      if (profileCache.has(cleanUsername)) {
        console.log(`Using cached profile info for ${cleanUsername}`);
        return profileCache.get(cleanUsername);
      }
      
      console.log(`Fetching profile info for ${cleanUsername}`);
      const result = await window.api.getTwitterProfileInfo(cleanUsername);
      
      if (result.success && result.profileInfo) {
        // Сохраняем в кэш
        profileCache.set(cleanUsername, result.profileInfo);
        return result.profileInfo;
      } else {
        console.error(`Error fetching profile for ${cleanUsername}:`, result.error);
        return null;
      }
    } catch (error) {
      console.error(`Exception fetching profile for ${username}:`, error);
      return null;
    }
  }
  
  // Stats tracking
  let stats = {
    totalPosts: 0,
    filteredPosts: 0,
    posts: [], // Array to store post timestamps
    previousStats: {
      '1min': 0,
      '5min': 0,
      '15min': 0,
      '30min': 0,
      '60min': 0
    },
    processedTweetIds: new Set(), // Track unique tweet IDs
    processedContentHashes: new Set(), // Track unique content hashes
    excludedTerms: [] // Сохраняем исключенные термины
  };

  // Стартуем с пустыми историческими данными для сравнения
  let historicalData = {
    // Структура данных для хранения истории трендов по временным промежуткам
    '1min': {
      values: [], // Массив значений (количество твитов)
      timestamps: [], // Соответствующие временные метки
      maxHistory: 12, // Хранить историю за 12 минут
      lastUpdateTime: 0, // Время последнего обновления
      updateInterval: 10000 // Обновлять каждые 10 секунд
    },
    '5min': {
      values: [], // Массив значений (количество твитов)
      timestamps: [], // Соответствующие временные метки
      maxHistory: 12, // Хранить историю за последний час (12 * 5 минут)
      lastUpdateTime: 0, // Время последнего обновления
      updateInterval: 60000 // Обновлять каждую минуту (60000 мс)
    },
    '15min': {
      values: [],
      timestamps: [],
      maxHistory: 8, // Хранить историю за последние 2 часа (8 * 15 минут)
      lastUpdateTime: 0,
      updateInterval: 120000 // Обновлять каждые 2 минуты
    },
    '30min': {
      values: [],
      timestamps: [],
      maxHistory: 8, // Хранить историю за последние 4 часа (8 * 30 минут)
      lastUpdateTime: 0,
      updateInterval: 180000 // Обновлять каждые 3 минуты
    },
    '60min': {
      values: [],
      timestamps: [],
      maxHistory: 24, // Хранить историю за последние сутки (24 * 60 минут)
      lastUpdateTime: 0,
      updateInterval: 300000 // Обновлять каждые 5 минут
    }
  };
  
  // Функция для обновления исторических данных трендов
  function updateHistoricalData(period, value) {
    const now = Date.now();
    const data = historicalData[period];
    
    // Добавляем новое значение и временную метку
    data.values.push(value);
    data.timestamps.push(now);
    
    // Очистка старых данных, оставляем только maxHistory значений
    if (data.values.length > data.maxHistory) {
      data.values.shift();
      data.timestamps.shift();
    }
    
    return data.values.length > 1 ? data.values[data.values.length - 2] : 0;
  }
  
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
      // Проверяем уникальность твита - смотрим только на ID, а не на весь текст
      // Это гарантирует, что один и тот же твит не будет добавлен повторно
      if (stats.processedTweetIds.has(postData.id)) {
        console.log(`MONITORING UI: Дубликат твита с ID ${postData.id} пропущен`);
        return; // Пропускаем дубликаты
      }
      
      // Проверяем, не обрабатывали ли мы уже этот твит по частичному совпадению
      // Это дополнительная проверка для твитов с разными ID, но одинаковым текстом
      if (postData.text && postData.text.length > 20) {
        // Создаем хеш из первых 20 символов текста и автора
        const textAndAuthorHash = `${postData.author}_${postData.text.substring(0, 20)}`;
        
        // Проверяем, есть ли в кэше
        if (stats.processedContentHashes.has(textAndAuthorHash)) {
          console.log(`MONITORING UI: Твит с похожим содержимым пропущен: ${textAndAuthorHash}`);
          return;
        }
        
        // Добавляем хеш в обработанные
        stats.processedContentHashes.add(textAndAuthorHash);
      }
      
      // Добавляем ID твита в обработанные
      stats.processedTweetIds.add(postData.id);
      
      console.log(`MONITORING UI: Обработка нового твита: ${postData.id}`);
      
      // Показываем визуальную индикацию нового твита
      showNewTweetIndicator();
      
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
  
  // Визуальная индикация нового твита
  function showNewTweetIndicator() {
    try {
      // Добавить мигающий индикатор в верхнюю часть страницы
      const indicator = document.createElement('div');
      
      // Задаем стили
      Object.assign(indicator.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: '#1da1f2', // Twitter синий
        color: 'white',
        padding: '6px 12px',
        borderRadius: '20px',
        zIndex: '9999',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        animation: 'pulse 1s infinite alternate'
      });
      
      // Добавляем анимацию
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 0.7; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.1); }
        }
      `;
      document.head.appendChild(style);
      
      // Текст индикатора
      indicator.textContent = '🔔 Новый твит получен!';
      
      // Добавляем в DOM
      document.body.appendChild(indicator);
      
      // Удаляем через 3 секунды
      setTimeout(() => {
        indicator.style.transition = 'opacity 0.5s, transform 0.5s';
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
          if (style.parentNode) {
            style.parentNode.removeChild(style);
          }
        }, 500);
      }, 3000);
    } catch (err) {
      console.error('Ошибка при отображении индикатора:', err);
    }
  }
  
  // Добавляем твит в список твитов
  async function addTweetToList(postData) {
    if (!postData || !postData.text) {
      console.error("Некорректные данные твита:", postData);
      return;
    }
    
    console.log("Добавление твита в список:", postData.text.substring(0, 30) + "...");
    
    // Создаем элемент твита
    const tweetElement = document.createElement('div');
    tweetElement.className = 'tweet-item';
    tweetElement.id = postData.id;
    
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
    
    // Извлекаем имя пользователя без @ для дальнейшего использования
    let username = author;
    if (author.includes('@')) {
      username = author.split('@')[1];
    } else if (author.includes(' @')) {
      username = author.split(' @')[1];
    }
    
    // HTML для заголовка твита
    const headerHtml = `
      <div class="card-header ${excluded ? 'bg-secondary' : 'bg-info'}" style="background-color: ${excluded ? '#6c757d' : '#17a2b8'}; color: white;">
        <span style="font-weight: bold;">${author}</span>
        <small>${formattedDate}</small>
      </div>
    `;
    
    // HTML для тела твита (временно)
    const bodyHtml = `
      <div class="card-body">
        <p class="tweet-text">${postData.text}</p>
        <div class="profile-info" id="profile-${postData.id}">
          <span class="loading-info">Загрузка информации о профиле...</span>
        </div>
      </div>
    `;
    
    // Добавляем собранный HTML
    tweetElement.innerHTML = headerHtml + bodyHtml;
    
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
    
    // Загружаем информацию о профиле и обновляем твит
    if (username) {
      try {
        const profileInfo = await fetchProfileInfo(username);
        if (profileInfo) {
          const profileElement = document.getElementById(`profile-${postData.id}`);
          if (profileElement) {
            profileElement.innerHTML = `
              <div class="profile-stats">
                <span class="profile-stat followers">👥 Подписчики: ${formatNumber(profileInfo.followers)}</span>
                <span class="profile-stat following">🔄 Подписки: ${formatNumber(profileInfo.following)}</span>
                ${profileInfo.verified ? '<span class="profile-verified">✓ Верифицирован</span>' : ''}
              </div>
            `;
            
            // Добавляем стили для информации о профиле
            const profileStats = profileElement.querySelector('.profile-stats');
            if (profileStats) {
              profileStats.style.display = 'flex';
              profileStats.style.flexWrap = 'wrap';
              profileStats.style.gap = '10px';
              profileStats.style.marginTop = '10px';
              profileStats.style.fontSize = '13px';
              profileStats.style.color = '#8899a6';
            }
            
            // Добавляем стили для подписчиков и подписок
            const statElements = profileElement.querySelectorAll('.profile-stat');
            statElements.forEach(el => {
              el.style.backgroundColor = 'rgba(29, 161, 242, 0.1)';
              el.style.padding = '4px 8px';
              el.style.borderRadius = '12px';
              el.style.color = '#1da1f2';
            });
            
            // Стиль для верифицированной метки
            const verifiedElement = profileElement.querySelector('.profile-verified');
            if (verifiedElement) {
              verifiedElement.style.backgroundColor = 'rgba(0, 186, 124, 0.1)';
              verifiedElement.style.padding = '4px 8px';
              verifiedElement.style.borderRadius = '12px';
              verifiedElement.style.color = '#00ba7c';
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching profile info for ${username}:`, error);
        // Если не удалось загрузить информацию о профиле, просто скрываем элемент загрузки
        const profileElement = document.getElementById(`profile-${postData.id}`);
        if (profileElement) {
          profileElement.style.display = 'none';
        }
      }
    }
    
    // Ограничиваем количество отображаемых твитов для производительности
    const MAX_DISPLAYED_TWEETS = 100;
    while (tweetsList.children.length > MAX_DISPLAYED_TWEETS) {
      tweetsList.removeChild(tweetsList.lastChild);
    }
  }
  
  // Функция для форматирования чисел (добавление K и M для тысяч и миллионов)
  function formatNumber(num) {
    if (!num) return '0';
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    } else {
      return num.toString();
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
    
    // Рассчитываем текущую статистику
    const posts1MinCount = countPostsInRange(now - 1 * 60 * 1000, now);
    const posts5MinCount = countPostsInRange(now - 5 * 60 * 1000, now);
    const posts15MinCount = countPostsInRange(now - 15 * 60 * 1000, now);
    const posts30MinCount = countPostsInRange(now - 30 * 60 * 1000, now);
    const posts60MinCount = countPostsInRange(now - 60 * 60 * 1000, now);
    
    // Обновляем отображение
    posts1min.textContent = posts1MinCount;
    posts5min.textContent = posts5MinCount;
    posts15min.textContent = posts15MinCount;
    posts30min.textContent = posts30MinCount;
    posts60min.textContent = posts60MinCount;
    
    // Обновляем индикаторы тренда только в соответствии с их интервалами обновления
    updateTrendWithInterval('1min', posts1MinCount);
    updateTrendWithInterval('5min', posts5MinCount);
    updateTrendWithInterval('15min', posts15MinCount);
    updateTrendWithInterval('30min', posts30MinCount);
    updateTrendWithInterval('60min', posts60MinCount);
    
    // Обновляем мини-графики на основе исторических данных
    updateMiniCharts();
    
    // Очищаем старые данные (старше 1 часа)
    cleanupOldPosts(now - 60 * 60 * 1000);
  }
  
  // Функция для обновления тренда с учетом интервала
  function updateTrendWithInterval(periodKey, currentValue) {
    const period = historicalData[periodKey];
    const now = Date.now();
    
    // Проверяем, прошло ли достаточно времени с последнего обновления
    if (now - period.lastUpdateTime >= period.updateInterval) {
      // Сохраняем текущее время как время последнего обновления
      period.lastUpdateTime = now;
      
      // Получаем ссылку на DOM элемент
      const trendElement = document.getElementById(`trend${periodKey}`);
      
      // Получаем предыдущее значение, обновляем историю и обновляем тренд
      const previousValue = period.values.length > 0 ? period.values[period.values.length - 1] : 0;
      updateHistoricalData(periodKey, currentValue);
      
      // Обновляем визуальное отображение тренда
      updateTrendIndicator(trendElement, currentValue, previousValue);
      
      // Анимируем изменение для привлечения внимания
      animateTrendChange(periodKey, currentValue > previousValue ? 'up' : 
                                    currentValue < previousValue ? 'down' : 'neutral');
    }
  }
  
  // Добавляем анимацию изменения тренда
  function animateTrendChange(periodKey, direction) {
    const trendElement = document.getElementById(`trend${periodKey}`);
    const valueElement = document.getElementById(`trendValue${periodKey}`);
    const card = trendElement.closest('.stat-card');
    
    if (!card) return;
    
    // Очищаем предыдущую анимацию
    card.classList.remove('pulse-up', 'pulse-down');
    
    // Добавляем новую анимацию
    if (direction === 'up') {
      card.classList.add('pulse-up');
    } else if (direction === 'down') {
      card.classList.add('pulse-down');
    }
    
    // Удаляем анимацию через некоторое время
    setTimeout(() => {
      card.classList.remove('pulse-up', 'pulse-down');
    }, 2000);
  }
  
  // Функция для обновления мини-графиков
  function updateMiniCharts() {
    // Обновляем графики для каждого периода
    renderMiniChart('1min');
    renderMiniChart('5min');
    renderMiniChart('15min');
    renderMiniChart('30min');
    renderMiniChart('60min');
  }
  
  // Функция для отрисовки мини-графика
  function renderMiniChart(periodKey) {
    const chartCanvas = document.getElementById(`chart${periodKey}`);
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    const data = historicalData[periodKey].values;
    
    if (!data || data.length < 2) return;
    
    // Очищаем холст
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    
    // Находим максимальное значение для масштабирования
    const maxValue = Math.max(...data, 1);
    const height = chartCanvas.height;
    const width = chartCanvas.width;
    
    // Определяем цвет графика в зависимости от тренда
    const lastValue = data[data.length - 1];
    const previousValue = data[data.length - 2];
    
    let lineColor;
    if (lastValue > previousValue) {
      lineColor = 'rgba(0, 186, 124, 0.8)'; // Зеленый - рост
    } else if (lastValue < previousValue) {
      lineColor = 'rgba(244, 33, 46, 0.8)'; // Красный - падение
    } else {
      lineColor = 'rgba(255, 255, 255, 0.5)'; // Нейтральный серый
    }
    
    // Настраиваем стиль линии
    ctx.lineWidth = 2;
    ctx.strokeStyle = lineColor;
    ctx.fillStyle = lineColor.replace('0.8', '0.2');
    
    // Начинаем путь
    ctx.beginPath();
    
    // Рисуем линию для значений
    const stepX = width / (data.length - 1);
    
    // Начинаем с нижней точки для заливки
    ctx.moveTo(0, height);
    
    // Масштабируем и рисуем каждую точку
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = height - (data[i] / maxValue) * height * 0.9;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Добавляем линии к нижним углам для создания заливки
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    
    // Заливаем область под графиком
    ctx.fill();
    
    // Рисуем линию заново для четкости
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = height - (data[i] / maxValue) * height * 0.9;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
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