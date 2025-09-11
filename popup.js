// Main popup application using modular structure
class PopupApp {
  constructor() {
    // Initialize services and utilities
    this.config = null;
    this.apiService = null;
    this.storageUtils = null;
    this.contentExtractor = null;
    this.ui = null;
    
    // State
    this.currentOrigin = '';
    this.websiteConfig = {
      questions: [],
      targetSelector: ''
    };
    this.isInitialized = false;
  }

  // Initialize the application
  async init() {
    try {
      // Initialize configuration first
      this.config = window.Config;
      await this.config.load();

      // Initialize services
      this.apiService = new window.ApiService(this.config);
      this.storageUtils = new window.StorageUtils(this.config);
      this.contentExtractor = new window.ContentExtractor(this.config);
      this.ui = new window.UIUtils().init();

      // Get current website info
      const tab = await this.contentExtractor.getCurrentTab();
      if (tab) {
        this.currentOrigin = tab.origin;
        this.ui.updateWebsiteInfo(tab.origin, tab.title);
      }

      // Load website configuration
      if (this.currentOrigin) {
        this.websiteConfig = await this.storageUtils.loadWebsiteConfig(this.currentOrigin);
      }

      // Setup event listeners
      this.setupEventListeners();

      // Determine initial state and action
      await this.determineInitialState();

      this.isInitialized = true;
    } catch (error) {
      this.ui?.displayError(`Initialization failed: ${error.message}`);
    }
  }

  // Determine what to show initially
  async determineInitialState() {
    if (!this.currentOrigin) {
      this.ui.displayError('Unable to determine current website');
      return;
    }

    // Check if basic API configuration exists
    const hasApiConfig = await this.checkApiConfiguration();
    
    if (!hasApiConfig) {
      // No API configuration - check user preference for auto-redirect
      const autoRedirect = await this.getUserPreference('autoRedirectToSettings');
      this.ui.showFirstTimeSetup(autoRedirect);
      return;
    }

    // Check if website-specific configuration exists
    if (this.websiteConfig.questions.length > 0) {
      // Auto-analyze if questions exist
      await this.analyzeContent();
    } else {
      // Show configuration if no questions but API is configured
      this.showConfiguration();
    }
  }

  // Check if API configuration is properly set up
  async checkApiConfiguration() {
    try {
      const apiUrl = this.config.getApiUrl();
      const modelName = this.config.getModelName();
      
      // Check if using default values (indicates no user configuration)
      const isDefaultConfig = apiUrl === 'http://localhost:11434/api/generate' && 
                             modelName === 'mistral';
      
      if (isDefaultConfig) {
        // Test if the default configuration works
        const testResult = await this.testApiConnection(true);
        return testResult.success;
      }
      
      // User has configured custom settings, assume they're valid
      return true;
      
    } catch (error) {
      return false;
    }
  }

  // Test API connection (silent mode for auto-checks)
  async testApiConnection(silent = false) {
    try {
      if (!silent) {
        this.ui.showLoading('Testing API connection...');
      }
      
      const result = await this.apiService.testConnection();
      
      if (!silent) {
        if (result.success) {
          this.ui.showNotification('API connection successful', 'success');
        } else {
          this.ui.displayError(`API connection failed: ${result.message}`);
        }
      }
      
      return result;
    } catch (error) {
      if (!silent) {
        this.ui.displayError(`API test failed: ${error.message}`);
      }
      return { success: false, error: error.message };
    }
  }

  // Setup all event listeners
  setupEventListeners() {
    // Configure button - show configuration section
    this.ui.addEventListenerSafe('configureBtn', 'click', () => {
      this.showConfiguration();
    });

    // Add question button
    this.ui.addEventListenerSafe('addQuestionBtn', 'click', async () => {
      await this.addQuestion();
    });

    // Enter key in question input
    this.ui.addEventListenerSafe('newQuestion', 'keydown', async (e) => {
      if (e.key === 'Enter') {
        await this.addQuestion();
      }
    });

    // Target selector input change
    this.ui.addEventListenerSafe('targetSelector', 'input', async (e) => {
      await this.updateTargetSelector(e.target.value);
    });

    // Analyze button
    this.ui.addEventListenerSafe('analyzeBtn', 'click', async () => {
      await this.analyzeContent();
    });

    // Cancel button
    this.ui.addEventListenerSafe('cancelBtn', 'click', async () => {
      await this.handleCancel();
    });

  }

  // Show configuration section
  showConfiguration() {
    this.ui.showSection('config');
    this.ui.setTargetSelector(this.websiteConfig.targetSelector);
    this.renderQuestions();
    this.ui.updateAnalyzeButton(this.websiteConfig.questions.length > 0);
  }

  // Render questions list with delete functionality
  renderQuestions() {
    this.ui.renderQuestions(this.websiteConfig.questions, async (index) => {
      await this.removeQuestion(index);
    });
  }

  // Add new question
  async addQuestion() {
    const question = this.ui.getQuestionInput();
    if (!question) return;

    try {
      const result = await this.storageUtils.addQuestion(this.currentOrigin, question);
      
      if (result.success) {
        this.websiteConfig = result.config;
        this.ui.clearQuestionInput();
        this.renderQuestions();
        this.ui.updateAnalyzeButton(this.websiteConfig.questions.length > 0);
        this.ui.showNotification('Question added successfully', 'success');
      } else {
        this.ui.displayError(result.error);
      }
    } catch (error) {
      this.ui.displayError(`Failed to add question: ${error.message}`);
    }
  }

  // Remove question
  async removeQuestion(index) {
    try {
      const result = await this.storageUtils.removeQuestion(this.currentOrigin, index);
      
      if (result.success) {
        this.websiteConfig = result.config;
        this.renderQuestions();
        this.ui.updateAnalyzeButton(this.websiteConfig.questions.length > 0);
        this.ui.showNotification('Question removed', 'info');
      } else {
        this.ui.displayError(result.error);
      }
    } catch (error) {
      this.ui.displayError(`Failed to remove question: ${error.message}`);
    }
  }

  // Update target selector
  async updateTargetSelector(targetSelector) {
    try {
      const result = await this.storageUtils.updateTargetSelector(this.currentOrigin, targetSelector);
      
      if (result.success) {
        this.websiteConfig = result.config;
      }
    } catch (error) {
      // Silent fail for target selector updates
    }
  }

  // Analyze content with questions
  async analyzeContent() {
    this.ui.showLoading('Analyzing content...');

    try {
      // Validate requirements
      if (!this.currentOrigin) {
        throw new Error('No active website detected');
      }

      if (this.websiteConfig.questions.length === 0) {
        throw new Error('No questions configured for this website');
      }

      // Extract content from page
      this.ui.showLoading('Extracting content...');
      const extraction = await this.contentExtractor.extractText(this.websiteConfig.targetSelector);
      
      if (!extraction.success || !extraction.text) {
        // Provide detailed error information
        let errorMessage = 'Content extraction failed:\n\n';
        
        if (extraction.error) {
          errorMessage += `❌ Error: ${extraction.error}\n`;
        }
        
        if (extraction.source) {
          errorMessage += `📍 Source: ${extraction.source}\n`;
        }
        
        if (extraction.tab) {
          errorMessage += `🌐 Page: ${extraction.tab.title}\n`;
          errorMessage += `🔗 URL: ${extraction.tab.url}\n`;
        }
        
        // Add troubleshooting suggestions
        errorMessage += '\n💡 Try these solutions:\n';
        errorMessage += '1. Select text manually before clicking analyze\n';
        errorMessage += '2. Try common selectors: main, article, .content\n';
        errorMessage += '3. Wait for page to fully load and try again\n';
        
        if (this.websiteConfig.targetSelector) {
          errorMessage += `\nCurrent selector: "${this.websiteConfig.targetSelector}"`;
        } else {
          errorMessage += '\nNo custom selector set - using auto-detection';
        }
        
        // Add manual text input option for difficult pages like LinkedIn
        if (extraction.tab && extraction.tab.url && extraction.tab.url.includes('linkedin.com')) {
          errorMessage += '\n\n🔧 Manual Input Option:\nIf automatic extraction keeps failing, you can manually paste the text below:';
        }
        
        this.ui.displayResult(errorMessage, 'error');
        
        // Add manual input option for LinkedIn and other difficult sites
        if (extraction.tab && extraction.tab.url && (
          extraction.tab.url.includes('linkedin.com') || 
          extraction.source === 'script_error' || 
          extraction.source === 'content_script_error'
        )) {
          this.addManualInputOption();
        }
        
        
        return; // Exit early
      }

      // Analyze with API
      this.ui.showLoading('Getting AI response...');
      const analysis = await this.apiService.analyzeContent(
        extraction.text, 
        this.websiteConfig.questions
      );

      if (!analysis.success) {
        throw new Error(analysis.error || 'Analysis failed');
      }

      // Display results
      this.ui.displaySuccess(analysis.response);
      
      // Add source information with fallback notification
      let sourceInfo = `\n\n---\nContent source: ${extraction.source}\nQuestions: ${this.websiteConfig.questions.length}`;
      
      // Add special note if fallback was used
      if (extraction.note) {
        sourceInfo += `\n📝 Note: ${extraction.note}`;
      }
      
      // Add helpful message for selection fallback
      if (extraction.source && extraction.source.includes('selection_fallback')) {
        sourceInfo += '\n💡 Tip: Your selector didn\'t work, but we used your selected text instead!';
      }
      
      this.ui.elements.result.textContent += sourceInfo;

    } catch (error) {
      this.ui.displayError(error.message);
    }
  }

  // Handle cancel button
  async handleCancel() {
    if (this.websiteConfig.questions.length > 0) {
      // If questions exist, go back to analysis
      await this.analyzeContent();
    } else {
      // If no questions, show a message
      this.ui.displayResult(
        '⚠️ No questions configured. Set up questions and target selector to enable analysis.',
        'info'
      );
    }
  }


  // Get user preference
  async getUserPreference(key) {
    try {
      const data = await chrome.storage.sync.get([`pref_${key}`]);
      return data[`pref_${key}`] || false;
    } catch (error) {
      return false;
    }
  }

  // Set user preference
  async setUserPreference(key, value) {
    try {
      await chrome.storage.sync.set({ [`pref_${key}`]: value });
    } catch (error) {
      // Silent fail for preference updates
    }
  }

  // Add manual input option when extraction fails
  addManualInputOption() {
    // Check if manual input already exists
    if (document.getElementById('manualTextInput')) {
      return;
    }

    const manualInputDiv = document.createElement('div');
    manualInputDiv.style.cssText = 'margin-top: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;';
    
    const label = document.createElement('label');
    label.textContent = '📝 Paste job description text here:';
    label.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 600;';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'manualTextInput';
    textarea.placeholder = 'Paste the job description or content you want to analyze here...';
    textarea.style.cssText = 'width: 100%; height: 120px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: inherit; resize: vertical;';
    
    const analyzeManualBtn = document.createElement('button');
    analyzeManualBtn.textContent = 'Analyze Pasted Text';
    analyzeManualBtn.style.cssText = 'margin-top: 8px; background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;';
    
    analyzeManualBtn.addEventListener('click', async () => {
      const manualText = textarea.value.trim();
      if (!manualText) {
        this.ui.displayError('Please paste some text to analyze');
        return;
      }
      
      if (this.websiteConfig.questions.length === 0) {
        this.ui.displayError('Please add some questions first');
        return;
      }
      
      try {
        this.ui.showLoading('Analyzing pasted text...');
        
        const analysis = await this.apiService.analyzeContent(
          manualText,
          this.websiteConfig.questions
        );
        
        if (analysis.success) {
          this.ui.displaySuccess(analysis.response);
          const sourceInfo = `\n\n---\nContent source: manual_input\nText length: ${manualText.length} characters\nQuestions: ${this.websiteConfig.questions.length}`;
          this.ui.elements.result.textContent += sourceInfo;
          
          // Hide the manual input after successful analysis
          manualInputDiv.style.display = 'none';
        } else {
          this.ui.displayError(`Analysis failed: ${analysis.error}`);
        }
      } catch (error) {
        this.ui.displayError(`Analysis error: ${error.message}`);
      }
    });
    
    manualInputDiv.appendChild(label);
    manualInputDiv.appendChild(textarea);
    manualInputDiv.appendChild(analyzeManualBtn);
    
    // Add to result section
    if (this.ui.elements.result && this.ui.elements.result.parentNode) {
      this.ui.elements.result.parentNode.appendChild(manualInputDiv);
    }
  }

}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Wait for all modules to be available
    const maxWait = 5000; // 5 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      if (window.Config && window.ApiService && window.StorageUtils && 
          window.ContentExtractor && window.UIUtils) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check if all modules loaded
    if (!window.Config || !window.ApiService || !window.StorageUtils || 
        !window.ContentExtractor || !window.UIUtils) {
      throw new Error('Required modules failed to load');
    }

    // Initialize and start the app
    const app = new PopupApp();
    await app.init();

    // Make app available globally
    window.popupApp = app;

  } catch (error) {
    
    // Fallback error display
    const resultEl = document.getElementById('result');
    if (resultEl) {
      resultEl.textContent = `❌ Application failed to start: ${error.message}`;
      resultEl.className = 'result error';
    }
    
    // Show result section
    const sections = ['loadingSection', 'configSection'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    
    const resultSection = document.getElementById('resultSection');
    if (resultSection) resultSection.classList.remove('hidden');
  }
});

// Export for potential use in other contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupApp;
} else {
  window.PopupApp = PopupApp;
}