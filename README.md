# Lang Utils

AI-powered language utilities browser extension: translate, rewrite, summarize, explain, and chat about selected text using any OpenAI-compatible API (OpenAI, OpenRouter, Ollama, LM Studio, vLLM, etc.).

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-purple)
![Firefox](https://img.shields.io/badge/Firefox-109%2B-blue?logo=firefox)
![Chrome](https://img.shields.io/badge/Chrome-88%2B-green?logo=googlechrome)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### AI Tools

- **Translation** — Translate text to 15 languages with automatic source language detection
- **Rewriting** — Rewrite in different styles: informal, formal, street, academic, creative, concise, persuasive
- **Summarization** — Summarize long texts clearly and concisely
- **Explanation** — Explain complex texts in simple terms or in your own way
- **Chatbot** — Chat with AI about the selected text

### Translate / Write Mode

Type directly in any text field and it translates automatically:

1. Click on an input/textarea
2. The **LU** indicator appears → click it
3. Select **"Activate translate mode"**
4. Choose the target language
5. Type — after a configurable pause, the text is translated and replaced

Configurable: debounce (500-5000ms), target language.

### Interface

- **Context menu** — Right-click → Lang Utils → choose your tool
- **LU indicator** — Floating button on text inputs with quick access to all tools
- **Floating toolbar** — Appears when selecting text with favorite modes
- **Groups** — Organize tools in groups with sub-menus (e.g. "Rewrite" → Informal, Formal, etc.)
- **Favorites** — Mark your most-used tools for quick access

### Theming (new in v2.0)

Pick from 5 built-in themes or customize every color:

- **Midnight** — Dark blue/red (default)
- **Light** — Clean white/gray
- **Ocean** — Deep blue with teal accents
- **Solarized** — The classic Solarized dark palette
- **Rose** — Warm pink/magenta
- **Custom** — Pick every color individually, then export/import as JSON

Themes apply to all extension pages (popup, options, chatbot) AND to the content-script UI injected into web pages.

### Full Multilanguage UI

The extension's own interface is available in 6 languages:

- 🇬🇧 English
- 🇪🇸 Spanish (default)
- 🇧🇷 Portuguese
- 🇫🇷 French
- 🇩🇪 German
- 🇮🇹 Italian

Switch language in **Settings → Main language**. The change applies immediately to all extension pages.

### Full CRUD

- Create, edit, and delete custom modes
- Create groups with nested sub-menus
- Quick presets: Translate, Fix, Formalize, Informalize, Key Points, Generate Code, To JSON, ELI5
- Restore default modes
- Translate modes and prompts to your language with one click

### Compatibility

- Compatible with any OpenAI-compatible API (`/v1/chat/completions`)
- Stores your API key locally (never sent to external servers)
- Works in Firefox 109+ and Chrome 88+

---

## Installation

### Build from source

```bash
# Install dependencies
npm install

# Typecheck + bundle into dist/
npm run build

# Or build + package as zip
npm run package

# Build for specific target
npm run package:firefox
npm run package:chrome
```

The output goes to `dist/` — load that folder directly in your browser as an unpacked extension.

### Load in Firefox

1. Run `npm run build`
2. Open `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on..."**
4. Select `dist/manifest.json`

### Load in Chrome / Edge / Brave

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right)
4. Click **"Load unpacked"**
5. Select the `dist/` folder

---

## Configuration

### API

1. Click the extension icon → **Settings**
2. Configure:
   - **API Base URL** — `https://api.openai.com/v1` or `http://localhost:11434/v1` (Ollama)
   - **API Key** — Your API key
   - **Model** — `gpt-4o-mini`, `llama3`, `qwen2.5`, etc.
   - **Temperature** — 0 to 2 (default: 0.7)
3. **Test connection** to verify
4. **Save**

### Translate Mode

- **Target language**: 13 languages available
- **Debounce**: 500-5000ms (default: 1500ms)
- Configured in Options page → "Translate / Write Mode"

### Theme

- Options page → "Theme"
- Pick a preset or choose "Custom" to pick every color
- Export your custom theme as JSON to share or back up
- Import a previously-exported theme

---

## Usage

### Context menu (right-click)

1. Select text on any page
2. Right-click → **Lang Utils**
3. Choose the tool

### LU indicator (text inputs)

1. Click on a text field / textarea / contenteditable
2. The **LU** button appears at the top-right corner of the field
3. Click it → the menu opens with all tools
4. Select a tool or activate translate mode

### Shortcuts

| Action | How |
|--------|-----|
| Translate selected text | Select → right-click → Translate |
| Translate mode in input | Click input → LU → Activate translate mode |
| Chatbot | Select text → right-click → Ask about text |
| Settings | Click icon → Settings |
| Change theme | Settings → Theme → pick preset or customize |

---

## Project Structure

```
lang-utils/
├── src/                          # TypeScript source
│   ├── manifest.json             # MV3 manifest (cross-browser)
│   ├── types/                    # Shared types (Mode, Settings, Theme, ...)
│   │   ├── index.ts
│   │   └── messages.ts           # i18n message keys
│   ├── lib/                      # Shared libraries
│   │   ├── browser-compat.ts     # webextension-polyfill wrapper
│   │   ├── storage.ts            # Typed storage helpers
│   │   ├── api.ts                # OpenAI-compatible API client
│   │   ├── i18n.ts               # i18n manager
│   │   ├── utils.ts              # escapeHtml, markdownToHtml, clipboard
│   │   ├── themes.ts             # Theme manager + presets
│   │   └── dom.ts                # Typed DOM helpers
│   ├── background/
│   │   ├── index.ts              # Entry point: wires up listeners
│   │   ├── messaging.ts          # Message router + AI processing
│   │   ├── modes.ts              # Default modes data
│   │   └── mode-helpers.ts       # Pure mode helpers
│   ├── content/
│   │   ├── index.ts              # Panel, toolbar, form injection, TW
│   │   └── styles.ts             # Injected CSS (uses theme vars)
│   ├── popup/                    # Toolbar popup window
│   ├── options/                  # Settings page (incl. theme UI)
│   ├── chatbot/                  # Chat window
│   ├── styles/
│   │   └── themes.css            # CSS variables (defaults)
│   └── _locales/                 # i18n message files
│       ├── en/messages.json
│       ├── es/messages.json
│       ├── pt/messages.json
│       ├── fr/messages.json
│       ├── de/messages.json
│       └── it/messages.json
├── scripts/
│   ├── build.mjs                 # esbuild-based bundler
│   └── update-css.py             # Helper: replace hardcoded colors
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development

### Requirements

- Node.js 18+
- npm

### Build

```bash
npm install
npm run build          # one-shot build → dist/
npm run build:watch    # rebuild on file change
npm run typecheck      # tsc --noEmit
```

### Architecture notes

- **TypeScript strict mode** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`. The whole codebase typechecks clean.
- **Single source of truth** for browser API via `webextension-polyfill` (works in both Firefox and Chrome).
- **CSS variables** drive theming — `--lu-bg`, `--lu-accent`, etc. — applied to `:root` by the theme manager.
- **Manifest V3** with `service_worker` (Chrome) + `browser_specific_settings.gecko` (Firefox). The build script can emit either target.
- **Deduplicated code**: API calls, storage access, mode helpers, DOM helpers, i18n — all centralized in `src/lib/`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No API key configured" | Set your API key in Settings |
| "API Error 401" | Invalid or expired API key |
| "API Error 404" | Wrong API URL (check `/v1/chat/completions`) |
| "Network Error" | No connection or local API not running |
| Context menu doesn't appear | Reload the page, check extension in `about:addons` / `chrome://extensions` |
| LU indicator doesn't appear | Verify content script is injected (F12 console) |
| Translated text not sent | App may use internal state; report the site |

---

## License

MIT License — use, modify, and distribute freely.
