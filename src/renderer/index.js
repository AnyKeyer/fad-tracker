// Main page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Добавляем проверку API перед использованием
  console.log('DOM loaded, checking API availability:', !!window.api);
  
  // Elements
  const loginSection = document.getElementById('loginSection');
  const twitterLoginBtn = document.getElementById('twitterLoginBtn');
  const userInfoSection = document.getElementById('userInfoSection');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userProfileLink = document.getElementById('userProfileLink');
  const logoutBtn = document.getElementById('logoutBtn');
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
        
        // Update UI with user info
        updateUserInfoDisplay(result.userInfo);
        
        // Show main buttons and hide login section
        loginSection.style.display = 'none';
        userInfoSection.style.display = 'flex';
        mainButtonsSection.style.display = 'flex';
      } else {
        alert(`Login failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка при входе в систему:', error);
      alert(`Error during login: ${error.message}`);
    }
  });
  
  // Twitter Logout Handler
  logoutBtn.addEventListener('click', async () => {
    try {
      const result = await window.api.twitterLogout();
      
      if (result.success) {
        isLoggedIn = false;
        
        // Reset UI state
        userProfileLink.textContent = '@username';
        userProfileLink.href = '#';
        userAvatar.src = '';
        
        // Show login section and hide user info and main buttons
        loginSection.style.display = 'block';
        userInfoSection.style.display = 'none';
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
  });
  
  // Function to display user information
  function updateUserInfoDisplay(userInfo) {
    if (userInfo) {
      const username = userInfo.username || '@user';
      const profileLink = document.getElementById('userProfileLink');
      profileLink.textContent = username;
      
      // Set profile link URL
      const twitterHandle = username.startsWith('@') ? username.substring(1) : username;
      profileLink.href = `https://twitter.com/${twitterHandle}`;
      
      if (userInfo.avatarSrc) {
        userAvatar.src = userInfo.avatarSrc;
      } else {
        // Use a default avatar if none is available
        userAvatar.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
      }
      userInfoSection.style.display = 'flex';
    }
  }

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
  
  // Settings button handler
  settingsBtn.addEventListener('click', () => {
    alert('Settings functionality will be implemented in future updates.');
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
        
        // Update UI with stored user info
        updateUserInfoDisplay(status.userInfo);
        
        // Show main UI and hide login section
        loginSection.style.display = 'none';
        userInfoSection.style.display = 'flex';
        mainButtonsSection.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  };
  
  // Check login status when the app starts
  checkLoginStatus();
});