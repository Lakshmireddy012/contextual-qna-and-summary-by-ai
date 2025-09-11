// API service for handling Ollama interactions
class ApiService {
  constructor(config) {
    this.config = config;
  }

  // Make request to Ollama API
  async generateResponse(prompt, options = {}) {
    const apiUrl = this.config.getApiUrl();
    const modelName = options.model || this.config.getModelName();
    const timeout = options.timeout || this.config.getRequestTimeout();

    const payload = {
      model: modelName,
      prompt: prompt,
      stream: false,
      ...options.additionalParams
    };

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      // Create fetch promise
      const fetchPromise = fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(payload)
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        response: data?.response || 'No response received',
        data: data
      };

    } catch (error) {
      console.error('API Service Error:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  // Analyze content with questions
  async analyzeContent(content, questions, options = {}) {
    if (!content || !questions || questions.length === 0) {
      return {
        success: false,
        error: 'Content and questions are required'
      };
    }

    const maxLength = this.config.getMaxContentLength();
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content;

    const questionsBlock = questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n');

    const prompt = `Analyze the following content and answer the questions.

Content:
[${truncatedContent}]

Questions:
${questionsBlock}

Please provide clear, concise answers to each question based on the content above.`;

    return await this.generateResponse(prompt, options);
  }

  // Simple question-answer for selected text
  async askQuestion(content, question, options = {}) {
    if (!content || !question) {
      return {
        success: false,
        error: 'Content and question are required'
      };
    }

    const maxLength = this.config.getMaxContentLength();
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content;

    const prompt = `Analyze the following text and answer the question.

Text:
[${truncatedContent}]

Question:
${question}

Please provide a clear and concise answer:`;

    return await this.generateResponse(prompt, options);
  }

  // Test API connection
  async testConnection() {
    try {
      const response = await this.generateResponse('Test connection. Respond with "OK"', {
        timeout: 5000
      });
      
      return {
        success: response.success,
        message: response.success ? 'Connection successful' : response.error,
        details: response
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed',
        error: error.message
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiService;
} else {
  window.ApiService = ApiService;
}
