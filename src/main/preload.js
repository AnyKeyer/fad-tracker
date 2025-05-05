// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Debug message for preload loading
console.log('Preload script is running');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    startAnalysis: (params) => ipcRenderer.invoke('start-analysis', params),
    stopAnalysis: () => ipcRenderer.invoke('stop-analysis'),
    saveTwitterSession: () => ipcRenderer.invoke('save-twitter-session'),
    twitterLogin: () => {
      console.log('Twitter login method called');
      return ipcRenderer.invoke('twitter-login');
    },
    twitterLogout: () => ipcRenderer.invoke('twitter-logout'),
    checkTwitterLoginStatus: () => ipcRenderer.invoke('check-twitter-login-status'),
    getTwitterUserInfo: () => ipcRenderer.invoke('get-twitter-user-info'),
    getTwitterCookies: () => ipcRenderer.invoke('get-twitter-cookies'),
    getTwitterProfileInfo: (username) => ipcRenderer.invoke('get-twitter-profile-info', username),
    onPostData: (callback) => ipcRenderer.on('post-data', (_, data) => callback(data)),
    onBrowserTarget: (callback) => ipcRenderer.on('browser-target', (_, targetId) => callback(targetId)),
    onSearchInfo: (callback) => ipcRenderer.on('search-info', (_, info) => callback(info)),
    sendPostDetected: (postData) => ipcRenderer.send('post-detected', postData)
  }
);

// Also expose a direct method for Puppeteer to use
contextBridge.exposeInMainWorld('electronAPI', {
  // Direct method to send tweet data
  sendTweet: (tweetData) => {
    console.log('Direct electronAPI.sendTweet called with:', tweetData);
    ipcRenderer.send('post-detected', tweetData);
  }
});

// API availability check
setTimeout(() => {
  console.log('API initialization check:', !!window.api);
  console.log('ElectronAPI initialization check:', !!window.electronAPI);
}, 1000);

// Listen for messages from TwitterPostObserver and pass them to the main process
window.addEventListener('message', (event) => {
  // Check if the message is from our TwitterPostObserver script
  if (event.data && event.data.type === 'post-detected') {
    try {
      const postData = event.data.postData;
      
      // Log to console for debugging
      console.log(`Received post data from TwitterPostObserver: ${postData.id}`);
      console.log(`Post text: ${postData.text ? postData.text.substring(0, 50) + "..." : "No text"}`);
      
      // Convert strings to Buffer and back to ensure proper encoding
      if (postData.text) {
        const buffer = Buffer.from(postData.text, 'utf8');
        postData.text = buffer.toString('utf8');
      }
      
      if (postData.author) {
        const buffer = Buffer.from(postData.author, 'utf8');
        postData.author = buffer.toString('utf8');
      }
      
      // Ensure all required fields are present
      const validatedData = {
        id: postData.id || `tweet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        text: postData.text || 'No content',
        timestamp: postData.timestamp || Date.now(),
        author: postData.author || 'Unknown Author'
      };
      
      // Pass the data to the main process
      ipcRenderer.send('post-detected', validatedData);
    } catch (error) {
      console.error('Error handling message in preload.js:', error);
    }
  }
  // Обработка запроса на перезагрузку страницы
  else if (event.data && event.data.type === 'request-page-reload') {
    try {
      console.log('Page reload requested from TwitterPostObserver');
      // Отправляем событие в main процесс, чтобы перезагрузить страницу
      ipcRenderer.send('request-page-reload', {
        timestamp: event.data.timestamp || Date.now()
      });
    } catch (error) {
      console.error('Error handling page reload request in preload.js:', error);
    }
  }
});