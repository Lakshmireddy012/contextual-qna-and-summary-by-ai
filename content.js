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
              <label>Q&A History:</label>
              <div class="actions">
                <button class="copy-response-btn" title="Copy all to clipboard">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
                <button class="clear-history-btn" title="Clear all Q&A history" style="margin-left: 8px; background: #6c757d;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
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
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0, 0, 0, 0.7) !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      z-index: 10000 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    
    .contextual-ai-modal {
      background: white !important;
      border-radius: 12px !important;
      width: 90% !important;
      max-width: 600px !important;
      max-height: 80vh !important;
      overflow-y: auto !important;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
    }
    
    .contextual-ai-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 20px !important;
      border-bottom: 1px solid #e1e5e9 !important;
    }
    
    .contextual-ai-header h3 {
      margin: 0 !important;
      color: #1a1a1a !important;
      font-size: 18px !important;
      font-weight: 600 !important;
    }
    
    .contextual-ai-close {
      background: none !important;
      border: none !important;
      font-size: 24px !important;
      cursor: pointer !important;
      color: #666 !important;
      padding: 0 !important;
      width: 30px !important;
      height: 30px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 6px !important;
    }
    
    .contextual-ai-close:hover {
      background: #f0f0f0 !important;
      color: #333 !important;
    }
    
    .contextual-ai-content {
      padding: 20px !important;
    }
    
    .selected-text-section, .question-section, .result-section {
      margin-bottom: 20px !important;
    }
    
    .contextual-ai-content label {
      display: block !important;
      margin-bottom: 8px !important;
      font-weight: 600 !important;
      color: #333 !important;
      font-size: 14px !important;
    }
    
    .response-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      margin-bottom: 12px !important;
    }
    
    .response-header label {
      margin-bottom: 0 !important;
    }
    
    .selected-text-display {
      background: #f8f9fa !important;
      border: 1px solid #e1e5e9 !important;
      border-radius: 6px !important;
      padding: 12px !important;
      max-height: 120px !important;
      overflow-y: auto !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      color: #333 !important;
    }
    
    .input-container {
      position: relative !important;
      display: flex !important;
      align-items: flex-end !important;
      gap: 8px !important;
    }
    
    .question-input {
      flex: 1 !important;
      border: 1px solid #e1e5e9 !important;
      border-radius: 6px !important;
      padding: 12px !important;
      font-size: 14px !important;
      resize: vertical !important;
      font-family: inherit !important;
      box-sizing: border-box !important;
      min-height: 80px !important;
    }
    
    .question-input:focus {
      outline: none !important;
      border-color: #007bff !important;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25) !important;
    }
    
    .send-btn {
      background: #007bff !important;
      color: white !important;
      border: none !important;
      border-radius: 6px !important;
      padding: 10px !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-width: 40px !important;
      height: 40px !important;
      flex-shrink: 0 !important;
    }
    
    .send-btn:enabled:hover {
      background: #0056b3 !important;
      transform: translateY(-1px) !important;
    }
    
    .send-btn:disabled {
      background: #ccc !important;
      cursor: not-allowed !important;
      transform: none !important;
    }
    
    .ai-response {
      background: #f8f9fa !important;
      border: 1px solid #e1e5e9 !important;
      border-radius: 6px !important;
      padding: 15px !important;
      max-height: 300px !important;
      overflow-y: auto !important;
      font-size: 14px !important;
      line-height: 1.6 !important;
      word-wrap: break-word !important;
    }
    
    .copy-response-btn, .clear-history-btn {
      background: #6c757d !important;
      color: white !important;
      border: none !important;
      border-radius: 4px !important;
      padding: 8px !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 32px !important;
      height: 32px !important;
    }

    .actions {
      display: flex !important;
    }
    
    .copy-response-btn:hover {
      background: #5a6268 !important;
      transform: translateY(-1px) !important;
    }

    /* Q&A History Styles */
    .qa-history {
      max-height: 400px !important;
      overflow-y: auto !important;
    }

    .qa-item {
      margin-bottom: 12px !important;
    }

    .qa-question {
      font-weight: 600 !important;
      color: #2c3e50 !important;
      margin-bottom: 6px !important;
      line-height: 1.3 !important;
      font-size: 14px !important;
    }

    .qa-answer-card {
      border: 1px solid #e1e5e9 !important;
      border-radius: 6px !important;
      background: #f8f9fa !important;
      padding: 8px !important;
      position: relative !important;
    }

    .qa-answer-card.qa-error {
      border-color: #dc3545 !important;
      background: #f8d7da !important;
    }

    .qa-answer-content {
      color: #27ae60 !important;
      line-height: 1.4 !important;
      font-size: 13px !important;
      margin-bottom: 6px !important;
      padding-right: 35px !important;
      text-align: justify !important;
    }

    .qa-actions {
      position: absolute !important;
      top: 6px !important;
      right: 6px !important;
    }

    .qa-copy {
      background: #6c757d !important;
      color: white !important;
      border: none !important;
      border-radius: 3px !important;
      padding: 4px !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
      width: 24px !important;
      height: 24px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .qa-copy:hover {
      background: #5a6268 !important;
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
  const clearBtn = modal.querySelector('.clear-history-btn');

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
        analyzeTextWithHistory();
      }
    }
  });

  // Handle send button click
  sendBtn.addEventListener('click', analyzeTextWithHistory);

  // Q&A History storage
  let qaHistory = [];

  // Analyze function with Q&A history
  async function analyzeTextWithHistory() {
    const question = questionInput.value.trim();
    if (!question) return;

    // Clear input immediately for better UX
    questionInput.value = '';

    // Show loading state
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"><animate attributeName="r" values="2;4;2" dur="1s" repeatCount="indefinite"/></circle></svg>';
    questionInput.placeholder = 'Processing your question...';
    
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

      // Add to Q&A history (most recent first)
      const qaEntry = {
        question: question,
        answer: response,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now()
      };
      qaHistory.unshift(qaEntry); // Add to beginning

      // Display updated Q&A history
      displayQAHistory();

    } catch (error) {
      // Add error to history
      const qaEntry = {
        question: question,
        answer: `❌ Error: ${error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        isError: true
      };
      qaHistory.unshift(qaEntry);
      displayQAHistory();
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
      questionInput.placeholder = 'Enter your question here (Press Enter or click send)...';
    }
  }

  // Display Q&A history
  function displayQAHistory() {
    if (qaHistory.length === 0) {
      resultSection.style.display = 'none';
      return;
    }

    let historyHTML = '<div class="qa-history">';
    
    qaHistory.forEach((qa, index) => {
      const isError = qa.isError || false;
      const errorClass = isError ? 'qa-error' : '';
      
      historyHTML += `
        <div class="qa-item">
          <div class="qa-question">
            ${escapeHtml(qa.question)}
          </div>
          <div class="qa-answer-card ${errorClass}">
            <div class="qa-answer-content">
              ${escapeHtml(qa.answer)}
            </div>
            <div class="qa-actions">
              <button class="qa-copy" data-qa-id="${qa.id}" title="Copy answer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    
    historyHTML += '</div>';
    
    aiResponse.innerHTML = historyHTML;
    resultSection.style.display = 'block';
    
    // Add event listeners for copy buttons using event delegation
    aiResponse.addEventListener('click', async (e) => {
      if (e.target.closest('.qa-copy')) {
        const copyBtn = e.target.closest('.qa-copy');
        const qaId = parseInt(copyBtn.getAttribute('data-qa-id'));
        await copyQAAnswer(qaId);
      }
    });
  }


  // Copy individual Q&A answer
  async function copyQAAnswer(id) {
    const qa = qaHistory.find(qa => qa.id === id);
    
    if (!qa) {
      return;
    }

    try {
      await navigator.clipboard.writeText(qa.answer);
      
      // Visual feedback
      const copyBtn = document.querySelector(`[data-qa-id="${id}"]`);
      
      if (copyBtn) {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        copyBtn.style.background = '#28a745';
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.style.background = '#6c757d';
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to copy answer:', error);
    }
  }

  // Analyze function (original - kept for compatibility)
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
      // Copy all Q&A history as formatted text
      let copyText = 'Q&A History:\n\n';
      qaHistory.forEach((qa, index) => {
        copyText += `${index + 1}. ${qa.question}\n`;
        copyText += `${qa.answer}\n\n`;
      });
      
      await navigator.clipboard.writeText(copyText);
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

  // Handle clear history
  clearBtn.addEventListener('click', () => {
    if (qaHistory.length > 0 && confirm('Clear all Q&A history?')) {
      qaHistory = [];
      displayQAHistory();
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
  