// Content extraction utilities for getting text from web pages
class ContentExtractor {
  constructor(config) {
    this.config = config;
    this.fallbackSelectors = config.getFallbackSelectors();
  }

  // Extract text from page using various strategies
  async extractFromPage(tabId, targetSelector = '') {
    return new Promise((resolve) => {
      // First, try to inject the extraction function
      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: this._extractTextFunction,
          args: [targetSelector, this.fallbackSelectors]
        },
        (results) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              text: '',
              source: 'script_error',
              error: `Script injection failed: ${chrome.runtime.lastError.message}. This often happens on protected pages like LinkedIn. Try selecting text manually.`
            });
          } else if (!results || results.length === 0) {
            resolve({
              success: false,
              text: '',
              source: 'no_script_result',
              error: 'Script execution returned no results. This may be due to Content Security Policy restrictions on this page. Try selecting text manually.'
            });
          } else if (!results[0].result) {
            resolve({
              success: false,
              text: '',
              source: 'null_result',
              error: 'Script execution completed but returned no data. Try selecting text manually or use a different selector.'
            });
          } else {
            const result = results[0].result;
            resolve(result);
          }
        }
      );
    });
  }

  // Function to be injected into the page for text extraction
  _extractTextFunction(targetSelector, fallbackSelectors) {
    try {
      // Strategy 1: Always check for selected text first (highest priority)
      const selected = (window.getSelection()?.toString() || '').trim();
      
      // If text is selected, use it immediately regardless of selector
      if (selected) {
        return {
          success: true,
          text: selected,
          source: 'selection',
          method: 'user_selection',
          note: targetSelector ? `Selected text used instead of selector '${targetSelector}'` : 'Selected text used'
        };
      }

      // Strategy 2: Use user-provided selector (CSS or XPath)
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
            return {
              success: false,
              text: '',
              source: 'xpath_error',
              error: `XPath selector '${targetSelector}' is invalid: ${xpathError.message}`
            };
          }
        } else {
          // CSS selector
          try {
            element = document.querySelector(targetSelector);
          } catch (cssError) {
            return {
              success: false,
              text: '',
              source: 'css_error',
              error: `CSS selector '${targetSelector}' is invalid: ${cssError.message}`
            };
          }
        }
        
        if (element) {
          const text = this._extractTextFromElement(element);
          if (text && text.length > 10) {
            return {
              success: true,
              text: text,
              source: `${selectorType.toLowerCase()}: ${targetSelector}`,
              method: 'user_selector'
            };
          } else {
            // Selector found element but no meaningful text
            return {
              success: false,
              text: '',
              source: 'selector_found_no_text',
              error: `${selectorType} selector '${targetSelector}' found element but extracted text is too short (${text ? text.length : 0} chars): "${text ? text.substring(0, 100) : 'null'}"`
            };
          }
        } else {
          // Selector did not match any elements
          return {
            success: false,
            text: '',
            source: 'selector_not_found',
            error: `${selectorType} selector '${targetSelector}' did not match any elements on the page`
          };
        }
      }

      // Strategy 3: Try fallback selectors
      for (const selector of fallbackSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = this._extractTextFromElement(element);
          if (text && text.length > 100) { // Ensure substantial content
            return {
              success: true,
              text: text,
              source: `fallback: ${selector}`,
              method: 'fallback_selector'
            };
          }
        }
      }

      // Strategy 4: Try to find the main content area
      const mainContent = this._findMainContent();
      if (mainContent) {
        return {
          success: true,
          text: mainContent.text,
          source: mainContent.source,
          method: 'content_detection'
        };
      }

      // Strategy 5: No content found (selected text already checked at the beginning)
      return {
        success: false,
        text: '',
        source: 'no_content_found',
        error: 'Could not find any meaningful content on the page and no text is selected'
      };

    } catch (error) {
      return {
        success: false,
        text: '',
        source: 'extraction_error',
        error: error.message
      };
    }
  }

  // Helper method to extract clean text from an element
  _extractTextFromElement(element) {
    if (!element) return '';

    // Remove script and style elements
    const clonedElement = element.cloneNode(true);
    const scripts = clonedElement.querySelectorAll('script, style, noscript, nav, header, footer');
    scripts.forEach(script => script.remove());

    // Try multiple text extraction methods
    let text = '';
    
    // Method 1: innerText (preferred - respects CSS visibility)
    if (clonedElement.innerText) {
      text = clonedElement.innerText;
    }
    // Method 2: textContent (fallback - gets all text)
    else if (clonedElement.textContent) {
      text = clonedElement.textContent;
    }
    // Method 3: innerHTML parsing (last resort)
    else if (clonedElement.innerHTML) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = clonedElement.innerHTML;
      text = tempDiv.textContent || tempDiv.innerText || '';
    }
    
    // Clean up whitespace and special characters
    text = text
      .replace(/\s+/g, ' ')           // Multiple whitespace to single space
      .replace(/[\r\n\t]/g, ' ')      // Line breaks and tabs to space
      .replace(/[^\x20-\x7E\s]/g, '') // Remove non-printable characters (keep spaces)
      .trim();
    
    return text;
  }

  // Smart content detection for finding main content
  _findMainContent() {
    // Look for elements with high text density and common content indicators
    const contentIndicators = [
      '[role="main"]',
      '[role="article"]',
      '.post-body',
      '.article-body',
      '.entry-body',
      '.content-body',
      '.main-content',
      '.post-content',
      '.article-content',
      '.entry-content'
    ];

    let bestContent = null;
    let maxScore = 0;

    // Try content indicator selectors
    for (const selector of contentIndicators) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const score = this._calculateContentScore(element);
        if (score > maxScore) {
          maxScore = score;
          bestContent = {
            text: this._extractTextFromElement(element),
            source: `content_indicator: ${selector}`,
            score: score
          };
        }
      }
    }

    // If no good content found, try heuristic approach
    if (!bestContent || maxScore < 100) {
      const allElements = document.querySelectorAll('div, section, article, main, p');
      for (const element of allElements) {
        const score = this._calculateContentScore(element);
        if (score > maxScore) {
          maxScore = score;
          bestContent = {
            text: this._extractTextFromElement(element),
            source: `heuristic: ${element.tagName.toLowerCase()}${element.className ? '.' + element.className.split(' ')[0] : ''}`,
            score: score
          };
        }
      }
    }

    return bestContent;
  }

  // Calculate content score for an element
  _calculateContentScore(element) {
    if (!element) return 0;

    let score = 0;
    const text = this._extractTextFromElement(element);
    
    if (!text) return 0;

    // Text length score
    score += Math.min(text.length / 10, 100);

    // Paragraph count score
    const paragraphs = element.querySelectorAll('p');
    score += paragraphs.length * 10;

    // Heading score
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    score += headings.length * 5;

    // Content quality indicators
    if (text.includes('.') || text.includes('!') || text.includes('?')) {
      score += 20; // Sentence-like content
    }

    // Penalize elements with too many links
    const links = element.querySelectorAll('a');
    const linkRatio = links.length / (text.length / 100);
    if (linkRatio > 0.1) {
      score -= linkRatio * 10;
    }

    // Penalize navigation and sidebar content
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    const penaltyTerms = ['nav', 'menu', 'sidebar', 'footer', 'header', 'ads', 'advertisement'];
    
    for (const term of penaltyTerms) {
      if (className.includes(term) || id.includes(term)) {
        score -= 50;
        break;
      }
    }

    return Math.max(0, score);
  }

  // Get current tab information
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const url = new URL(tab.url);
        return {
          id: tab.id,
          url: tab.url,
          origin: url.origin,
          hostname: url.hostname,
          title: tab.title
        };
      }
    } catch (error) {
      // Silent fail for tab access errors
    }
    return null;
  }

  // Simple method that just tries to get selected text
  async extractViaSimpleMethod(tabId, targetSelector) {
    return new Promise((resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: () => {
            // Simple function that just gets selected text
            const selected = (window.getSelection()?.toString() || '').trim();
            if (selected) {
              return {
                success: true,
                text: selected,
                source: 'simple_selection',
                method: 'simple_fallback',
                note: 'Used selected text as fallback when other methods failed'
              };
            }
            return {
              success: false,
              source: 'simple_no_selection',
              error: 'No text is selected and other extraction methods failed'
            };
          }
        },
        (results) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              source: 'simple_script_error',
              error: `Simple extraction failed: ${chrome.runtime.lastError.message}`
            });
          } else if (results && results[0] && results[0].result) {
            resolve(results[0].result);
          } else {
            resolve({
              success: false,
              source: 'simple_no_result',
              error: 'Simple extraction returned no results'
            });
          }
        }
      );
    });
  }

  // Fallback method using content script messaging
  async extractViaContentScript(tabId, targetSelector) {
    return new Promise((resolve) => {
      // First try to inject the content script if it's not already there
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ['content.js']
        },
        () => {
          // Ignore injection errors as script may already be loaded
          
          // Now try to communicate with the content script
          chrome.tabs.sendMessage(
            tabId,
            {
              action: 'extractContent',
              selector: targetSelector
            },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({
                  success: false,
                  source: 'content_script_error',
                  error: `Content script communication failed: ${chrome.runtime.lastError.message}`
                });
              } else if (response && response.success) {
                resolve(response);
              } else {
                resolve({
                  success: false,
                  source: 'content_script_no_response',
                  error: 'Content script did not respond or returned no data'
                });
              }
            }
          );
        }
      );
    });
  }

  // Extract text with comprehensive error handling and fallbacks
  async extractText(targetSelector = '') {
    const tab = await this.getCurrentTab();
    
    if (!tab) {
      return {
        success: false,
        error: 'No active tab found',
        text: ''
      };
    }

    // Try primary method (script injection)
    let result = await this.extractFromPage(tab.id, targetSelector);
    
    // If script injection failed, try content script fallback
    if (!result.success && (result.source === 'script_error' || result.source === 'no_script_result' || result.source === 'null_result')) {
      result = await this.extractViaContentScript(tab.id, targetSelector);
    }

    // If both methods failed, try a simple manual approach
    if (!result.success) {
      result = await this.extractViaSimpleMethod(tab.id, targetSelector);
    }

    // If all methods failed, provide helpful guidance
    if (!result.success) {
      // Enhanced error message for LinkedIn specifically
      if (tab.url.includes('linkedin.com')) {
        result.error += '\n\n🔍 LinkedIn-specific tips:\n' +
          '1. Select the job description text manually before analyzing\n' +
          '2. Try CSS selector: .jobs-description-content__text\n' +
          '3. Wait for the page to fully load\n' +
          '4. Some LinkedIn pages have enhanced security that blocks content extraction\n' +
          '5. As a workaround: Copy the job description text and paste it when prompted';
      }
    }
    
    return {
      ...result,
      tab: {
        origin: tab.origin,
        title: tab.title,
        url: tab.url
      }
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentExtractor;
} else {
  window.ContentExtractor = ContentExtractor;
}
