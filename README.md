# Contextual Q&A AI Chrome Extension

A powerful Chrome extension that analyzes web content using local AI models and provides contextual answers to your questions. Built with privacy in mind, this extension runs entirely on your local machine using Ollama, ensuring your data never leaves your computer.

## 🌟 Key Advantages

### 🔒 **Privacy First**
- **100% Local Processing**: All AI computations happen on your machine
- **No Data Transmission**: Your content never leaves your computer
- **No API Keys Required**: No need for expensive cloud AI services
- **Complete Control**: You own your data and AI interactions

### 🚀 **Performance & Flexibility**
- **Website-Specific Configurations**: Customized questions and selectors per website
- **Intelligent Content Extraction**: Smart text extraction with multiple fallback strategies
- **Auto-Analysis**: Instant analysis when opening the extension (if configured)
- **Offline Capable**: Works without internet connection once set up

### 💰 **Cost Effective**
- **Free to Use**: No subscription fees or API costs
- **One-Time Setup**: Install once, use forever
- **Resource Efficient**: Optimized for local hardware

### 🛠 **Developer Friendly**
- **Modular Architecture**: Clean, maintainable codebase
- **Configurable**: Easy to customize and extend
- **Open Source**: Full transparency and community contributions

## 🎯 Use Cases

- **Job Applications**: Analyze job descriptions with custom questions
- **Research**: Extract key information from articles and papers
- **Content Analysis**: Understand complex documents quickly
- **Learning**: Ask questions about educational content
- **Code Review**: Analyze code snippets and documentation
- **News Analysis**: Get insights from news articles
- **Product Research**: Analyze product descriptions and reviews

## 📋 Prerequisites

Before installing the extension, you need to set up Ollama with a local AI model.

## 🔧 Ollama Installation & Setup

### Step 1: Install Ollama

#### **macOS**
```bash
# Using Homebrew (recommended)
brew install ollama

# Or download from official website
# Visit: https://ollama.ai/download
```

#### **Linux**
```bash
# Install using curl
curl -fsSL https://ollama.ai/install.sh | sh

# Or using package managers
# Ubuntu/Debian
sudo apt install ollama

# Arch Linux
yay -S ollama
```

#### **Windows**
1. Download Ollama from [https://ollama.ai/download](https://ollama.ai/download)
2. Run the installer
3. Follow the installation wizard

### Step 2: Install AI Model

After installing Ollama, you need to download an AI model:

```bash
# Install Mistral (recommended for this extension)
ollama pull mistral

# Other popular models you can try:
ollama pull llama2          # Meta's Llama 2
ollama pull codellama       # Code-focused model
ollama pull llama2:13b      # Larger, more capable model
ollama pull phi             # Lightweight model
```

### Step 3: Configure CORS (Critical Step)

**Chrome extensions require CORS to be enabled for Ollama.** This is essential for the extension to work.

#### **macOS/Linux**
```bash
# Set CORS environment variable to allow all origins
launchctl setenv OLLAMA_ORIGINS "*"

# Alternative: Set specific origins (more secure)
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
```

#### **Windows**
```cmd
# Set environment variable in Command Prompt (as Administrator)
setx OLLAMA_ORIGINS "*" /M

# Or set specific origins
setx OLLAMA_ORIGINS "chrome-extension://*" /M
```

#### **Docker Users**
```bash
# Run Ollama with CORS enabled
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama \
  -e OLLAMA_ORIGINS="*" \
  ollama/ollama
```

### Step 4: Start Ollama Service

```bash
# Start Ollama service
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags
```

**Important**: Ollama must be running before using the extension. You can add it to your system startup for convenience.

### 📖 CORS Configuration Details

For more detailed information about configuring CORS for Ollama, including security considerations and advanced configurations, visit: [https://objectgraph.com/blog/ollama-cors/](https://objectgraph.com/blog/ollama-cors/)

**Security Note**: Using `OLLAMA_ORIGINS="*"` allows all origins to access your Ollama instance. For production use, consider setting specific origins: `OLLAMA_ORIGINS="chrome-extension://*"`

## 🚀 Extension Installation

### Method 1: Chrome Web Store (Coming Soon)
*The extension will be available on the Chrome Web Store soon.*

### Method 2: Developer Mode (Current)

1. **Download the Extension**
   ```bash
   git clone https://github.com/your-repo/contextual-qa-ai-extension.git
   # Or download ZIP from GitHub
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the extension directory
   - The extension icon will appear in your toolbar

## ⚙️ Configuration

### First-Time Setup

1. **Click the Extension Icon**
   - The extension will detect it's your first time
   - You'll see a welcome screen with setup options

2. **Choose Setup Method**
   - **Manual**: Click "Open Settings" to configure manually
   - **Auto**: Click "Auto-Open Settings" to save preference and auto-redirect

3. **Configure API Settings**
   - **Ollama API URL**: `http://localhost:11434/api/generate` (default)
   - **Model Name**: `mistral` (or your preferred model)
   - **Timeout**: `30` seconds (adjust based on your hardware)

4. **Test Connection**
   - Click "Test Connection" to verify Ollama is working
   - You should see "Connection successful!"

### Website-Specific Configuration

For each website you want to analyze:

1. **Navigate to the Website**
2. **Click the Extension Icon**
3. **Add Questions**
   - Enter questions you want to ask about the content
   - Examples: "What are the key requirements?", "What is the salary range?", "What skills are needed?"
4. **Set Target Selector (Optional)**
   - CSS selector for specific content (e.g., `.job-description`, `article`, `main`)
   - Leave empty to use selected text or auto-detection
5. **Click "Analyze Now"**

## 📖 How to Use

### Basic Usage

1. **Navigate to Any Website**
2. **Click the Extension Icon**
   - If configured: Automatically analyzes content
   - If not configured: Shows setup interface

3. **View Results**
   - AI-powered answers appear in the popup
   - Results are based on your custom questions

### Advanced Usage

#### **Content Selection Priority**
The extension uses this intelligent priority order for content:
1. **Selected Text** (highest priority - always used if text is selected)
2. **Custom CSS/XPath Selector** (if specified and no text is selected)
3. **Smart Auto-Detection** (fallback selectors if no custom selector)
4. **Manual Input** (if all automatic methods fail)

**Smart Selection Behavior:**
- **If text is selected**: Always uses selected text, ignoring selectors
- **If no text is selected**: Uses your custom selector or auto-detection
- **If extraction fails**: Shows manual input option for copy/paste
- **Clear feedback**: Shows which method was used in results

#### **Custom Selectors Examples**
- **LinkedIn Jobs**: `.jobs-description-content__text`
- **Medium Articles**: `article`
- **GitHub README**: `.markdown-body`
- **News Sites**: `.article-content, .post-body`
- **Documentation**: `.content, .documentation`

#### **Context Menu Usage**
1. **Select Text** on any webpage
2. **Right-click** → "Ask Contextual AI"
3. **Enter Your Question** in the modal
4. **Get Instant Answer**

### Settings Management

Access settings via:
- Right-click extension icon → "Options"
- Or navigate to `chrome://extensions/` → Extension details → "Extension options"

#### **Settings Features**
- **API Configuration**: Change Ollama URL, model, timeout
- **Website Management**: View, export, import, or delete website configs
- **Storage Information**: Monitor extension storage usage
- **Connection Testing**: Verify Ollama connectivity

## 📁 Project Structure

```
contextual-qa-ai-extension/
├── manifest.json              # Extension manifest
├── popup.html                 # Main popup interface
├── popup.js                   # Main application logic
├── settings.html              # Settings page
├── background.js              # Background service worker
├── content.js                 # Content script for page interaction
├── config.js                  # Configuration management
├── api-service.js             # Ollama API service
├── storage-utils.js           # Storage utilities
├── content-extractor.js       # Content extraction logic
├── ui-utils.js                # UI helper functions
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

## 🛠 Technical Features

### Modular Architecture
- **Separation of Concerns**: Each module handles specific functionality
- **Reusable Components**: Shared utilities across different parts
- **Error Handling**: Comprehensive error handling and recovery
- **Performance Optimized**: Efficient content extraction and API calls

### Smart Content Extraction
- **Multi-Strategy Approach**: Selected text → Custom selector → Auto-detection
- **Content Scoring**: Intelligent scoring system for content quality
- **Fallback Mechanisms**: Multiple fallback selectors for reliability
- **Text Cleaning**: Removes scripts, styles, and irrelevant content

### Storage System
- **Origin-Based Storage**: Configurations stored per website origin
- **Sync Across Devices**: Uses Chrome's sync storage
- **Export/Import**: Backup and restore configurations
- **Storage Monitoring**: Track usage and prevent quota issues

## 🔍 Troubleshooting

### Common Issues

#### **"Connection Failed" Error**
```
❌ API connection failed: fetch failed
```
**Solutions:**
1. Ensure Ollama is running: `ollama serve`
2. Check CORS configuration: `launchctl setenv OLLAMA_ORIGINS "*"`
3. Verify model is installed: `ollama list`
4. Test manually: `curl http://localhost:11434/api/tags`

#### **"No Content Found" Error**
```
❌ Could not extract text from page
```
This is the most common issue. Here's how to fix it:

**Quick Solutions:**
1. **Select text manually** before clicking the extension icon
2. **Use the Debug Selector tool** (🐛 button in config section)
3. **Try common selectors**: `main`, `article`, `.content`, `#content`
4. **Check if page has loaded** completely

**Detailed Troubleshooting:**

**Step 1: Use Built-in Debugging**
1. Open the extension popup
2. Go to configuration section
3. Enter your CSS selector
4. Click "🐛 Debug Selector" button
5. Review the detailed results and suggestions

**Step 2: Common Working Selectors by Site Type**
- **News Sites**: `article`, `.article-content`, `.post-content`
- **Job Sites**: `.job-description`, `.description`, `.details`
- **Documentation**: `.content`, `.documentation`, `main`
- **Blogs**: `.post-body`, `.entry-content`, `.article-body`
- **E-commerce**: `.product-description`, `.description`
- **Social Media**: `.post-text`, `.content`, `[data-testid]`

**Step 3: Manual Selector Testing**
Open browser console (F12) and test selectors:
```javascript
// Test if selector finds elements
document.querySelectorAll('your-selector-here')

// Test text extraction
document.querySelector('your-selector-here')?.innerText
```

**Step 4: Advanced Debugging**
Enable extension debug mode:
```javascript
// In popup console
window.DebugUtils.enableDebug()
window.popupApp.debugSelector()
```

**Common Causes:**
- **Dynamic Content**: Page loads content via JavaScript after initial load
- **Shadow DOM**: Content is in shadow DOM (not accessible)
- **CSS Display**: Element is hidden with `display: none` or `visibility: hidden`
- **Iframe Content**: Content is in iframe (requires different approach)
- **Protected Content**: Site blocks content extraction for security

#### **Extension Not Loading**
**Solutions:**
1. Refresh the extension: Go to `chrome://extensions/` and click refresh
2. Check developer console for errors
3. Ensure all files are present in the extension directory
4. Try disabling and re-enabling the extension

#### **Slow Responses**
**Solutions:**
1. Use a smaller/faster model: `ollama pull phi`
2. Increase timeout in settings
3. Reduce content length (select specific text)
4. Check system resources (CPU, RAM)

### Debug Mode

Enable debug information:
```javascript
// In browser console (extension popup)
window.popupApp.getStatus()
```

This will show:
- Initialization status
- Current origin
- Questions count
- Configuration details

## 🔒 Privacy & Security

### Data Privacy
- **Local Processing**: All AI computations happen on your machine
- **No External APIs**: No data sent to third-party services
- **No Tracking**: Extension doesn't track or collect user data
- **Secure Storage**: Uses Chrome's secure storage APIs

### Security Considerations
- **CORS Configuration**: Limit origins for production use
- **Content Extraction**: Only extracts visible text content
- **Permissions**: Minimal required permissions
- **Code Transparency**: Open source for full audit

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the Repository**
2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make Your Changes**
   - Follow the modular architecture
   - Add tests if applicable
   - Update documentation
4. **Test Thoroughly**
   - Test on multiple websites
   - Verify different content types
   - Check error handling
5. **Submit a Pull Request**

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-repo/contextual-qa-ai-extension.git
cd contextual-qa-ai-extension

# Load in Chrome for development
# Go to chrome://extensions/
# Enable Developer mode
# Click "Load unpacked" and select the directory
```

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- **Issues**: Report bugs on [GitHub Issues](https://github.com/your-repo/contextual-qa-ai-extension/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/your-repo/contextual-qa-ai-extension/discussions)
- **Documentation**: Check the [Wiki](https://github.com/your-repo/contextual-qa-ai-extension/wiki)

## 🔄 Version History

- **v1.0.0**: Initial release with basic functionality
- **v2.0.0**: Modular architecture, settings page, auto-redirect
- **v2.1.0**: Enhanced content extraction, CORS support, improved UX

## 🚀 Roadmap

- [ ] Support for more AI models (GPT4All, LocalAI)
- [ ] Advanced content filtering options
- [ ] Question templates and presets
- [ ] Bulk analysis for multiple pages
- [ ] Integration with note-taking apps
- [ ] Mobile browser support
- [ ] Custom AI model fine-tuning

## 🙏 Acknowledgments

- **Ollama Team**: For creating an excellent local AI platform
- **Chrome Extension Community**: For best practices and examples
- **Open Source Contributors**: For various utilities and libraries used

---

**Made with ❤️ for privacy-conscious users who want powerful AI without compromising their data.**