const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const puppeteer = require('puppeteer');
const logger = require('./logger'); // Import our updated logger
const log = logger.main; // Use main logger for general app logs
const aiLog = logger.ai; // Use AI logger for Gemini API related logs
const axios = require('axios'); // Import axios for Gemini API

// Initialize store for saving settings
const store = new Store();

// Keep a global reference of the window objects
let mainWindow = null;
let monitoringWindow = null;
let browser = null;
let page = null;

// Глобальная ссылка на функцию injectObserver
let injectObserverFn = null;

// Initialize puppeteer browser
async function initBrowser(options = {}) {
  try {
  // Run headless in production (packaged) to avoid showing debug browser UI
  // Allow explicit override via options.headless (e.g., for visible login flow)
  const isHeadless = typeof options.headless === 'boolean' ? options.headless : app.isPackaged;
    browser = await puppeteer.launch({
      headless: isHeadless,
      defaultViewport: isHeadless ? { width: 1200, height: 800 } : null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e2e', // Темный фон для окна
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true, // Скрываем системное меню
    icon: path.join(__dirname, '../renderer/assets/icon.png') // Добавим иконку, если она будет создана
  });

  // Load the main HTML file
  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools only in development mode and если явно задана переменная окружения OPEN_DEВ_TOOLS
  if (process.env.NODE_ENV === 'development' && process.env.OPEN_DEV_TOOLS === 'true') {
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
    minWidth: 900,
    minHeight: 700,
    backgroundColor: '#1e1e2e', // Темный фон
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Enable webview tag
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true, // Скрываем системное меню
    icon: path.join(__dirname, '../renderer/assets/icon.png') // Иконка окна
  });

  // Load the monitoring HTML file
  await monitoringWindow.loadFile(path.join(__dirname, '../renderer/monitoring.html'));

  // Open DevTools only if explicitly requested
  if (process.env.NODE_ENV === 'development' && process.env.OPEN_DEV_TOOLS === 'true') {
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
  // For login, always open a visible browser to allow manual auth
  browser = await initBrowser({ headless: false });
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
      // In packaged builds, use headless for monitoring. In dev, keep visible.
      browser = await initBrowser({ headless: app.isPackaged });
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
      log.info("🔒 No browser instance to close");
    }
    
    return { success: true };
  } catch (error) {
    log.error("❌ Error stopping analysis:", error);
    return { success: false, error: error.message };
  }
});

// Set up page refresh interval - checking every 20 seconds
let refreshIntervalId = null;

// Function to refresh page that doesn't depend on window object
async function refreshPage() {
  try {
    if (!page) return;
    
    // Current time
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    log.info(`Refreshing Twitter page [${timeStr}]`);
    
    // Check if the page is still valid
    try {
      await page.evaluate(() => document.title);
    } catch (err) {
      log.error("Page is no longer valid, stopping refresh interval");
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
      return;
    }
    
    // Checking if TwitterPostObserver exists
    const observerExists = await page.evaluate(() => {
      return typeof window.TwitterPostObserver === 'function' && 
             typeof window.twitterObserver !== 'undefined';
    }).catch(() => false);
    
    if (!observerExists) {
      log.error("TwitterPostObserver lost from page context - reinjecting");
      // Reinject observer if needed
      if (typeof setupTweetMonitoring === 'function') {
        await setupTweetMonitoring(page);
      }
    }
    
    // Perform page reload
    try {
      // Get current timestamp
      const now = Date.now();
      
      // Use static lastRefreshTime variable within the page context
      const needsRefresh = await page.evaluate((timestamp) => {
        // Initialize if it doesn't exist
        window.lastPageRefreshTime = window.lastPageRefreshTime || 0;
        
        // Check if enough time has passed (20 seconds)
        if (timestamp - window.lastPageRefreshTime >= 20000) {
          // Update the timestamp
          window.lastPageRefreshTime = timestamp;
          return true;
        }
        return false;
      }, now);
      
      if (needsRefresh) {
        log.info("🔄 Performing full page reload (20-second interval)");
        
        // Save current URL
        const currentUrl = await page.url();
        
        // Reload the page
        await page.reload({ waitUntil: 'networkidle2' });
        log.info("✅ Page successfully reloaded");
        
        // After reload, reinject our observers
        await page.waitForTimeout(2000); // Увеличиваем время ожидания для полной загрузки страницы
        
        // Явно восстанавливаем наблюдатель после перезагрузки страницы
        await injectObserverFn();
        
        // Обязательно очищаем историю просмотренных твитов при обновлении страницы
        await page.evaluate(() => {
          console.log("🔄 Resetting processed tweet history after page reload");
          window.processedTweetIds = new Set();
          window.seenTweetTexts = new Map();
        });
        
        // Click on Latest tab if needed
        await page.evaluate(() => {
          setTimeout(() => {
            const latestTab = document.querySelector('[role="tab"]:nth-child(2)');
            if (latestTab) {
              console.log("🔄 Clicking 'Latest' tab after reload");
              latestTab.click();
              
              // Ещё раз запускаем поиск твитов после явного перехода на вкладку Latest
              setTimeout(() => {
                if (typeof window.detectNewTweets === 'function') {
                  console.log("🔄 Running explicit tweet detection after tab switch");
                  window.detectNewTweets();
                }
              }, 2000);
            }
          }, 1000);
        });
      } else {
        // Try to use the refresh button as a fallback
        const refreshButtonClicked = await page.evaluate(() => {
          const refreshButton = document.querySelector('[data-testid="refresh"]');
          if (refreshButton) {
            console.log("🔄 Clicking refresh button");
            refreshButton.click();
            return true;
          }
          return false;
        });
        
        if (refreshButtonClicked) {
          log.info("Refresh button clicked - timeline should update");
        }
      }
    } catch (refreshErr) {
      log.error("Error refreshing timeline:", refreshErr);
    }
    
    // Scan for tweets after refresh
    try {
      await page.evaluate(() => {
        if (typeof window.detectNewTweets === 'function') {
          console.log("🔍 Scanning for tweets after refresh");
          window.detectNewTweets();
        }
      });
    } catch (scanErr) {
      log.error("Error scanning for tweets:", scanErr);
    }
  } catch (err) {
    log.error("Error during page refresh:", err);
  }
}

// Setup tweet monitoring in Puppeteer window
async function setupTweetMonitoring(page) {
  try {
    log.info("STARTING TWEET MONITORING SETUP");
    
    // Capture console logs from Puppeteer page
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      
      // Filter logs related to tweets
      if (text.includes('tweet') || text.includes('Tweet') || text.includes('📊')) {
        log.info(`Browser: ${text}`);
      } else if (type === 'error') {
        log.error(`Browser: ${text}`);
      } else if (type === 'warning') {
        log.warn(`Browser: ${text}`);
      } else {
        // Other logs output only in debug mode
        log.debug(`Browser: ${text}`);
      }
    });
    
    // Variables to track page refresh timing
    let lastFullReloadTime = Date.now();
    
    // Direct mutation observer for Twitter timeline - most reliable method
    async function injectObserver() {
      log.info("INJECTING ADVANCED MUTATION OBSERVER FOR TWITTER");
      
      // This method uses DOM MutationObserver to detect new tweets as they appear in real-time
      const result = await page.evaluate(() => {
        try {
          console.log("🔍 Setting up Advanced Twitter Observer with MutationObserver");
          
          // Clean up any previous instances
          if (window.advancedTwitterObserver) {
            console.log("🧹 Cleaning up previous observer");
            window.advancedTwitterObserver.disconnect();
            window.advancedTwitterObserver = null;
          }
          
          // Store processed tweet IDs to avoid duplicates
          window.processedTweetIds = window.processedTweetIds || new Set();
          
          // Create a map of seen tweet content to detect duplicates with different IDs
          window.seenTweetTexts = window.seenTweetTexts || new Map();
          
          // Initialize lastPageRefreshTime if not set
          window.lastPageRefreshTime = window.lastPageRefreshTime || Date.now();
          
          // Direct tweet detection via MutationObserver
          window.detectNewTweets = function() {
            console.log("🔎 Actively searching for tweets in the timeline");
            
            // More robust selectors to find tweets in any Twitter layout
            const tweetSelectors = [
              'article', 
              '[data-testid="tweet"]', 
              '[role="article"]', 
              'div[data-testid^="cellInnerDiv"]',
              // More specific selectors to catch all possible tweet containers
              '[data-testid="cellInnerDiv"] > div > div > div > div[data-testid]',
              // Timeline specific selectors
              '[aria-label="Timeline: Search timeline"] > div > div > div > div',
              // Еще более специфичные селекторы для Twitter
              '[data-testid="tweetText"]',
              'a[href*="/status/"]',
              'div[lang]'
            ];
            
            // Join selectors with commas for a single query
            const allTweetSelector = tweetSelectors.join(', ');
            const tweetElements = document.querySelectorAll(allTweetSelector);
            
            console.log(`📊 Found ${tweetElements.length} potential tweets on page`);
            let newTweetsCount = 0;
            
            // Выводим детальную информацию о элементах на странице для отладки
            console.log(`🔍 Current page URL: ${window.location.href}`);
            console.log(`🔍 Current page title: ${document.title}`);
            
            // Если твитов нет, давайте проверим структуру страницы
            if (tweetElements.length === 0) {
                console.log("🔍 Page structure analysis for debugging:");
                console.log(`🔍 Articles: ${document.querySelectorAll('article').length}`);
                console.log(`🔍 Role="article": ${document.querySelectorAll('[role="article"]').length}`);
                console.log(`🔍 CellInnerDiv: ${document.querySelectorAll('[data-testid^="cellInnerDiv"]').length}`);
                console.log(`🔍 Status links: ${document.querySelectorAll('a[href*="/status/"]').length}`);
                
                // Если мы на странице поиска и не находим твитов, возможно нужно переключиться на вкладку Latest
                if (window.location.href.includes('twitter.com/search')) {
                    console.log("🔄 Search page detected without tweets, trying to switch to Latest tab");
                    const tabs = document.querySelectorAll('[role="tab"]');
                    if (tabs.length >= 2) {
                        console.log("🔄 Clicking on 'Latest' tab");
                        tabs[1].click();
                        
                        // После переключения вкладки нужно дать контенту загрузиться
                        setTimeout(() => {
                            console.log("🔄 Re-scanning for tweets after switching tab");
                            window.detectNewTweets();
                        }, 2000);
                    }
                }
            }
            
            tweetElements.forEach(tweetElement => {
              try {
                // First, try to get the official Twitter ID (most reliable)
                let tweetId = null;
                let statusLink = tweetElement.querySelector('a[href*="/status/"]');
                
                if (statusLink) {
                  const href = statusLink.getAttribute('href');
                  const match = href.match(/\/status\/(\d+)/);
                  if (match && match[1]) {
                    tweetId = `tweet_${match[1]}`;
                  }
                }
                
                // If we can't find an ID, skip this element
                if (!tweetId) {
                  return;
                }
                
                // Skip if we've already processed this tweet
                if (window.processedTweetIds.has(tweetId)) {
                  return;
                }
                
                // Get tweet text
                let tweetText = '';
                const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
                if (tweetTextElement) {
                  tweetText = tweetTextElement.textContent.trim();
                } else {
                  // Try alternative ways to get text
                  const langElements = tweetElement.querySelectorAll('[lang]');
                  for (const el of langElements) {
                    const text = el.textContent.trim();
                    if (text.length > tweetText.length) {
                      tweetText = text;
                    }
                  }
                  
                  // If still no text, get the main content
                  if (!tweetText) {
                    const allDivs = Array.from(tweetElement.querySelectorAll('div'))
                      .filter(div => div.children.length && div.textContent.length > 20);
                      
                    if (allDivs.length) {
                      // Sort by text length to find the main content
                      allDivs.sort((a, b) => b.textContent.length - a.textContent.length);
                      tweetText = allDivs[0].textContent.trim();
                    }
                  }
                }
                
                // Skip tweets with no text
                if (!tweetText) {
                  return;
                }
                
                // Use content fingerprinting to detect duplicates
                const fingerprint = tweetText.substring(0, 50).toLowerCase();
                if (window.seenTweetTexts.has(fingerprint)) {
                  console.log(`⚠️ Skipping duplicate tweet content: ${fingerprint.substring(0, 20)}...`);
                  return;
                }
                
                // Get author
                let author = "Unknown Author";
                const nameElement = tweetElement.querySelector('[data-testid="User-Name"]');
                if (nameElement) {
                  const nameLink = nameElement.querySelector('a[role="link"]');
                  if (nameLink) {
                    author = nameLink.textContent.trim();
                  }
                }
                
                // Get timestamp
                let timestamp = Date.now();
                const timeElement = tweetElement.querySelector('time');
                if (timeElement && timeElement.getAttribute('datetime')) {
                  timestamp = new Date(timeElement.getAttribute('datetime')).getTime();
                }
                
                // Mark as processed
                window.processedTweetIds.add(tweetId);
                window.seenTweetTexts.set(fingerprint, tweetId);
                
                // Limit the size of our sets to prevent memory issues
                if (window.processedTweetIds.size > 5000) {
                  // Convert to array, remove oldest entries
                  const idsArray = Array.from(window.processedTweetIds);
                  window.processedTweetIds = new Set(idsArray.slice(-2500));
                  console.log(`♻️ Cleaned tweet ID cache: ${idsArray.length} -> ${window.processedTweetIds.size}`);
                }
                
                if (window.seenTweetTexts.size > 1000) {
                  // Keep only the most recent 500 entries
                  const entries = Array.from(window.seenTweetTexts.entries());
                  window.seenTweetTexts = new Map(entries.slice(-500));
                }
                
                // Create tweet data
                const tweetData = {
                  id: tweetId,
                  text: tweetText,
                  author: author,
                  timestamp: timestamp
                };
                
                // Add visual highlight to show we detected this tweet
                tweetElement.style.border = '2px solid #1DA1F2';
                tweetElement.style.boxShadow = '0 0 5px rgba(29, 161, 242, 0.7)';
                tweetElement.style.transition = 'all 0.5s ease';
                
                setTimeout(() => {
                  tweetElement.style.border = '';
                  tweetElement.style.boxShadow = '';
                }, 5000);
                
                // Send tweet data to main process using all available methods
                console.log(`🔔 NEW TWEET DETECTED: ${tweetId} - ${tweetText.substring(0, 30)}...`);
                
                // Method 1: Window postMessage
                window.postMessage({
                  type: 'post-detected',
                  postData: tweetData
                }, '*');
                
                // Method 2: Direct API call if available
                if (window.electronAPI && typeof window.electronAPI.sendTweet === 'function') {
                  window.electronAPI.sendTweet(tweetData);
                }
                
                // Method 3: Custom global function
                if (typeof window.sendPostToMain === 'function') {
                  window.sendPostToMain(tweetData);
                }
                
                // Store for debugging
                window.lastDetectedTweet = tweetData;
                
                // Keep track of tweets found in this scan
                newTweetsCount++;
              } catch (err) {
                console.error("❌ Error processing tweet element:", err);
              }
            });
            
            if (newTweetsCount > 0) {
              console.log(`🎉 Detected ${newTweetsCount} new tweets in this scan!`);
              
              // Show visual feedback for tweet detection
              const notification = document.createElement('div');
              Object.assign(notification.style, {
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                backgroundColor: '#1DA1F2',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '30px',
                zIndex: '9999',
                fontWeight: 'bold',
                boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
                animation: 'fadeInOut 3s forwards'
              });
              
              notification.textContent = `🎉 Найдено ${newTweetsCount} новых твитов!`;
              document.body.appendChild(notification);
              
              // Add animation
              const style = document.createElement('style');
              style.textContent = `
                @keyframes fadeInOut {
                  0% { opacity: 0; transform: translateY(20px); }
                  20% { opacity: 1; transform: translateY(0); }
                  80% { opacity: 1; transform: translateY(0); }
                  100% { opacity: 0; transform: translateY(-20px); }
                }
              `;
              document.head.appendChild(style);
              
              setTimeout(() => {
                notification.remove();
                style.remove();
              }, 3000);
            }
            
            return newTweetsCount;
          };
          
          // Timeline refresh function (for browser context)
          window.refreshTwitterTimeline = function() {
            console.log("🔄 Page refresh initiated (20 second interval)");
            
            try {
              // Method 1: Try to find and click refresh button first
              const refreshButton = document.querySelector('[data-testid="refresh"]');
              if (refreshButton) {
                console.log("🔄 Found refresh button, clicking");
                refreshButton.click();
                
                // After refresh, check for tweets
                setTimeout(() => {
                  window.detectNewTweets();
                }, 500);
                return true;
              }
              
              // Method 2: Request a full page reload from the main process
              console.log("🔄 No refresh button found, requesting full page reload");
              
              // Use a custom event to signal that we want a page reload
              window.postMessage({
                type: 'request-page-reload',
                timestamp: Date.now()
              }, '*');
              
              return true;
            } catch (err) {
              console.error("❌ Error refreshing timeline:", err);
              return false;
            }
          };
          
          // Advanced timeline scrolling
          window.smartScrollTimeline = function() {
            console.log("📜 Smart timeline scrolling initiated");
            
            const maxScrollIterations = 3;
            let scrollCount = 0;
            
            const performScroll = () => {
              if (scrollCount >= maxScrollIterations) {
                // After finishing all scrolls, detect tweets once more
                window.detectNewTweets();
                return;
              }
              
              // Get current scroll position
              const beforeScrollY = window.scrollY;
              
              // Scroll down by a significant amount
              window.scrollBy(0, 1000);
              scrollCount++;
              
              // After a short delay, check if the scroll was effective
              setTimeout(() => {
                const afterScrollY = window.scrollY;
                const scrollDifference = afterScrollY - beforeScrollY;
                
                console.log(`📜 Scroll attempt ${scrollCount}/${maxScrollIterations}: moved ${scrollDifference}px`);
                
                // If we couldn't scroll much, we may be at the bottom
                if (scrollDifference < 100 && scrollCount < maxScrollIterations) {
                  console.log("📜 Reached apparent bottom, refreshing timeline");
                  window.refreshTwitterTimeline();
                  return;
                }
                
                // Check for new tweets after each scroll
                window.detectNewTweets();
                
                // Continue scrolling after a short delay
                setTimeout(performScroll, 800);
              }, 500);
            };
            
            // Start the scrolling process
            performScroll();
          };
          
          // Set up the main MutationObserver
          window.advancedTwitterObserver = new MutationObserver((mutations) => {
            // Check if any of the mutations add nodes that might be tweets
            const hasPotentialTweets = mutations.some(mutation => {
              return mutation.type === 'childList' && 
                     mutation.addedNodes.length > 0 &&
                     Array.from(mutation.addedNodes).some(node => {
                       // Only process Element nodes
                       return node.nodeType === 1 && (
                         // Check for potential tweet indicators
                         node.querySelector('article') ||
                         node.querySelector('[data-testid="tweet"]') ||
                         node.querySelector('[data-testid="tweetText"]') ||
                         node.matches('[data-testid="cellInnerDiv"]') ||
                         node.querySelector('time')
                       );
                     });
            });
            
            if (hasPotentialTweets) {
              console.log("👀 MutationObserver detected potential new tweets");
              window.detectNewTweets();
            }
          });
          
          // Start observing with a comprehensive configuration
          window.advancedTwitterObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
          });
          
          console.log("✅ Advanced Twitter Observer with MutationObserver is active");
          
          // Initial detection and setup
          setTimeout(() => {
            // Initial tweet detection
            window.detectNewTweets();
            
            // Make sure we're on the Latest tab
            const ensureLatestTab = () => {
              const tabs = document.querySelectorAll('[role="tab"]');
              if (tabs.length >= 2) {
                console.log("🔄 Initial switch to Latest tab");
                tabs[1].click();
                
                // After switching to Latest, scan for tweets
                setTimeout(window.detectNewTweets, 500);
              }
            };
            
            ensureLatestTab();
            
            // Set up periodic refreshes - every 20 seconds to avoid timeouts
            setInterval(window.refreshTwitterTimeline, 20000); // Refresh every 20 seconds
            setInterval(window.smartScrollTimeline, 60000);   // Smart scroll every 60 seconds
            setInterval(window.detectNewTweets, 5000);        // Regular scans every 5 seconds
            
            // Initial smart scroll
            setTimeout(window.smartScrollTimeline, 2000);
          }, 1000);
          
          return true;
        } catch (error) {
          console.error("❌ Error setting up Advanced Twitter Observer:", error);
          return false;
        }
      });
      
      if (!result) {
        log.error("Failed to inject Advanced Twitter Observer");
        return false;
      }
      
      log.info("Advanced Twitter Observer successfully injected");
      return true;
    }

    // Сохраняем ссылку на функцию глобально
    injectObserverFn = injectObserver;

    // Expose a function to receive post data from the page, но только если она еще не зарегистрирована
    try {
      // Проверяем, существует ли уже эта функция в контексте страницы
      const functionExists = await page.evaluate(() => {
        return typeof window.sendPostToMain === 'function';
      }).catch(() => false);

      if (!functionExists) {
        await page.exposeFunction('sendPostToMain', (postData) => {
          log.info("NEW TWEET RECEIVED: " + (postData.text ? postData.text.substring(0, 50) + "..." : "No text"));
          
          // Make sure data has the right format
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
        log.info("Successfully registered sendPostToMain function");
      } else {
        log.info("sendPostToMain function already exists, skipping registration");
      }
    } catch (exposeFunctionError) {
      log.error("Error while exposing sendPostToMain function:", exposeFunctionError);
      // Продолжаем выполнение, так как основная функциональность может работать и без этого
    }

    // Initial injection and initialization
    await injectObserver();
    
    // Start the refresh interval
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
    }
    refreshIntervalId = setInterval(refreshPage, 20000);
    
    log.info("TWEET MONITORING CONFIGURED - UPDATING EVERY 20 SECONDS");
    return true;
  } catch (error) {
    log.error("ERROR SETTING UP MONITORING:", error);
    return false;
  }
}

// Функция для получения информации о профиле пользователя (подписчики и подписки)
async function fetchTwitterProfileInfo(username) {
  try {
    if (!browser) {
      log.error("Browser not initialized, can't fetch profile info");
      return null;
    }
    
    log.info(`Fetching profile info for user: ${username}`);
    
    // Если имя пользователя начинается с @, удаляем его
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    
    // Проверяем, есть ли активная страница поиска Twitter
    if (!page) {
      log.error("No active Twitter page found for hovering user profiles");
      return { followers: 0, following: 0, verified: false };
    }
    
    // Используем существующую страницу для получения информации о профиле через всплывающую карточку
    const profileInfo = await page.evaluate(async (username) => {
      try {
        console.log(`Trying to fetch profile info for ${username} using profile card`);
        
        // Ищем элементы с текстом, содержащим имя пользователя
        const possibleProfileLinks = Array.from(document.querySelectorAll('a[role="link"]'))
          .filter(el => {
            const text = el.textContent.trim().toLowerCase();
            return text.includes(`@${username.toLowerCase()}`) || 
                   text === username.toLowerCase();
          });
        
        if (possibleProfileLinks.length === 0) {
          console.log(`No profile links found for @${username}`);
          return { followers: 0, following: 0, verified: false };
        }
        
        // Берем первый найденный элемент
        const profileLink = possibleProfileLinks[0];
        console.log(`Found profile link for @${username}`);
        
        // Создаем функцию для эмуляции наведения курсора
        function simulateHover(element) {
          const event = new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          element.dispatchEvent(event);
        }
        
        // Функция для ожидания появления профильной карточки
        function waitForProfileCard() {
          return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              // Проверяем, появилась ли карточка профиля
              const card = document.querySelector('[data-testid="hover-card"], [role="tooltip"], [role="dialog"][aria-modal="false"]');
              if (card) {
                clearInterval(checkInterval);
                resolve(card);
              }
            }, 100);
            
            // Таймаут, чтобы не ждать вечно
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve(null);
            }, 2000);
          });
        }
        
        // Эмулируем наведение курсора
        simulateHover(profileLink);
        console.log(`Hovering over profile link for @${username}`);
        
        // Ждем появления карточки профиля
        const profileCard = await waitForProfileCard();
        
        if (!profileCard) {
          console.log(`Profile card did not appear for @${username}`);
          return { followers: 0, following: 0, verified: false };
        }
        
        console.log(`Profile card appeared for @${username}`);
        
        // Извлекаем данные о подписчиках и подписках
        const statElements = profileCard.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
        
        let followers = 0;
        let following = 0;
        
        statElements.forEach(element => {
          const text = element.textContent.trim();
          const href = element.getAttribute('href') || '';
          
          // Проверяем, содержит ли элемент число
          const numMatch = text.match(/(\d+(?:[,.]\d+)*)/);
          if (!numMatch) return;
          
          // Обрабатываем число, удаляя запятые и обрабатывая сокращения
          let numStr = numMatch[1].replace(/,/g, '');
          let multiplier = 1;
          
          if (text.includes('K') || text.includes('k')) {
            multiplier = 1000;
            numStr = numStr.replace(/[kK]/g, '');
          } else if (text.includes('M') || text.includes('m')) {
            multiplier = 1000000;
            numStr = numStr.replace(/[mM]/g, '');
          }
          
          const value = parseFloat(numStr) * multiplier;
          
          // Определяем тип статистики на основе URL
          if (href.includes('/followers')) {
            followers = value;
          } else if (href.includes('/following')) {
            following = value;
          }
        });
        
        // Проверяем, верифицирован ли аккаунт
        const verified = profileCard.querySelector('[data-testid="icon-verified"]') !== null;
        
        console.log(`Found profile stats for @${username}: ${followers} followers, ${following} following, verified: ${verified}`);
        
        // Скрываем карточку профиля (кликаем в сторону)
        document.body.click();
        
        return { followers, following, verified };
      } catch (error) {
        console.error(`Error parsing profile card for @${username}:`, error);
        return { followers: 0, following: 0, verified: false };
      }
    }, username);
    
    log.info(`Profile card info fetched for ${username}: ${profileInfo.followers} followers, ${profileInfo.following} following, verified: ${profileInfo.verified}`);
    
    return profileInfo;
  } catch (error) {
    log.error(`Error fetching profile info for ${username}:`, error);
    return { followers: 0, following: 0, verified: false };
  }
}

// Добавляем IPC метод для получения информации о профиле
ipcMain.handle('get-twitter-profile-info', async (event, username) => {
  try {
    const profileInfo = await fetchTwitterProfileInfo(username);
    return { success: true, profileInfo };
  } catch (error) {
    log.error(`Error in get-twitter-profile-info handler:`, error);
    return { success: false, error: error.message };
  }
});

// Gemini API implementation
async function analyzeTextWithGemini(apiKey, tweets, coinName) {
  try {
    if (!apiKey) {
      aiLog.error('Gemini API key missing');
      return {
        success: false,
        error: 'Gemini API key is missing. Please add it in Settings.'
      };
    }
    
    aiLog.info(`Starting analysis with Gemini API for ${tweets.length} tweets about ${coinName || 'unknown coin'}`);
    
    // Формируем текст для анализа из твитов
    const tweetTexts = tweets.map(tweet => tweet.text || '').filter(text => text.trim() !== '');
    
    if (tweetTexts.length === 0) {
      aiLog.error('No tweet texts to analyze');
      return {
        success: false,
        error: 'No tweets to analyze.'
      };
    }
    
    // Объединяем твиты в один текст для анализа
    const tweetsContent = tweetTexts.join('\n\n');
    aiLog.info(`Prepared ${tweetTexts.length} tweets for analysis, total length: ${tweetsContent.length} chars`);
    
    // Определяем промпт для Gemini (ключи и значения-энумы на английском, тексты — на русском)
    const prompt = `
    You are a financial sentiment analysis expert. Analyze the following tweets about the cryptocurrency ${coinName || 'coin'}.

    Requirements:
    - Keep JSON field names and sentiment enum values in English exactly as specified.
    - Provide narrative text fields (insights and keyPhrases content) in Russian.
    - Percentages must be integers that sum to 100.

    Return a JSON with this schema:
    {
      "sentiment": "positive" | "neutral" | "negative",
      "sentimentBreakdown": {
        "positive": 33,
        "neutral": 34,
        "negative": 33
      },
      "insights": "Краткое резюме на русском...",
      "keyPhrases": ["ключевая фраза 1", "ключевая фраза 2", "ключевая фраза 3"]
    }

    Analyze these tweets:
    ${tweetsContent}
    `;
    
    aiLog.info(`Sending request to Gemini API - prompt length: ${prompt.length}`);
    
    // Вызываем Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    aiLog.info(`Using Gemini API URL: ${apiUrl.replace(apiKey, "API_KEY_HIDDEN")}`);
    
    const response = await axios.post(
      apiUrl,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      }
    );
    
    aiLog.info(`Got response from Gemini API - status: ${response.status}`);
    
    // Проверяем ответ от Gemini
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0] && 
        response.data.candidates[0].content.parts[0].text) {
      
      // Извлекаем текст ответа
      const responseText = response.data.candidates[0].content.parts[0].text;
      aiLog.info(`Gemini response raw text length: ${responseText.length}`);
      
      // Пытаемся извлечь JSON из ответа с помощью регулярных выражений
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const analysisResult = JSON.parse(jsonMatch[0]);
          
          // Возвращаем результат анализа
          aiLog.info(`Successfully parsed Gemini response as JSON: ${JSON.stringify(analysisResult)}`);
          return {
            success: true,
            data: analysisResult
          };
        } catch (parseError) {
          aiLog.error('Error parsing Gemini response as JSON:', parseError);
          aiLog.info(`Raw response that couldn't be parsed: ${responseText}`);
          return {
            success: false,
            error: 'Failed to parse Gemini response',
            rawResponse: responseText
          };
        }
      } else {
        aiLog.error('No JSON found in Gemini response');
        aiLog.info(`Raw response without valid JSON: ${responseText}`);
        return {
          success: false,
          error: 'Invalid response format from Gemini',
          rawResponse: responseText
        };
      }
    } else {
      aiLog.error('Invalid response structure from Gemini:', JSON.stringify(response.data || {}));
      return {
        success: false,
        error: 'Invalid response from Gemini API'
      };
    }
  } catch (error) {
    aiLog.error('Error calling Gemini API:', error);
    if (error.response) {
      aiLog.error(`Gemini API error details: status=${error.response.status}, data=${JSON.stringify(error.response.data || {})}`);
    }
    return {
      success: false,
      error: error.message || 'Failed to communicate with Gemini API'
    };
  }
}

// Добавляем обработчик для анализа твитов с Gemini
ipcMain.handle('analyze-tweets-with-gemini', async (event, { apiKey, tweets, coinName }) => {
  try {
    return await analyzeTextWithGemini(apiKey, tweets, coinName);
  } catch (error) {
    aiLog.error('Error in analyze-tweets-with-gemini handler:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during analysis'
    };
  }
});

// Add handlers for Gemini API key storage in application settings
ipcMain.handle('get-gemini-api-key', async () => {
  try {
    // Get API key from electron-store
    return store.get('geminiApiKey', '');
  } catch (error) {
    aiLog.error('Error getting Gemini API key from store:', error);
    return '';
  }
});

ipcMain.handle('save-gemini-api-key', async (event, apiKey) => {
  try {
    // Save API key to electron-store
    store.set('geminiApiKey', apiKey);
    return { success: true };
  } catch (error) {
    aiLog.error('Error saving Gemini API key to store:', error);
    return { success: false, error: error.message };
  }
});

// Add handler to get search keywords
ipcMain.handle('get-keywords', async () => {
  try {
    // Get keywords from electron-store
    return store.get('keywords', []);
  } catch (error) {
    log.error('Error getting keywords from store:', error);
    return [];
  }
});