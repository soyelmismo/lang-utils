# Lang Utils - Firefox Extension

Language utilities powered by AI: translate, rewrite, summarize, explain, and more using your preferred API (OpenAI, Ollama, LM Studio, OpenRouter, etc.).

[![Firefox](https://img.shields.io/badge/Firefox-57%2B-blue?logo=firefox)](https://www.mozilla.org/firefox/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

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
6. If you keep typing, everything is re-translated together

Configurable: debounce (500-5000ms), target language.

### Interface

- **Context menu** — Right-click → Lang Utils → choose your tool
- **LU indicator** — Floating button on text inputs with quick access to all tools
- **Floating toolbar** — Appears when selecting text with favorite modes
- **Groups** — Organize tools in groups with sub-menus (e.g. "Rewrite" → Informal, Formal, etc.)
- **Favorites** — Mark your most-used tools for quick access

### Full CRUD

- Create, edit, and delete custom modes
- Create groups with nested sub-menus
- Quick presets: Translate, Fix, Formalize, Informalize, Key Points, Generate Code, To JSON, ELI5
- Restore default modes
- Translate modes and prompts to your language with one click

### Compatibility

- Compatible with any OpenAI-compatible API (OpenAI, OpenRouter, Ollama, LM Studio, vLLM, etc.)
- Stores your API key locally (never sent to external servers)

---

## Installation

### Build

```bash
./build.sh
```

Generates `lang-utils-{version}.xpi`.

### Install in Firefox

1. Open `about:config`
2. Search `xpinstall.signatures.required` → set to `false`
3. Restart Firefox
4. Open `about:debugging#/runtime/this-firefox`
5. **"Load Temporary Add-on..."** → select `manifest.json`

> **Note:** Temporary add-ons are removed on Firefox restart. Repeat step 5 after each restart.

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

- **Target language**: 15 languages available
- **Debounce**: 500-5000ms (default: 1500ms)
- Configured in Options page → "Translate / Write Mode"

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

---

## Project Structure

```
lang-utils/
├── manifest.json          # Extension config (Manifest V2)
├── background.js          # Background script: API, menus, logic
├── content.js             # Content script: UI injected into pages
├── utils.js               # Shared utilities (escapeHtml, markdown, clipboard)
├── build.sh               # Build script with syntax check
├── generate-icons.sh      # Generates PNGs from SVGs
├── icons/                 # Icons
│   ├── icon-48.svg/png
│   └── icon-96.svg/png
├── popup/                 # Popup window
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/               # Settings page
│   ├── options.html
│   ├── options.js
│   └── options.css
└── chatbot/               # Chatbot window
    ├── chatbot.html
    ├── chatbot.js
    └── chatbot.css
```

---

## Development

### Requirements

- Firefox 57+
- Node.js (for syntax check in build)
- zip

### Build

```bash
./build.sh
```

The build runs `node --check` on all `.js` files before packaging.

### Regenerate icons

```bash
./generate-icons.sh     # Requires ImageMagick
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No API key configured" | Set your API key in Settings |
| "API Error 401" | Invalid or expired API key |
| "API Error 404" | Wrong API URL (check `/v1/chat/completions`) |
| "Network Error" | No connection or local API not running |
| Context menu doesn't appear | Reload the page, check extension in `about:addons` |
| LU indicator doesn't appear | Verify content script is injected (F12 console) |
| Translated text not sent | App may use internal state; report the site |

---

## Compatibility

- **Browser**: Firefox 57+ (WebExtensions API)
- **APIs**: Any OpenAI-compatible API (`/v1/chat/completions`)
- **Storage**: All local in Firefox
- **Privacy**: Only sends data to your configured API

---

## License

MIT License — use, modify, and distribute freely.
