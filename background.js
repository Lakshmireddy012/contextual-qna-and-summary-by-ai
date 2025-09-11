// Background service worker with improved structure and configuration support

// Import configuration (will be loaded when needed)
let config = null;
let apiService = null;

// Initialize configuration and services
async function initializeServices() {
  if (!config) {
    // Load configuration defaults
    config = {
      getApiUrl: () => 'http://localhost:11434/api/generate',
      getModelName: () => 'mistral',
      getRequestTimeout: () => 30000
    };

    // Create API service
    apiService = {
      async generateResponse(prompt, options = {}) {
        const apiUrl = config.getApiUrl();
        const modelName = options.model || config.getModelName();
        const timeout = options.timeout || config.getRequestTimeout();

        const payload = {
          model: modelName,
          prompt: prompt,
          stream: false,
          ...options.additionalParams
        };

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...options.headers
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          return data?.response || 'No response received';

        } catch (error) {
          if (error.name === 'AbortError') {
            throw new Error('Request timeout');
          }
          throw error;
        }
      }
    };
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await initializeServices();
    
    // Create context menu item
    chrome.contextMenus.create({
      id: "askContextualAI",
      title: "Ask Contextual AI",
      contexts: ["selection"]
    });

  } catch (error) {
    console.error('Extension installation failed:', error);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "askContextualAI" && info.selectionText) {
    try {
      // Send selected text to content script to show modal
      await chrome.tabs.sendMessage(tab.id, {
        action: "showContextualModal",
        selectedText: info.selectionText
      });
    } catch (error) {
      console.error('Failed to send message to content script:', error);
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async operations
  (async () => {
    try {
      await initializeServices();

      if (request.action === "analyzeWithLLM") {
        const response = await apiService.generateResponse(request.prompt, {
          model: request.model,
          timeout: request.timeout,
          additionalParams: request.additionalParams,
          headers: request.headers
        });

        sendResponse({ 
          success: true, 
          response: response,
          timestamp: new Date().toISOString()
        });

      } else if (request.action === "testConnection") {
        const testResponse = await apiService.generateResponse('Test connection. Respond with "OK"', {
          timeout: 5000
        });

        sendResponse({ 
          success: true, 
          response: testResponse,
          message: 'Connection successful'
        });

      } else if (request.action === "getConfig") {
        sendResponse({
          success: true,
          config: {
            apiUrl: config.getApiUrl(),
            modelName: config.getModelName(),
            timeout: config.getRequestTimeout()
          }
        });

      } else if (request.action === "updateConfig") {
        // Handle configuration updates
        if (request.config) {
          // Store updated configuration
          await chrome.storage.sync.set({
            'config_OLLAMA_API_URL': request.config.apiUrl,
            'config_MODEL_NAME': request.config.modelName,
            'config_REQUEST_TIMEOUT': request.config.timeout
          });

          sendResponse({
            success: true,
            message: 'Configuration updated successfully'
          });
        } else {
          sendResponse({
            success: false,
            error: 'Configuration data required'
          });
        }

      } else if (request.action === "openSettings") {
        // Open settings page
        try {
          await chrome.tabs.create({ 
            url: chrome.runtime.getURL('settings.html'),
            active: true
          });
          
          sendResponse({
            success: true,
            message: 'Settings page opened'
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: `Failed to open settings: ${error.message}`
          });
        }

      } else if (request.action === "checkFirstTimeSetup") {
        // Check if this is first time setup
        try {
          const data = await chrome.storage.sync.get(['config_OLLAMA_API_URL', 'config_MODEL_NAME']);
          const hasCustomConfig = data.config_OLLAMA_API_URL || data.config_MODEL_NAME;
          
          sendResponse({
            success: true,
            isFirstTime: !hasCustomConfig,
            hasCustomConfig: !!hasCustomConfig
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message
          });
        }

      } else {
        sendResponse({
          success: false,
          error: `Unknown action: ${request.action}`
        });
      }

    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        details: error.stack
      });
    }
  })();

  // Return true to indicate we will send a response asynchronously
  return true;
});

// Handle extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    await initializeServices();
  } catch (error) {
    console.error('Extension startup failed:', error);
  }
});

// Handle tab updates (optional - for future features)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Could be used for auto-configuration detection
  if (changeInfo.status === 'complete' && tab.url) {
    // Future: Auto-detect content patterns and suggest configurations
  }
});

// Utility function to validate API endpoint
function isValidApiUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Utility function to get extension version
function getExtensionVersion() {
  return chrome.runtime.getManifest().version;
}

// Export utilities for potential use (though not directly accessible in service worker context)
const BackgroundUtils = {
  initializeServices,
  isValidApiUrl,
  getExtensionVersion
};