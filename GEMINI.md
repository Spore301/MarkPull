# MarkPull - Gemini Project Context

## Project Overview
**MarkPull** is a Chrome extension designed to extract webpage content into clean, linted Markdown. It prioritizes semantic structure and minimizes clutter, providing a "function-first" experience for developers and researchers.

### Key Technologies
- **Framework:** React 19 (Vite + CRXJS for extension management)
- **Extraction:** Custom Turndown-based engine (`extractor.js`)
- **UI:** Side Panel API, monochrome aesthetic, Lucide React icons
- **Persistence:** Google Drive and GitHub API integration
- **Validation:** Markdown linting and auto-fixing (`linter.js`)

## Directory Structure
- `markpull-ext/`: Main extension source code
  - `src/`: React components and core logic
    - `background.js`: Service worker for OAuth and cloud sync
    - `content.js`: Injected script for DOM selection
    - `extractor.js`: HTML to Markdown conversion engine
    - `linter.js`: Markdown validation logic
    - `App.jsx`: Main UI container for the side panel
  - `manifest.json`: Chrome extension configuration
- `MarkPull PRD.md`: Original product requirements document
- `README.md`: Root project overview (placeholder)

## Building and Running
All extension commands should be run from within the `markpull-ext` directory.

### Prerequisites
- Node.js (v18+)
- npm

### Commands
- **Development:** `npm run dev` (Starts Vite with HMR)
- **Production Build:** `npm run build` (Generates `dist/` folder)
- **Linting:** `npm run lint` (ESLint check)
- **Preview:** `npm run preview`

### Loading the Extension
1. Run `npm run build`.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `markpull-ext/dist` directory.

## Development Conventions
- **UI Philosophy:** Functional satisfaction, monochrome, "zero-decoration".
- **Code Style:** Use ESM for all modules. Follow the existing React 19 patterns (Hooks-heavy).
- **Safety:** Never log OAuth tokens or user content to the console in production builds.
- **Error Handling:** Gracefully handle "Could not inject content script" errors when navigating to restricted pages (e.g., `chrome://` URLs).
- **Testing:** New features should be verified by loading the unpacked extension in a fresh Chrome profile or using Vite's dev mode.

## Important Notes
- The extension uses the Chrome Side Panel API. Ensure your browser is up to date.
- Google OAuth is required for cloud saving features. Ensure `manifest.json` has the correct `client_id` for your local environment if testing auth.
