## Task Overview
Implement a new **Settings Page** within the MarkPull Chrome Extension to allow users to configure their AI providers. The goal is to optimize for **Ease of Tool Access**. Instead of forcing users to choose complex configurations, we want a seamless experience where they simply select a vendor, paste their API key, and specify a model name. This will enable the extension's RAG (Retrieval-Augmented Generation) capabilities to work with the user's own preferred AI models.

## Technical Context
- **Framework:** React (Vite-based Chrome Extension)
- **State Management/Persistence:** `markpull-ext/src/storage.js` (uses `chrome.storage.local`)
- **Current UI Structure:** `App.jsx` uses an `activeTab` state to switch between 'extract', 'library', and 'chat'.
- **Existing Components:** `Chat.jsx` is where the AI interaction happens.

## Requirements

### 1. UI/UX: Settings Page
- **New Tab:** Add a new `activeTab` option called `'settings'`. Add a corresponding icon (e.g., `Settings` from `lucide-react`) to the view selector in `App.jsx`.
- **Vendor List:** Create a `Settings.jsx` component that lists the following vendors:
  1. OpenAI
  2. DeepSeek
  3. Anthropic
  4. Ollama (Local)
  5. OpenRouter
- **Configuration Fields per Vendor:**
  - **API Key:** A password-type input field for the user to paste their key.
  - **Model Name:** A text input field where users can paste their specific model of choice (e.g., `gpt-4o`, `claude-3-5-sonnet`, `deepseek-coder`).
- **Visual Style:** Ensure the settings page matches the existing "pill" and "panel" design system used in `App.jsx` and `App.css`.

### 2. Data Persistence
- **Storage Schema:** Use `markpull-ext/src/storage.js` to save these settings. I suggest a structured object under a single key (e.g., `ai_config`):
  ```json
  {
    "activeVendor": "openai",
    "vendors": {
      "openai": { "apiKey": "...", "model": "gpt-4o" },
      "deepseek": { "apiKey": "...", "model": "deepseek-chat" },
      ...
    }
  }
  ```
- **Auto-Save:** Implement auto-save functionality so that as soon as a user finishes typing or clicks out of a field, the data is persisted to `chrome.storage.local`.

### 3. Integration with AI Logic (RAG)
- **Refactor Chat/AI Logic:** The existing AI implementation (likely in `Chat.jsx` or a background script) must be updated to:
  1. Fetch the `ai_config` from storage.
  2. Identify the `activeVendor`.
  3. Use the stored `apiKey` and `model` to make the actual API calls.
- **RAG Context:** Ensure that when the AI is called, the markdown content (extracted via `extractor.js`) is passed as context to the selected model, following the RAG pattern.

### 4. Implementation Steps
1. **Update `App.jsx`**: Add the `'settings'` tab to the state and the navigation UI.
2. **Create `Settings.jsx`**: Build the UI with the vendor list and input fields.
3. **Update `storage.js`**: Add helper functions `setAiConfig(config)` and `getAiConfig()`.
4. **Connect UI to Storage**: Ensure `Settings.jsx` reads from and writes to storage.
5. **Update AI Execution**: Modify the logic that handles chat requests to use the new dynamic configuration instead of hardcoded values.

## Definition of Done
- [ ] User can switch to the Settings tab.
- [ ] User can enter an API key and model name for any of the 5 vendors.
- [ ] Settings persist after the extension popup is closed and reopened.
- [ ] The Chat component successfully uses the configured vendor/key/model to generate responses based on the markdown context.
- [ ] No hardcoded API keys exist in the codebase.