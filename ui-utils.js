// UI utilities for managing popup interface
class UIUtils {
  constructor() {
    this.elements = {};
    this.sections = {};
  }

  // Initialize UI elements and sections
  init() {
    // Cache DOM elements
    this.elements = {
      loadingSection: document.getElementById('loadingSection'),
      resultSection: document.getElementById('resultSection'),
      configSection: document.getElementById('configSection'),
      websiteInfo: document.getElementById('websiteInfo'),
      websiteInfo2: document.getElementById('websiteInfo2'),
      result: document.getElementById('result'),
      targetSelector: document.getElementById('targetSelector'),
      newQuestion: document.getElementById('newQuestion'),
      questionsList: document.getElementById('questionsList'),
      addQuestionBtn: document.getElementById('addQuestionBtn'),
      analyzeBtn: document.getElementById('analyzeBtn'),
      configureBtn: document.getElementById('configureBtn'),
      cancelBtn: document.getElementById('cancelBtn')
    };

    this.sections = {
      loading: this.elements.loadingSection,
      result: this.elements.resultSection,
      config: this.elements.configSection
    };

    return this;
  }

  // Show specific section and hide others
  showSection(sectionName) {
    Object.values(this.sections).forEach(section => {
      if (section) section.classList.add('hidden');
    });

    const targetSection = this.sections[sectionName];
    if (targetSection) {
      targetSection.classList.remove('hidden');
    }
  }

  // Update website information display
  updateWebsiteInfo(origin, title = '') {
    const displayText = origin ? `Website: ${origin}` : 'Unknown website';
    const configText = origin ? `Configuring for: ${origin}` : 'Unknown website';
    
    if (this.elements.websiteInfo) {
      this.elements.websiteInfo.textContent = displayText;
    }
    if (this.elements.websiteInfo2) {
      this.elements.websiteInfo2.textContent = configText;
    }
  }

  // Display result with appropriate styling
  displayResult(content, type = 'info') {
    if (!this.elements.result) return;

    this.elements.result.textContent = content;
    this.elements.result.className = `result ${type}`;
    this.showSection('result');
  }

  // Display success message
  displaySuccess(message) {
    this.displayResult(message, 'success');
  }

  // Display error message
  displayError(message) {
    this.displayResult(`❌ ${message}`, 'error');
  }

  // Display loading state
  showLoading(message = 'Analyzing content...') {
    this.showSection('loading');
    const loadingText = this.elements.loadingSection?.querySelector('p');
    if (loadingText) {
      loadingText.textContent = message;
    }
  }

  // Render questions list
  renderQuestions(questions, onDelete) {
    if (!this.elements.questionsList) return;

    this.elements.questionsList.innerHTML = '';
    
    questions.forEach((question, index) => {
      const div = document.createElement('div');
      div.className = 'question-item';
      
      const span = document.createElement('span');
      span.className = 'question-text';
      span.textContent = question;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (onDelete) onDelete(index);
      });
      
      div.appendChild(span);
      div.appendChild(deleteBtn);
      this.elements.questionsList.appendChild(div);
    });
  }

  // Update analyze button state
  updateAnalyzeButton(enabled = true) {
    if (this.elements.analyzeBtn) {
      this.elements.analyzeBtn.disabled = !enabled;
    }
  }

  // Set target selector value
  setTargetSelector(value) {
    if (this.elements.targetSelector) {
      this.elements.targetSelector.value = value || '';
    }
  }

  // Get target selector value
  getTargetSelector() {
    return this.elements.targetSelector?.value?.trim() || '';
  }

  // Clear new question input
  clearQuestionInput() {
    if (this.elements.newQuestion) {
      this.elements.newQuestion.value = '';
    }
  }

  // Get new question input value
  getQuestionInput() {
    return this.elements.newQuestion?.value?.trim() || '';
  }

  // Add event listener with error handling
  addEventListenerSafe(elementId, event, handler) {
    const element = typeof elementId === 'string' 
      ? document.getElementById(elementId) 
      : elementId;
    
    if (element) {
      element.addEventListener(event, (e) => {
        try {
          handler(e);
        } catch (error) {
          this.displayError(`UI Error: ${error.message}`);
        }
      });
    }
  }

  // Show confirmation dialog
  async showConfirmation(message, title = 'Confirm') {
    return new Promise((resolve) => {
      // Create a simple confirmation modal
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 300px;
        text-align: center;
      `;

      modal.innerHTML = `
        <h4 style="margin: 0 0 15px 0;">${title}</h4>
        <p style="margin: 0 0 20px 0;">${message}</p>
        <div>
          <button id="confirmYes" style="margin-right: 10px;">Yes</button>
          <button id="confirmNo">No</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      modal.querySelector('#confirmYes').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(true);
      });

      modal.querySelector('#confirmNo').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(false);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(false);
        }
      });
    });
  }

  // Show notification toast
  showNotification(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10001;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, duration);
  }

  // Animate element
  animateElement(element, animation = 'fadeIn', duration = 300) {
    if (!element) return;

    const animations = {
      fadeIn: 'opacity: 0; transition: opacity 0.3s; opacity: 1;',
      slideDown: 'max-height: 0; overflow: hidden; transition: max-height 0.3s; max-height: 200px;',
      pulse: 'animation: pulse 0.5s;'
    };

    if (animations[animation]) {
      element.style.cssText += animations[animation];
    }
  }

  // Validate form inputs
  validateInputs() {
    const errors = [];
    
    // Add validation logic as needed
    const targetSelector = this.getTargetSelector();
    if (targetSelector && !this.isValidSelector(targetSelector)) {
      errors.push('Invalid CSS selector format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Check if a CSS selector is valid
  isValidSelector(selector) {
    try {
      document.querySelector(selector);
      return true;
    } catch {
      return false;
    }
  }

  // Get all form data
  getFormData() {
    return {
      targetSelector: this.getTargetSelector(),
      newQuestion: this.getQuestionInput()
    };
  }

  // Reset form
  resetForm() {
    this.setTargetSelector('');
    this.clearQuestionInput();
    this.updateAnalyzeButton(false);
  }

  // Navigation utilities
  async navigateToSettings() {
    try {
      // Use background script to open settings
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: "openSettings"
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      if (response.success) {
        // Close the popup after opening settings
        window.close();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      
      // Fallback: show inline message with instructions
      this.displayResult(
        '⚠️ Please configure the extension first. Right-click the extension icon and select "Options" to open settings.',
        'info'
      );
    }
  }

  // Show first-time setup message
  showFirstTimeSetup(autoRedirect = false) {
    if (autoRedirect) {
      // Show brief message and auto-redirect
      this.displayResult('🔧 Opening settings for first-time configuration...', 'info');
      
      // Auto-redirect after a short delay
      setTimeout(() => {
        this.navigateToSettings();
      }, 1500);
      
      return;
    }

    const setupMessage = `
🎉 Welcome to Contextual Q&A AI!

To get started, you need to configure:
1. API settings (Ollama URL and model)
2. Questions for this website
3. Target content selector (optional)

Click "Open Settings" to configure the extension.
    `.trim();

    this.displayResult(setupMessage, 'info');
    
    // Add buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '15px';
    
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = 'Open Settings';
    settingsBtn.style.marginRight = '10px';
    settingsBtn.addEventListener('click', () => this.navigateToSettings());
    
    const autoBtn = document.createElement('button');
    autoBtn.textContent = 'Auto-Open Settings';
    autoBtn.className = 'secondary';
    autoBtn.style.fontSize = '12px';
    autoBtn.addEventListener('click', async () => {
      // Save preference for future
      try {
        await chrome.storage.sync.set({ 'pref_autoRedirectToSettings': true });
      } catch (error) {
      }
      this.showFirstTimeSetup(true);
    });
    
    buttonContainer.appendChild(settingsBtn);
    buttonContainer.appendChild(autoBtn);
    
    if (this.elements.result) {
      this.elements.result.appendChild(document.createElement('br'));
      this.elements.result.appendChild(buttonContainer);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIUtils;
} else {
  window.UIUtils = UIUtils;
}
