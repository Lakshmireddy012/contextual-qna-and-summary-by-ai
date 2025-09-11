chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSelectedText") {
      const selectedText = window.getSelection().toString();
      sendResponse({ text: selectedText });
    } else if (request.action === "showContextualModal") {
      showContextualModal(request.selectedText);
    } else if (request.action === "extractContent") {
      // Handle content extraction request as fallback
      try {
        const result = extractContentFallback(request.selector);
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          source: 'content_script_extraction_error',
          error: error.message
        });
      }
    }
    return true; // Keep message channel open for async responses
});

// Fallback content extraction function
function extractContentFallback(targetSelector) {
  try {
    // Always check for selected text first (highest priority)
    const selected = (window.getSelection()?.toString() || '').trim();
    
    // If text is selected, use it immediately regardless of selector
    if (selected) {
      return {
        success: true,
        text: selected,
        source: 'content_script_selection',
        method: 'content_script_fallback',
        note: targetSelector ? `Selected text used instead of selector '${targetSelector}'` : 'Selected text used'
      };
    }
    
    // Try the provided selector
    if (targetSelector) {
      let element = null;
      let selectorType = 'CSS';
      
      // Check if it's an XPath selector
      if (targetSelector.startsWith('//') || targetSelector.startsWith('/') || targetSelector.includes('[@')) {
        selectorType = 'XPath';
        try {
          const result = document.evaluate(
            targetSelector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          element = result.singleNodeValue;
        } catch (xpathError) {
          throw new Error(`XPath selector '${targetSelector}' is invalid: ${xpathError.message}`);
        }
      } else {
        // CSS selector
        try {
          element = document.querySelector(targetSelector);
        } catch (cssError) {
          throw new Error(`CSS selector '${targetSelector}' is invalid: ${cssError.message}`);
        }
      }
      
      if (element) {
        const text = extractTextFromElement(element);
        if (text && text.length > 10) {
          return {
            success: true,
            text: text,
            source: `content_script_${selectorType.toLowerCase()}`,
            method: 'content_script_fallback'
          };
        }
      }
    }
    
    // Try common fallback selectors
    const fallbackSelectors = [
      'main',
      'article',
      '.content',
      '#content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '.jobs-description-content__text',
      '.job-details-jobs-unified-top-card__job-description'
    ];
    
    for (const selector of fallbackSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = extractTextFromElement(element);
          if (text && text.length > 100) {
            return {
              success: true,
              text: text,
              source: `content_script_fallback: ${selector}`,
              method: 'content_script_fallback'
            };
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    return {
      success: false,
      source: 'content_script_no_content',
      error: 'Could not extract content and no text is selected'
    };
    
  } catch (error) {
    return {
      success: false,
      source: 'content_script_error',
      error: error.message
    };
  }
}

// Helper function to extract text from element
function extractTextFromElement(element) {
  if (!element) return '';
  
  const clonedElement = element.cloneNode(true);
  const scripts = clonedElement.querySelectorAll('script, style, noscript, nav, header, footer');
  scripts.forEach(script => script.remove());
  
  let text = '';
  if (clonedElement.innerText) {
    text = clonedElement.innerText;
  } else if (clonedElement.textContent) {
    text = clonedElement.textContent;
  }
  
  return text.replace(/\s+/g, ' ').trim();
}

// Create and show the contextual AI modal
function showContextualModal(selectedText) {
  // Remove existing modal if any
  const existingModal = document.getElementById('contextual-ai-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal HTML
  const modal = document.createElement('div');
  modal.id = 'contextual-ai-modal';
  modal.innerHTML = `
    <div class="contextual-ai-overlay">
      <div class="contextual-ai-modal">
        <div class="contextual-ai-header">
          <h3>Ask Contextual AI</h3>
          <button class="contextual-ai-close">&times;</button>
        </div>
        <div class="contextual-ai-content">
          <div class="selected-text-section">
            <label>Selected Text:</label>
            <div class="selected-text-display">${escapeHtml(selectedText)}</div>
          </div>
          <div class="question-section">
            <label>What would you like to ask about this text?</label>
            <div class="input-container">
              <textarea class="question-input" placeholder="Enter your question here (Press Enter or click send)..." rows="3"></textarea>
              <button class="send-btn" disabled title="Send request">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="result-section" style="display: none;">
            <div class="response-header">
              <label>AI Response:</label>
              <button class="copy-response-btn" title="Copy to clipboard">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
            </div>
            <div class="ai-response"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add CSS styles
  const style = document.createElement('style');
  style.textContent = `
    .contextual-ai-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .contextual-ai-modal {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    
    .contextual-ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e1e5e9;
    }
    
    .contextual-ai-header h3 {
      margin: 0;
      color: #1a1a1a;
      font-size: 18px;
      font-weight: 600;
    }
    
    .contextual-ai-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }
    
    .contextual-ai-close:hover {
      background: #f0f0f0;
      color: #333;
    }
    
    .contextual-ai-content {
      padding: 20px;
    }
    
    .selected-text-section, .question-section, .result-section {
      margin-bottom: 20px;
    }
    
    .contextual-ai-content label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }
    
    .response-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .response-header label {
      margin-bottom: 0;
    }
    
    .selected-text-display {
      background: #f8f9fa;
      border: 1px solid #e1e5e9;
      border-radius: 6px;
      padding: 12px;
      max-height: 120px;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
    }
    
    .input-container {
      position: relative;
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    
    .question-input {
      flex: 1;
      border: 1px solid #e1e5e9;
      border-radius: 6px;
      padding: 12px;
      font-size: 14px;
      resize: vertical;
      font-family: inherit;
      box-sizing: border-box;
      min-height: 80px;
    }
    
    .question-input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
    
    .send-btn {
      background: #007bff;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      height: 40px;
      flex-shrink: 0;
    }
    
    .send-btn:enabled:hover {
      background: #0056b3;
      transform: translateY(-1px);
    }
    
    .send-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }
    
    .ai-response {
      background: #f8f9fa;
      border: 1px solid #e1e5e9;
      border-radius: 6px;
      padding: 15px;
      max-height: 300px;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .copy-response-btn {
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }
    
    .copy-response-btn:hover {
      background: #5a6268;
      transform: translateY(-1px);
    }
  `;
  
  modal.appendChild(style);
  document.body.appendChild(modal);

  // Add event listeners
  setupModalEventListeners(modal, selectedText);
}

function setupModalEventListeners(modal, selectedText) {
  const closeBtn = modal.querySelector('.contextual-ai-close');
  const overlay = modal.querySelector('.contextual-ai-overlay');
  const questionInput = modal.querySelector('.question-input');
  const sendBtn = modal.querySelector('.send-btn');
  const resultSection = modal.querySelector('.result-section');
  const aiResponse = modal.querySelector('.ai-response');
  const copyBtn = modal.querySelector('.copy-response-btn');

  // Close modal handlers
  closeBtn.addEventListener('click', () => modal.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) modal.remove();
  });

  // Enable/disable send button based on input
  questionInput.addEventListener('input', () => {
    sendBtn.disabled = !questionInput.value.trim();
  });

  // Handle Enter key in textarea (Ctrl+Enter or Shift+Enter to add new line)
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        analyzeText();
      }
    }
  });

  // Handle send button click
  sendBtn.addEventListener('click', analyzeText);

  // Analyze function
  async function analyzeText() {
    const question = questionInput.value.trim();
    if (!question) return;

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"><animate attributeName="r" values="2;4;2" dur="1s" repeatCount="indefinite"/></circle></svg>';
    
    const prompt = `Analyze the following text and answer the question.

Text:
[${selectedText}]

Question:
${question}

Please provide a clear and concise answer:`;

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: "analyzeWithLLM",
          prompt: prompt,
          timeout: 30000 // 30 second timeout
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response.response);
          } else {
            reject(new Error(response?.error || 'Unknown error occurred'));
          }
        });
      });

      aiResponse.textContent = response;
      resultSection.style.display = 'block';
    } catch (error) {
      aiResponse.textContent = `❌ Error: ${error.message}`;
      resultSection.style.display = 'block';
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    }
  }

  // Handle copy to clipboard
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(aiResponse.textContent);
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
      copyBtn.style.background = '#28a745';
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.style.background = '#6c757d';
      }, 2000);
    } catch (error) {
      copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
      copyBtn.style.background = '#dc3545';
      setTimeout(() => {
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
        copyBtn.style.background = '#6c757d';
      }, 2000);
    }
  });

  // Focus on question input
  questionInput.focus();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
  