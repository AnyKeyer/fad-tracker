// Monitoring page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const keywordsList = document.getElementById('keywordsList');
  const excludedTermsContainer = document.getElementById('excludedTermsContainer');
  const excludedTermsList = document.getElementById('excludedTermsList');
  const posts1min = document.getElementById('posts1min');
  const posts5min = document.getElementById('posts5min');
  const posts15min = document.getElementById('posts15min');
  const posts30min = document.getElementById('posts30min');
  const posts60min = document.getElementById('posts60min');
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
  
  // Gemini AI Elements
  const refreshAnalysisBtn = document.getElementById('refreshAnalysisBtn');
  const toggleAiBtn = document.getElementById('toggleAiBtn');
  const showAnalysisTopBtn = document.getElementById('showAnalysisTopBtn'); // New button at the top
  const lastAnalysisTime = document.getElementById('lastAnalysisTime');
  const overallSentiment = document.getElementById('overallSentiment');
  const positiveSentimentBar = document.getElementById('positiveSentimentBar');
  const neutralSentimentBar = document.getElementById('neutralSentimentBar');
  const negativeSentimentBar = document.getElementById('negativeSentimentBar');
  const positiveSentimentValue = document.getElementById('positiveSentimentValue');
  const neutralSentimentValue = document.getElementById('neutralSentimentValue');
  const negativeSentimentValue = document.getElementById('negativeSentimentValue');
  const aiInsights = document.getElementById('aiInsights');
  const keyPhrasesContainer = document.getElementById('keyPhrasesContainer');
  
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
      
      // Текущее время для статистики
      const timestamp = Date.now();
      
      // Добавляем твит в список твитов в интерфейсе
      addTweetToList(postData);
      
      // Проверяем, должен ли твит быть отфильтрован
      const excluded = isPostExcluded(postData.text);
      
      if (excluded) {
        stats.filteredPosts++;
        console.log(`MONITORING UI: Твит отфильтрован: ${postData.id}`);
      } else {
        // Увеличиваем общий счетчик
        stats.totalPosts++;
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
    
    // HTML для заголовка твита
    const headerHtml = `
      <div class="card-header ${excluded ? 'bg-secondary' : 'bg-info'}" style="background-color: ${excluded ? '#6c757d' : '#17a2b8'}; color: white;">
        <span style="font-weight: bold;">${author}</span>
        <small>${formattedDate}</small>
      </div>
    `;
    
    // HTML для тела твита (без информации о подписчиках/подписках)
    const bodyHtml = `
      <div class="card-body">
        <p class="tweet-text">${postData.text}</p>
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
  
  // Функция для обновления индикатора тренда
  function updateTrendIndicator(trendElement, currentValue, previousValue) {
    if (!trendElement) return;
    
    // Получаем элемент для отображения текстового значения тренда
    const valueElement = document.getElementById(trendElement.id.replace('trend', 'trendValue'));
    
    // Очищаем текущее содержимое
    trendElement.innerHTML = '';
    
    // Определяем разницу
    const diff = currentValue - previousValue;
    
    // Вычисляем процентное изменение (избегаем деления на ноль)
    let percentChange = 0;
    if (previousValue > 0) {
      percentChange = Math.round((diff / previousValue) * 100);
    } else if (diff > 0) {
      percentChange = 100; // Если предыдущее значение было 0, а текущее > 0, считаем как 100% рост
    }
    
    // Создаем символ тренда
    const trendSpan = document.createElement('span');
    
    if (diff > 0) {
      // Положительный тренд (рост)
      trendSpan.innerHTML = '↑';
      trendSpan.style.color = 'var(--success)';
      if (valueElement) valueElement.textContent = `+${percentChange}%`;
    } else if (diff < 0) {
      // Отрицательный тренд (падение)
      trendSpan.innerHTML = '↓';
      trendSpan.style.color = 'var(--danger)';
      if (valueElement) valueElement.textContent = `${percentChange}%`;
    } else {
      // Нейтральный тренд (без изменений)
      trendSpan.innerHTML = '•';
      trendSpan.style.color = 'var(--text-secondary)';
      if (valueElement) valueElement.textContent = '0%';
    }
    
    // Добавляем индикатор в DOM
    trendElement.appendChild(trendSpan);
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

  let tweetsPullingInterval;
  let geminiApiKey = '';
  let aiEnabled = true;
  
  // Загружаем сохраненный API-ключ Gemini при запуске
  async function loadGeminiApiKey() {
    geminiApiKey = await window.electronAPI.getGeminiApiKey();
    // Если ключ не настроен, показываем сообщение
    if (!geminiApiKey) {
      aiInsights.innerHTML = `
        <div class="ai-insight-placeholder">
          <p>Gemini API key not configured. Go to settings to add your API key.</p>
        </div>
      `;
      refreshAnalysisBtn.disabled = true;
    }
  }
  
  // Функция для анализа твитов с помощью Gemini API
  async function analyzeTwitterSentiment(tweets) {
    if (!geminiApiKey || tweets.length === 0) return;
    
    // Показываем индикатор загрузки и начальный статус
    aiInsights.innerHTML = '<div class="ai-insight-placeholder">Preparing to analyze tweets with Gemini AI...</div>';
    lastAnalysisTime.textContent = `Status: Preparing data...`;
    
    try {
      // Get the keywords for context
      let keywords = [];
      try {
        keywords = window.electronAPI.getKeywords() || [];
      } catch (keywordError) {
        console.error('Error getting keywords:', keywordError);
        keywords = [];
      }
      
      // Prepare the coin name from keywords if possible
      const coinName = keywords.length > 0 ? keywords[0] : 'cryptocurrency';
      
      // Обновляем статус - отправка запроса
      aiInsights.innerHTML = '<div class="ai-insight-placeholder">Sending request to Gemini AI...<br><small>This may take a few moments depending on the number of tweets</small></div>';
      lastAnalysisTime.textContent = `Status: Sending request to Gemini...`;
      
      // Отправляем запрос через main процесс с правильной структурой данных
      const response = await window.electronAPI.analyzeWithGemini({
        apiKey: geminiApiKey,
        tweets: tweets,
        coinName: coinName
      });
      
      // Обновляем статус - обработка ответа
      aiInsights.innerHTML = '<div class="ai-insight-placeholder">Processing Gemini AI response...</div>';
      lastAnalysisTime.textContent = `Status: Processing response...`;
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get analysis from Gemini');
      }
      
      // Process the successful response
      updateAiAnalysisUI(response.data);
      
      // Обновляем статус - анализ завершен
      lastAnalysisTime.textContent = `Analysis completed: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      console.error('Gemini API error:', error);
      aiInsights.innerHTML = `
        <div class="ai-insight-placeholder">
          <p>Error connecting to Gemini API.</p>
          <p><small>Error details: ${error.message}</small></p>
          <p>Please check your API key and try again.</p>
        </div>
      `;
      lastAnalysisTime.textContent = `Status: Error - ${error.message}`;
    }
  }
  
  // Функция для обновления интерфейса с результатами анализа
  function updateAiAnalysisUI(result) {
    try {
      console.log('Received analysis result:', result);
      
      // Обновляем общий индикатор настроения
      overallSentiment.textContent = result.sentiment;
      overallSentiment.className = 'sentiment-indicator ' + result.sentiment.toLowerCase();
      
      // Обновляем прогресс-бары настроения
      positiveSentimentBar.style.width = `${result.sentimentBreakdown.positive}%`;
      neutralSentimentBar.style.width = `${result.sentimentBreakdown.neutral}%`;
      negativeSentimentBar.style.width = `${result.sentimentBreakdown.negative}%`;
      
      positiveSentimentValue.textContent = `${result.sentimentBreakdown.positive}%`;
      neutralSentimentValue.textContent = `${result.sentimentBreakdown.neutral}%`;
      negativeSentimentValue.textContent = `${result.sentimentBreakdown.negative}%`;
      
      // Обновляем текст анализа
      aiInsights.innerHTML = `<p>${result.analysis || result.insights || 'No analysis provided'}</p>`;
      
      // Обновляем ключевые темы
      keyPhrasesContainer.innerHTML = '';
      
      // Check for different possible property names for key topics/phrases and use the first valid one
      const topics = result.keyTopics || result.keyPhrases || result.topics || [];
      
      if (Array.isArray(topics) && topics.length > 0) {
        topics.forEach(topic => {
          const phraseElement = document.createElement('div');
          phraseElement.className = 'key-phrase';
          phraseElement.textContent = topic;
          keyPhrasesContainer.appendChild(phraseElement);
        });
      } else {
        // If no topics/phrases are provided, display a message
        const noTopicsElement = document.createElement('div');
        noTopicsElement.className = 'key-phrase';
        noTopicsElement.textContent = 'No key topics identified';
        keyPhrasesContainer.appendChild(noTopicsElement);
      }
    } catch (error) {
      console.error('Error updating UI with analysis result:', error);
      aiInsights.innerHTML = `<p>Error displaying analysis results: ${error.message}</p>`;
      
      // Log the structure of the result for debugging
      console.log('Result structure:', JSON.stringify(result, null, 2));
    }
  }
  
  // Обработчик кнопки анализа твитов
  refreshAnalysisBtn.addEventListener('click', () => {
    // Получаем последние твиты для анализа (до 50 штук)
    const tweetsToAnalyze = Array.from(document.querySelectorAll('.tweet-item'))
      .slice(0, 50)
      .map(tweetElem => {
        const tweetText = tweetElem.querySelector('.tweet-text');
        const headerElement = tweetElem.querySelector('.card-header');
        
        return {
          text: tweetText ? tweetText.textContent : '',
          author: headerElement ? headerElement.querySelector('span')?.textContent || '' : ''
        };
      })
      .filter(tweet => tweet.text); // Filter out any tweets without text
    
    // Show loading status
    aiInsights.innerHTML = '<div class="ai-insight-placeholder">Processing tweets...</div>';
    
    // Update last analysis time
    const now = new Date();
    lastAnalysisTime.textContent = `Last analyzed: ${now.toLocaleTimeString()}`;
    
    // Call the sentiment analysis function
    analyzeTwitterSentiment(tweetsToAnalyze);
  });
  
  // Modified toggle AI button handler
  toggleAiBtn.addEventListener('click', () => {
    toggleAiPanel(false);
  });
  
  // Handler for the new show analysis button at the top
  showAnalysisTopBtn.addEventListener('click', () => {
    toggleAiPanel(true);
  });
  
  // Unified function to toggle AI panel visibility
  function toggleAiPanel(show) {
    const aiSection = document.querySelector('.ai-analysis-section');
    const tweetsSection = document.querySelector('.tweets-section');
    
    if (show) {
      // Show the panel
      aiSection.style.display = 'flex';
      toggleAiBtn.textContent = 'Hide Analysis';
      tweetsSection.style.gridTemplateColumns = '1fr 480px';
      showAnalysisTopBtn.style.display = 'none'; // Hide the top button
      aiEnabled = true;
    } else {
      // Hide the panel
      aiSection.style.display = 'none';
      tweetsSection.style.gridTemplateColumns = '1fr';
      showAnalysisTopBtn.style.display = 'inline-block'; // Show the top button
      aiEnabled = false;
    }
  }
  
  // Инициализация
  window.addEventListener('DOMContentLoaded', () => {
    loadGeminiApiKey();
  });
});