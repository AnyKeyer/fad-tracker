// Twitter post observer utility
class TwitterPostObserver {
  constructor(options = {}) {
    this.options = {
      postSelector: 'article', // Twitter posts are wrapped in article tags
      contentSelector: '[data-testid="tweetText"]', // Tweet content selector
      pollingInterval: 1000, // Check for new posts every second
      refreshInterval: 30000, // Refresh the timeline every 30 seconds
      askContinue: false, // Whether to ask before continuing iterations
      askContinueInterval: 300000, // Ask every 5 minutes by default
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
      // Wait for a moment to make sure the page is loaded
      setTimeout(() => {
        // Find and click the "Latest" tab
        const latestTabSelector = [
          'a[href*="f=live"]', 
          '[role="tab"][data-testid*="latest"]',
          '[role="tab"]:nth-child(2)',
          '[data-testid="ScrollSnap-List"] > div:nth-child(2)',
          'nav > div > div > a:nth-child(2)'
        ].join(', ');
        
        const latestTab = document.querySelector(latestTabSelector);
        
        if (latestTab) {
          console.log("📊 Found 'Latest' tab, clicking");
          latestTab.click();
          this.initialized = true;
        } else {
          console.log("📊 Can't find 'Latest' tab, trying alternative methods");
          // Try to find top tab elements for inspection
          const tabs = document.querySelectorAll('[role="tab"]');
          console.log(`📊 Found ${tabs.length} potential tabs`);
          if (tabs.length >= 2) {
            console.log("📊 Clicking on second tab, which is likely 'Latest'");
            tabs[1].click();
            this.initialized = true;
          }
        }
      }, 3000);
    } catch (error) {
      console.error("❌ Error switching to 'Latest' tab:", error);
    }
  }
  
  // Refresh the timeline to get new tweets
  refreshTimeline() {
    try {
      console.log("📊 Refreshing Twitter timeline...");
      
      // Method 1: Try to find and click refresh button
      const refreshButton = document.querySelector('[data-testid="refresh"]');
      if (refreshButton) {
        console.log("📊 Found refresh button, clicking");
        refreshButton.click();
        return;
      }
      
      // Method 2: Toggle between tabs to force a refresh
      console.log("📊 Refresh button not found, switching between tabs");
      
      // Find the tabs
      const tabs = document.querySelectorAll('[role="tab"]');
      if (tabs.length >= 2) {
        // First click "For you" tab (or first tab)
        setTimeout(() => {
          console.log("📊 Clicking first tab ('For you')");
          tabs[0].click();
          
          // Then click back to "Latest" tab after a short delay
          setTimeout(() => {
            console.log("📊 Returning to 'Latest' tab");
            tabs[1].click();
          }, 1000);
        }, 500);
      } else {
        // Method 3: Try pressing F5 key to refresh the page
        console.log("📊 Tabs not found, trying to reload the page");
        window.location.reload();
      }
    } catch (error) {
      console.error("❌ Error refreshing feed:", error);
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
    // Find all article elements (tweets) in the timeline
    const posts = document.querySelectorAll(this.options.postSelector);
    let newPostsCount = 0;
    
    // Store current check time to filter posts
    const currentCheckTime = Date.now();
    
    if (posts.length > 0) {
      console.log(`📊 Found ${posts.length} tweets in the timeline`);
    }
    
    for (let i = 0; i < posts.length; i++) {
      try {
        const post = posts[i];
        const postId = this.getPostId(post);
        
        // Skip already processed posts
        if (!postId || this.knownPostIds.has(postId)) {
          continue;
        }
        
        // Get post content and metadata before adding to known posts
        const content = this.getPostContent(post);
        const timestamp = this.getPostTimestamp(post);
        const author = this.getPostAuthor(post);
        const links = this.getPostLinks(post);
        
        // Skip if content is empty (likely an ad or non-tweet content)
        if (!content) {
          continue;
        }
        
        // Add to known posts
        this.knownPostIds.add(postId);
        newPostsCount++;
        
        console.log(`📊 Detected new tweet: ${postId.substring(0, 10)}... from ${author}`);
        
        // Process the post
        this.processPost({
          id: postId,
          text: content,
          timestamp: timestamp,
          author: author,
          links: links
        });
      } catch (error) {
        console.error("❌ Error processing tweet:", error);
      }
    }
    
    if (newPostsCount > 0) {
      console.log(`📊 Processed ${newPostsCount} new tweets in this check`);
    }
    
    // Update last check time
    this.lastPostCheckedTime = currentCheckTime;
    
    // Clean up old post IDs to prevent memory leaks
    this.cleanupOldPosts();
  }
  
  // Extract post ID from post element
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
      
      // Get the text content and create a short hash
      const contentEl = postElement.querySelector(this.options.contentSelector);
      const contentText = contentEl ? contentEl.textContent.trim().substring(0, 40) : '';
      
      return `tweet_${timeStamp}_${contentText.replace(/\s+/g, '_').substring(0, 20)}`;
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
      // Ensure text is properly encoded
      const sanitizedPostData = {
        ...postData,
        text: this.sanitizeText(postData.text || ''),
        author: this.sanitizeText(postData.author || 'Unknown Author')
      };
      
      // Use window.postMessage for communication with the preload script
      window.postMessage({
        type: 'post-detected',
        postData: sanitizedPostData
      }, '*');
      
      console.log(`📊 Sending tweet to main process: ${sanitizedPostData.author}`);
    } catch (error) {
      console.error("❌ Error sending post data to main process:", error);
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