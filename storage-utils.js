// Storage utilities for managing website-specific configurations
class StorageUtils {
  constructor(config) {
    this.config = config;
    this.keyPrefix = config.getStorageKeyPrefix();
  }

  // Generate storage key for a website origin
  getWebsiteKey(origin) {
    return `${this.keyPrefix}${origin}`;
  }

  // Load website-specific configuration
  async loadWebsiteConfig(origin) {
    if (!origin) {
      return { questions: [], targetSelector: '' };
    }

    try {
      const key = this.getWebsiteKey(origin);
      const data = await chrome.storage.sync.get([key]);
      
      const config = data[key] || { questions: [], targetSelector: '' };
      
      // Ensure the config has the expected structure
      return {
        questions: Array.isArray(config.questions) ? config.questions : [],
        targetSelector: typeof config.targetSelector === 'string' ? config.targetSelector : '',
        ...config
      };
    } catch (error) {
      console.error('Error loading website config:', error);
      return { questions: [], targetSelector: '' };
    }
  }

  // Save website-specific configuration
  async saveWebsiteConfig(origin, config) {
    if (!origin) {
      throw new Error('Origin is required to save configuration');
    }

    try {
      const key = this.getWebsiteKey(origin);
      const dataToSave = {
        questions: Array.isArray(config.questions) ? config.questions : [],
        targetSelector: typeof config.targetSelector === 'string' ? config.targetSelector : '',
        lastUpdated: new Date().toISOString(),
        ...config
      };
      
      await chrome.storage.sync.set({ [key]: dataToSave });
      return { success: true };
    } catch (error) {
      console.error('Error saving website config:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete website-specific configuration
  async deleteWebsiteConfig(origin) {
    if (!origin) {
      throw new Error('Origin is required to delete configuration');
    }

    try {
      const key = this.getWebsiteKey(origin);
      await chrome.storage.sync.remove([key]);
      return { success: true };
    } catch (error) {
      console.error('Error deleting website config:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all configured websites
  async getAllWebsiteConfigs() {
    try {
      const allData = await chrome.storage.sync.get();
      const websites = {};
      
      Object.keys(allData).forEach(key => {
        if (key.startsWith(this.keyPrefix)) {
          const origin = key.substring(this.keyPrefix.length);
          websites[origin] = allData[key];
        }
      });
      
      return websites;
    } catch (error) {
      console.error('Error getting all website configs:', error);
      return {};
    }
  }

  // Add question to website configuration
  async addQuestion(origin, question) {
    if (!origin || !question?.trim()) {
      return { success: false, error: 'Origin and question are required' };
    }

    try {
      const config = await this.loadWebsiteConfig(origin);
      const trimmedQuestion = question.trim();
      
      // Avoid duplicates
      if (!config.questions.includes(trimmedQuestion)) {
        config.questions.push(trimmedQuestion);
        await this.saveWebsiteConfig(origin, config);
      }
      
      return { success: true, config };
    } catch (error) {
      console.error('Error adding question:', error);
      return { success: false, error: error.message };
    }
  }

  // Remove question from website configuration
  async removeQuestion(origin, questionIndex) {
    if (!origin || typeof questionIndex !== 'number') {
      return { success: false, error: 'Origin and question index are required' };
    }

    try {
      const config = await this.loadWebsiteConfig(origin);
      
      if (questionIndex >= 0 && questionIndex < config.questions.length) {
        config.questions.splice(questionIndex, 1);
        await this.saveWebsiteConfig(origin, config);
      }
      
      return { success: true, config };
    } catch (error) {
      console.error('Error removing question:', error);
      return { success: false, error: error.message };
    }
  }

  // Update target selector for website
  async updateTargetSelector(origin, targetSelector) {
    if (!origin) {
      return { success: false, error: 'Origin is required' };
    }

    try {
      const config = await this.loadWebsiteConfig(origin);
      config.targetSelector = typeof targetSelector === 'string' ? targetSelector.trim() : '';
      await this.saveWebsiteConfig(origin, config);
      
      return { success: true, config };
    } catch (error) {
      console.error('Error updating target selector:', error);
      return { success: false, error: error.message };
    }
  }

  // Get storage usage information
  async getStorageInfo() {
    try {
      const bytesInUse = await chrome.storage.sync.getBytesInUse();
      const quota = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
      
      return {
        used: bytesInUse,
        total: quota,
        available: quota - bytesInUse,
        percentUsed: Math.round((bytesInUse / quota) * 100)
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUtils;
} else {
  window.StorageUtils = StorageUtils;
}
