// Configuration file for environment variables and constants
class Config {
  constructor() {
    // Default configuration
    this.defaults = {
      OLLAMA_API_URL: 'http://localhost:11434/api/generate',
      MODEL_NAME: 'mistral',
      MAX_CONTENT_LENGTH: 4000,
      STORAGE_KEY_PREFIX: 'config_',
      REQUEST_TIMEOUT: 30000, // 30 seconds
      FALLBACK_SELECTORS: [
        'main',
        'article',
        '.content',
        '#content',
        '.post-content',
        '.entry-content',
        'body'
      ]
    };
  }

  // Get configuration value with environment variable override support
  get(key) {
    // In Chrome extensions, we can't access process.env directly
    // Instead, we'll check chrome.storage for user-configured values
    return this.defaults[key];
  }

  // Set configuration value (for user customization)
  async set(key, value) {
    try {
      await chrome.storage.sync.set({ [`config_${key}`]: value });
      this.defaults[key] = value;
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  // Load user-configured values from storage
  async load() {
    try {
      const keys = Object.keys(this.defaults).map(key => `config_${key}`);
      const data = await chrome.storage.sync.get(keys);
      
      Object.keys(this.defaults).forEach(key => {
        const storageKey = `config_${key}`;
        if (data[storageKey] !== undefined) {
          this.defaults[key] = data[storageKey];
        }
      });
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  // Get API endpoint URL
  getApiUrl() {
    return this.get('OLLAMA_API_URL');
  }

  // Get model name
  getModelName() {
    return this.get('MODEL_NAME');
  }

  // Get maximum content length
  getMaxContentLength() {
    return this.get('MAX_CONTENT_LENGTH');
  }

  // Get storage key prefix
  getStorageKeyPrefix() {
    return this.get('STORAGE_KEY_PREFIX');
  }

  // Get request timeout
  getRequestTimeout() {
    return this.get('REQUEST_TIMEOUT');
  }

  // Get fallback selectors
  getFallbackSelectors() {
    return this.get('FALLBACK_SELECTORS');
  }
}

// Create singleton instance
const config = new Config();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = config;
} else {
  window.Config = config;
}
