# PRD — MarkPull Chrome Extension

## 1. Overview

**MarkPull** is a Chrome extension that extracts webpage content into clean, linted Markdown. It is built for developers, writers, and researchers who need reliable MD output without noise — no clutter, no paywall friction, no bloat. The interface is minimal, monochrome, and function-first.

---

## 2. Problem Statement

Existing "save as markdown" tools either dump the entire DOM with poor formatting, ignore semantic structure, or produce MD that requires heavy manual cleanup. There is no tool that lets users selectively extract sections, validates the output for lint compliance, and persists exports to cloud storage — all from a single, distraction-free panel.

---

## 3. Goals

- Extract any webpage or selected sections of it into valid, linted Markdown
- Give users granular control over what gets extracted
- Output MD that is immediately usable — no cleanup required
- Enable copy-to-clipboard and file download post-extraction
- Persist exports to cloud storage with a lightweight sync model
- Ship a UI that is zero-decoration, black-and-white, function-first

---

## 4. Non-Goals

- Rich text editor or in-extension MD editing (v1)
- Browser-native PDF export
- Support for Firefox/Safari (v1 is Chromium-only)
- AI-assisted summarization or rewriting of extracted content
- Team collaboration or shared vaults (v2)

---

## 5. Users

| Persona | Use Case |
|---|---|
| Developer / technical writer | Extract docs, API references, READMEs from web pages |
| Researcher | Pull structured content from articles, papers, wikis |
| Content creator | Capture reference material in a portable, clean format |
| Power user / note-taker | Build a personal knowledge base from browser sessions |

---

## 6. Core Features

### 6.1 Section Selection

- On activation, the extension overlays a **visual section picker** on the active tab
- Hoverable regions are inferred from semantic HTML (`<article>`, `<section>`, `<h1>`–`<h6>`, `<p>`, `<ul>`, `<table>`, `<pre>`, `<blockquote>`) and DOM block boundaries
- Users can **click to toggle** individual sections on/off — selected sections get a 1px black border highlight
- A "select all" and "clear all" control is always visible
- Section tree is displayed in the extension panel as a collapsible outline, mirroring the on-page selection state
- Hovering a tree item highlights the corresponding DOM region on-page

### 6.2 Markdown Extraction Engine

- Converts selected HTML regions to MD via a custom parser (not Turndown default — extended for correctness)
- Handles: headings, paragraphs, bold/italic/code/strikethrough inline, fenced code blocks with language tag inference, ordered and unordered lists (nested), blockquotes, tables (GFM), images with alt text, hyperlinks, horizontal rules
- Strips: ads, nav elements, cookie banners, script/style tags, social share widgets (heuristic-based + user-configurable blocklist)
- Preserves: heading hierarchy, list nesting depth, code language where `class="language-*"` is present, table alignment

### 6.3 MD Linting & Auto-Fix

- Output is validated against **markdownlint** rule set (MD013 line length, MD022 heading spacing, MD031 fenced code blocks, MD032 list spacing, MD041 first-line heading, etc.)
- Lint violations are **auto-fixed** before display — not flagged to the user unless auto-fix is impossible
- Unfixable violations surface as inline warnings with rule ID in the output panel
- Option to toggle strict vs. relaxed lint mode (relaxed disables MD013 line-length)

### 6.4 Rule-Based Formatting (Non-AI)

To maintain the source website as "ground truth" and avoid hallucinations, all formatting interventions are strictly deterministic:
- **Frontmatter Injection:** Users can enable auto-injection of YAML/JSON frontmatter containing metadata like `source_url`, `extraction_date`, `title`, and `author`.
- **Selector-Based Overrides:** Users can configure formatting rules mapped to CSS selectors (e.g., force all `<div class="warning">` to render as Markdown blockquotes `> [!WARNING]`).
- **Regex Replacements:** Simple find-and-replace rules run post-extraction to clean up recurring boilerplate text or format specific terminology consistently.
- **Markdown Flavors:** Options to output in strict CommonMark, GitHub Flavored Markdown (GFM), or Obsidian-flavored Markdown (e.g., using `[[Wikilinks]]`).

### 6.5 Output Panel

- Split layout: **source preview** (raw MD) on one side, **rendered preview** (HTML render of MD) on the other — toggleable between side-by-side and single-pane
- Filename is auto-generated from `<title>` + ISO date, editable before download
- Action bar with two primary actions: **Copy MD** (copies raw MD to clipboard) and **Download .md** (triggers file download)
- Character count, word count, heading count, and estimated read time shown in a status bar
- Syntax highlighting on raw MD pane (PrismJS, monochrome theme)

### 6.6 Cloud Save & Project Organization

- **Sidekick First:** MarkPull prioritizes immediate utility. Users can simply "Copy MD" or "Download .md" without ever saving, treating the tool as a transient sidekick.
- **Opt-in Project Management:** If the user wants to retain the export, they click "Save". Only then are they prompted to **"Add to Existing Project"** (dropdown) or **"Create New Project"**.
- Users authenticate via **Google OAuth** or **GitHub OAuth**.
- **Projects as Folders:** A project is essentially a folder in Google Drive or a directory/repo in GitHub. Saved `.md` files are routed to these designated project folders.
- Saved files are listed in a **Library** tab, filtered by Project.
- Offline queue: if save fails, it is queued and retried on next extension open.

---

## 7. UI & Design System

### Philosophy

Functional satisfaction. The interface leverages glassmorphism, fluid pill-shaped components, and satisfying micro-animations to create a premium, tactile experience. The extension should feel like a highly polished modern app.

### Design Tokens

| Token | Value |
|---|---|
| Background | Soft dynamic gradients / Frosted Glass (`backdrop-filter: blur(12px)`) |
| Text primary | High contrast, soft glow or sharp #FFFFFF / #111111 |
| Text secondary | Subtle `#888888` / `#A0A0A0` |
| Border | `1px solid rgba(255,255,255,0.1)` (Glass reflection) |
| Corner radius | `999px` for pills/buttons, `24px` for cards |
| Font | `JetBrains Mono` for MD output; `Inter` for UI chrome |
| Buttons | Pill-shaped, semi-transparent fills, satisfying hover scale |
| Hover state | `transform: scale(0.96)`, smooth background color shifts |
| Selection highlight | `outline: 2px solid var(--accent)` |
| Accent | Subtle contextual tints (e.g., deep blue-grey) |

### Layout

- Extension opens as a **side panel** (Chrome Side Panel API) — not a popup, not a new tab
- Panel width: 380px fixed, resizable to 520px
- Three tabs at top: **Extract**, **Output**, **Library**
- Tab bar is a plain horizontal rule with an underline indicator — no pill/capsule styling

---

## 8. Technical Architecture

### Extension Components

| Component | Role |
|---|---|
| `content.js` | Injected into active tab; handles DOM traversal, region highlighting, section selection |
| `extractor.js` | HTML → MD conversion engine; runs in content script context |
| `linter.js` | markdownlint integration; runs in service worker |
| `panel.html/js` | Side panel UI (React + Vite build) |
| `background.js` | Service worker; manages cloud sync queue, OAuth token refresh |
| `storage.js` | Abstraction over `chrome.storage.local` and remote backends |

### Permissions Required

- `activeTab` — access current tab DOM
- `sidePanel` — render the side panel
- `storage` — persist settings and offline queue
- `identity` — OAuth flow
- `scripting` — inject content scripts

### MD Conversion Stack

- HTML parsing: native `DOMParser` in content script
- MD serialization: custom serializer (Turndown base + custom rules)
- Linting: `markdownlint` (WASM build for service worker compatibility)
- Rendering: `marked.js` for preview pane

### Cloud Sync

- Google Drive: Google Drive REST API v3 — create/update files in `MarkPull/` folder
- GitHub: GitHub REST API — create/update file via `PUT /repos/{owner}/{repo}/contents/{path}`
- Tokens stored in `chrome.storage.local` (encrypted at rest by Chrome)

---

## 9. User Flows

### Primary Flow — Extract & Download

1. User navigates to target page
2. Opens MarkPull side panel
3. Clicks **"Pick sections"** → content script activates hover overlay
4. User clicks DOM regions to select; selection reflected in panel outline
5. Clicks **"Extract"** → MD generated, linted, displayed in Output tab
6. User reviews output in raw/rendered view
7. Clicks **"Copy MD"** or **"Download .md"**

### Secondary Flow — Extract & Save to Project

1–6. Same as above
7. Clicks **"Save"** (optional step for users not just downloading/copying)
8. Prompt appears: **"Add to Existing Project"** or **"Create New Project"**
9. User selects project → if not authenticated, OAuth modal opens
10. After auth, file saved to the Project folder in Drive/GitHub
11. Confirmation toast: `"Saved → ProjectName/filename.md"`
12. File appears in Library tab

### Library Flow

1. User opens Library tab
2. Scrollable list of past exports — filename, domain, date
3. Click row → opens raw MD in Output tab
4. Delete icon removes from Library (and optionally from cloud)

---

## 10. Settings

| Setting | Default | Description |
|---|---|---|
| Lint mode | Strict | Strict or Relaxed markdownlint rule set |
| Strip nav/ads | On | Heuristic noise removal |
| Custom blocklist | Empty | CSS selectors to always exclude |
| Cloud backend | None | Google Drive or GitHub |
| GitHub repo | — | `owner/repo` when GitHub selected |
| GitHub path prefix | `markpull/` | Folder prefix for commits |
| Auto-select all on open | Off | Skips section picker, selects full page |
| Dark mode | System | Follows OS, or forced on/off |

---

## 11. Milestones

| Milestone | Scope |
|---|---|
| M1 — Core extraction | Section picker, MD engine, lint, download/copy |
| M2 — Output panel | Side panel UI, raw/render split view, status bar |
| M3 — Cloud save (Drive) | Google OAuth, Drive API, Library tab |
| M4 — Cloud save (GitHub) | GitHub OAuth, commit API, Library search |
| M5 — Polish | Settings page, custom blocklist, keyboard shortcuts, onboarding |

---

## 12. Out of Scope / v2 Backlog

- Firefox / Safari support
- Folder organization in Library
- Team vaults / shared exports
- AI rewrite / summarize on extraction
- Scheduled extraction (web clipper automation)
- Obsidian / Notion / Roam direct integration

---

## 13. Project Management Dashboard (Scope)

The Dashboard is an optional, centralized view for users who intentionally choose to use MarkPull for knowledge acquisition, rather than just a quick sidekick tool. It aids the process without interfering with the core extraction flow.

### 13.1 Dashboard Goals
- Provide a high-level overview of all extracted "Projects."
- Enable bulk management and organization of Markdown files without needing to open Google Drive/GitHub directly.
- Act as a bridge between extraction and the user's final destination (e.g., Obsidian, Notion, GitHub).

### 13.2 Core Dashboard Features
- **Project Grid/List:** Visual cards for each Project containing:
    - Project Name, Number of Files, Total Word Count, and Date of last update.
- **File Explorer:** A tree-view of files within a project, allowing for:
    - Quick renaming of `.md` files.
    - Bulk export (zip all files in a project).
    - Deletion of redundant extractions.
- **Global Search:** Search across all projects for a specific keyword within the extracted Markdown content.
- **Export Pipeline:** A "Push to..." button to sync a whole project to a specific GitHub repo or local directory.

### 13.3 UX Constraint & Entry Point
- **Unobtrusive Access:** The Dashboard is accessed via a discreet "Dashboard" link in the extension panel or via an options page. It does not load by default.
- **Aesthetic:** The Dashboard must remain in the same monochrome, terminal-like aesthetic. It is a functional administrative layer, not a complex workspace.