// Main page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Добавляем проверку API перед использованием
  console.log('DOM loaded, checking API availability:', !!window.api);
  
  // Elements
  const loginSection = document.getElementById('loginSection');
  const twitterLoginBtn = document.getElementById('twitterLoginBtn');
  const mainButtonsSection = document.querySelector('.main-buttons');
  const startAnalysisBtn = document.getElementById('startAnalysisBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const helpBtn = document.getElementById('helpBtn');
  const analysisForm = document.getElementById('analysisForm');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const keywordTags = document.getElementById('keywordTags');
  const excludeInput = document.getElementById('excludeInput');
  const addExcludeBtn = document.getElementById('addExcludeBtn');
  const excludeTags = document.getElementById('excludeTags');
  const cancelAnalysisBtn = document.getElementById('cancelAnalysisBtn');
  const nextStep1Btn = document.getElementById('nextStep1Btn');
  const backStep2Btn = document.getElementById('backStep2Btn');
  const startTrackingBtn = document.getElementById('startTrackingBtn');
  
  // State
  const keywords = [];
  const excludedTerms = [];
  let isLoggedIn = false;
  
  // Twitter Login Handler
  twitterLoginBtn.addEventListener('click', async () => {
    try {
      // Проверка наличия API перед вызовом
      if (!window.api) {
        console.error('API не доступен. Перезагрузите приложение.');
        alert('API не доступен. Пожалуйста, перезагрузите приложение.');
        return;
      }
      
      console.log('Вызов метода twitterLogin');
      // Call the API to authenticate with Twitter
      const result = await window.api.twitterLogin();
      
      if (result.success) {
        isLoggedIn = true;
        
        // Show main buttons and hide login section
        loginSection.style.display = 'none';
        mainButtonsSection.style.display = 'flex';
      } else {
        alert(`Login failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка при входе в систему:', error);
      alert(`Error during login: ${error.message}`);
    }
  });

  // Event listeners
  startAnalysisBtn.addEventListener('click', () => {
    mainButtonsSection.style.display = 'none';
    analysisForm.style.display = 'block';
    step1.style.display = 'block';
    step2.style.display = 'none';
  });
  
  cancelAnalysisBtn.addEventListener('click', () => {
    mainButtonsSection.style.display = 'flex';
    analysisForm.style.display = 'none';
    keywords.length = 0;
    excludedTerms.length = 0;
    keywordTags.innerHTML = '';
    excludeTags.innerHTML = '';
  });
  
  nextStep1Btn.addEventListener('click', () => {
    if (keywords.length === 0) {
      alert('Please enter at least one keyword to track');
      return;
    }
    
    step1.style.display = 'none';
    step2.style.display = 'block';
  });
  
  backStep2Btn.addEventListener('click', () => {
    step2.style.display = 'none';
    step1.style.display = 'block';
  });
  
  startTrackingBtn.addEventListener('click', async () => {
    // Start the analysis with the API
    try {
      const result = await window.api.startAnalysis({
        keywords: keywords,
        excludedTerms: excludedTerms
      });
      
      if (result.success) {
        // Reset the UI
        mainButtonsSection.style.display = 'flex';
        analysisForm.style.display = 'none';
        keywords.length = 0;
        excludedTerms.length = 0;
        keywordTags.innerHTML = '';
        excludeTags.innerHTML = '';
      } else {
        alert(`Error starting analysis: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });
  
  // Keyword input handlers
  keywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  });
  
  addKeywordBtn.addEventListener('click', () => {
    addKeyword();
  });
  
  function addKeyword() {
    const keyword = keywordInput.value.trim();
    if (keyword && !keywords.includes(keyword)) {
      keywords.push(keyword);
      addTag(keyword, keywordTags, removeKeyword);
      keywordInput.value = '';
    }
    keywordInput.focus();
  }
  
  // Excluded terms input handlers
  excludeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addExcludedTerm();
    }
  });
  
  addExcludeBtn.addEventListener('click', () => {
    addExcludedTerm();
  });
  
  function addExcludedTerm() {
    const term = excludeInput.value.trim();
    if (term && !excludedTerms.includes(term)) {
      excludedTerms.push(term);
      addTag(term, excludeTags, removeExcludedTerm);
      excludeInput.value = '';
    }
    excludeInput.focus();
  }
  
  // Helper function to add tags
  function addTag(text, container, removeCallback) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    
    const span = document.createElement('span');
    span.textContent = text;
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeCallback(text, tag));
    
    tag.appendChild(span);
    tag.appendChild(removeBtn);
    container.appendChild(tag);
    
    // Add a nice appear animation
    tag.style.opacity = '0';
    setTimeout(() => {
      tag.style.opacity = '1';
    }, 10);
  }
  
  // Helper function to remove keywords
  function removeKeyword(keyword, element) {
    const index = keywords.indexOf(keyword);
    if (index !== -1) {
      keywords.splice(index, 1);
      removeTagWithAnimation(element);
    }
  }
  
  // Helper function to remove excluded terms
  function removeExcludedTerm(term, element) {
    const index = excludedTerms.indexOf(term);
    if (index !== -1) {
      excludedTerms.splice(index, 1);
      removeTagWithAnimation(element);
    }
  }
  
  // Helper function to remove tags with animation
  function removeTagWithAnimation(element) {
    element.style.opacity = '0';
    element.style.transform = 'scale(0.8)';
    setTimeout(() => {
      element.remove();
    }, 200);
  }
  
  // Получаем сохраненный ключ API Gemini из electron-store через IPC
  async function getGeminiApiKey() {
    try {
      return await window.api.getGeminiApiKey() || '';
    } catch (error) {
      console.error('Error getting Gemini API key:', error);
      return '';
    }
  }
  
  // Сохраняем ключ API Gemini в electron-store через IPC
  async function saveGeminiApiKey(apiKey) {
    try {
      await window.api.saveGeminiApiKey(apiKey);
    } catch (error) {
      console.error('Error saving Gemini API key:', error);
    }
  }
  
  // Settings button handler
  settingsBtn.addEventListener('click', () => {
    // Скрываем основные кнопки
    mainButtonsSection.style.display = 'none';
    
    // Создаем контейнер для настроек
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'analysis-form';
    settingsContainer.style.display = 'block';
    settingsContainer.style.animation = 'fadeIn 0.3s ease';
    
    // Заголовок настроек
    const settingsTitle = document.createElement('h2');
    settingsTitle.textContent = 'Settings';
    settingsContainer.appendChild(settingsTitle);
    
    // Создаем секцию настроек AI
    const aiSettingsSection = document.createElement('div');
    aiSettingsSection.className = 'form-group';
    aiSettingsSection.style.marginBottom = '30px';
    
    // Заголовок секции настроек AI
    const aiSettingsTitle = document.createElement('h3');
    aiSettingsTitle.textContent = 'AI Settings';
    aiSettingsTitle.style.color = 'var(--accent)';
    aiSettingsTitle.style.marginBottom = '15px';
    aiSettingsSection.appendChild(aiSettingsTitle);
    
    // Описание
    const aiSettingsDesc = document.createElement('p');
    aiSettingsDesc.textContent = 'Configure AI settings for tweet analysis and sentiment detection.';
    aiSettingsDesc.style.color = 'var(--text-secondary)';
    aiSettingsDesc.style.marginBottom = '20px';
    aiSettingsSection.appendChild(aiSettingsDesc);
    
    // Поле ввода ключа API Gemini
    const apiKeyLabel = document.createElement('label');
    apiKeyLabel.htmlFor = 'gemini-api-key';
    apiKeyLabel.textContent = 'Gemini API Key:';
    apiKeyLabel.style.display = 'block';
    apiKeyLabel.style.marginBottom = '10px';
    aiSettingsSection.appendChild(apiKeyLabel);
    
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'text';
    apiKeyInput.id = 'gemini-api-key';
    apiKeyInput.placeholder = 'Enter your Gemini API key';
    apiKeyInput.style.width = '100%';
    apiKeyInput.style.padding = '12px 16px';
    apiKeyInput.style.border = '1px solid var(--border)';
    apiKeyInput.style.borderRadius = '8px';
    apiKeyInput.style.fontSize = '16px';
    apiKeyInput.style.backgroundColor = 'var(--bg-primary)';
    apiKeyInput.style.color = 'var(--text-primary)';
    apiKeyInput.style.marginBottom = '15px';
    aiSettingsSection.appendChild(apiKeyInput);
    
    // Load the saved API key
    getGeminiApiKey().then(apiKey => {
      apiKeyInput.value = apiKey;
    });
    
    // Кнопка сохранения ключа API
    const saveApiKeyBtn = document.createElement('button');
    saveApiKeyBtn.className = 'btn btn-success';
    saveApiKeyBtn.textContent = 'Save API Key';
    saveApiKeyBtn.style.padding = '10px 20px';
    saveApiKeyBtn.style.fontSize = '16px';
    saveApiKeyBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value.trim();
      await saveGeminiApiKey(apiKey);
      
      // Показываем уведомление о сохранении
      const notification = document.createElement('div');
      notification.textContent = 'API key saved successfully!';
      notification.style.backgroundColor = 'var(--success)';
      notification.style.color = 'white';
      notification.style.padding = '10px 15px';
      notification.style.borderRadius = '5px';
      notification.style.marginTop = '10px';
      notification.style.animation = 'fadeIn 0.3s ease';
      notification.style.marginBottom = '15px';
      
      // Удаляем предыдущее уведомление, если оно существует
      const existingNotification = aiSettingsSection.querySelector('.notification');
      if (existingNotification) {
        existingNotification.remove();
      }
      
      notification.className = 'notification';
      aiSettingsSection.appendChild(notification);
      
      // Автоматически удаляем уведомление через 3 секунды
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    });
    aiSettingsSection.appendChild(saveApiKeyBtn);
    
    // Добавляем секцию настроек AI в контейнер настроек
    settingsContainer.appendChild(aiSettingsSection);
    
    // Создаем секцию настроек трастовости аккаунта
    const trustSettingsSection = document.createElement('div');
    trustSettingsSection.className = 'form-group';
    trustSettingsSection.style.marginBottom = '30px';
    
    // Заголовок секции настроек трастовости
    const trustSettingsTitle = document.createElement('h3');
    trustSettingsTitle.textContent = 'Account Trust Settings';
    trustSettingsTitle.style.color = 'var(--accent)';
    trustSettingsTitle.style.marginBottom = '15px';
    trustSettingsSection.appendChild(trustSettingsTitle);
    
    // Описание
    const trustSettingsDesc = document.createElement('p');
    trustSettingsDesc.textContent = 'Configure trust levels for Twitter accounts to filter and prioritize tweets.';
    trustSettingsDesc.style.color = 'var(--text-secondary)';
    trustSettingsSection.appendChild(trustSettingsDesc);
    
    // Сообщение о будущей реализации
    const comingSoonMsg = document.createElement('div');
    comingSoonMsg.textContent = 'This feature will be available in a future update.';
    comingSoonMsg.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
    comingSoonMsg.style.padding = '12px 16px';
    comingSoonMsg.style.borderRadius = '8px';
    comingSoonMsg.style.marginTop = '15px';
    comingSoonMsg.style.color = 'var(--accent)';
    trustSettingsSection.appendChild(comingSoonMsg);
    
    // Добавляем секцию настроек трастовости в контейнер настроек
    settingsContainer.appendChild(trustSettingsSection);
    
    // Секция выхода из аккаунта
    const logoutSection = document.createElement('div');
    logoutSection.className = 'form-group';
    logoutSection.style.marginBottom = '30px';
    
    // Заголовок секции выхода
    const logoutTitle = document.createElement('h3');
    logoutTitle.textContent = 'Account';
    logoutTitle.style.color = 'var(--accent)';
    logoutTitle.style.marginBottom = '15px';
    logoutSection.appendChild(logoutTitle);
    
    // Кнопка логаута
    const logoutButton = document.createElement('button');
    logoutButton.className = 'btn btn-danger';
    logoutButton.textContent = 'Logout from Twitter';
    logoutButton.style.width = '100%';
    logoutButton.addEventListener('click', async () => {
      // Предупреждаем пользователя о завершении всех анализов
      const confirmed = confirm("Warning: Logging out will stop all active analyses. Are you sure you want to continue?");
      
      if (confirmed) {
        try {
          // Останавливаем любой активный анализ
          const stopResult = await window.api.stopAnalysis().catch(() => ({ success: true }));
          
          // Выходим из Twitter
          const result = await window.api.twitterLogout();
          
          if (result.success) {
            isLoggedIn = false;
            
            // Закрываем окно настроек
            if (settingsContainer.parentNode) {
              settingsContainer.parentNode.removeChild(settingsContainer);
            }
            
            // Show login section and hide main buttons
            loginSection.style.display = 'block';
            mainButtonsSection.style.display = 'none';
            
            // Reset any active analysis
            analysisForm.style.display = 'none';
            keywords.length = 0;
            excludedTerms.length = 0;
            keywordTags.innerHTML = '';
            excludeTags.innerHTML = '';
          } else {
            alert(`Logout failed: ${result.error}`);
          }
        } catch (error) {
          alert(`Error during logout: ${error.message}`);
        }
      }
    });
    logoutSection.appendChild(logoutButton);
    
    // Добавляем секцию логаута в контейнер настроек
    settingsContainer.appendChild(logoutSection);
    
    // Кнопка возврата
    const backButtonContainer = document.createElement('div');
    backButtonContainer.style.marginTop = '30px';
    backButtonContainer.style.textAlign = 'center';
    
    const backButton = document.createElement('button');
    backButton.className = 'btn btn-secondary';
    backButton.textContent = 'Back to Main Menu';
    backButton.addEventListener('click', () => {
      // Удаляем контейнер настроек
      if (settingsContainer.parentNode) {
        settingsContainer.parentNode.removeChild(settingsContainer);
      }
      
      // Показываем основные кнопки
      mainButtonsSection.style.display = 'flex';
    });
    
    backButtonContainer.appendChild(backButton);
    settingsContainer.appendChild(backButtonContainer);
    
    // Добавляем контейнер настроек на страницу
    document.querySelector('.container').appendChild(settingsContainer);
  });
  
  // Help button handler
  helpBtn.addEventListener('click', () => {
    alert('Help functionality will be implemented in future updates.');
  });
  
  // Check if user is already logged in (could be stored in localStorage or sessionStorage)
  const checkLoginStatus = async () => {
    try {
      const status = await window.api.checkTwitterLoginStatus();
      if (status.loggedIn) {
        isLoggedIn = true;
        
        // Show main UI and hide login section
        loginSection.style.display = 'none';
        mainButtonsSection.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  };
  
  // Check login status when the app starts
  checkLoginStatus();
});