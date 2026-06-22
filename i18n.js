/* ============================================
   Lang Utils - i18n Helper
   Supports user-configurable UI locale.
   Loads _locales/{code}/messages.json manually
   based on stored uiLocale preference.
   Falls back to browser default, then English.
   ============================================ */
window.LUI18n = (function () {
  "use strict";

  // Language display names (code → localized name)
  var LANG_NAMES = {
    es: { es: "Espanol", en: "Spanish" },
    en: { es: "English", en: "English" },
    pt: { es: "Portugues", en: "Portuguese" },
    fr: { es: "Francais", en: "French" },
    de: { es: "Deutsch", en: "German" },
    it: { es: "Italiano", en: "Italian" },
    zh: { es: "Chino", en: "Chinese" },
    ja: { es: "Japones", en: "Japanese" },
    ko: { es: "Coreano", en: "Korean" },
    ru: { es: "Ruso", en: "Russian" },
    nl: { es: "Holandes", en: "Dutch" },
    pl: { es: "Polaco", en: "Polish" },
    tr: { es: "Turco", en: "Turkish" },
    ar: { es: "Arabe", en: "Arabic" },
    hi: { es: "Hindi", en: "Hindi" }
  };

  // English fallback messages (hardcoded)
  var EN_MESSAGES = {
    extensionName: "Lang Utils",
    extensionDescription: "AI language utilities: translate, summarize, explain and more",
    popup_title: "Lang Utils",
    popup_status_verifying: "Checking...",
    popup_status_configured: "API configured",
    popup_status_not_configured: "API not configured",
    popup_status_configure_hint: "Set your API key to get started",
    popup_status_model: "Model: ",
    popup_status_error: "Error",
    popup_favorites: "Favorites",
    popup_settings: "Settings",
    popup_chatbot: "Chatbot",
    popup_available_modes: "Available modes",
    popup_no_modes: "No modes configured",
    options_title: "Lang Utils - Settings",
    options_subtitle: "Configure your API and create custom AI language tools",
    options_api_config: "API Settings",
    options_api_url_hint: "Compatible with OpenAI, OpenRouter, LM Studio, Ollama, vLLM, etc.",
    options_api_key_hint: "Your API key. Stored locally in Firefox.",
    options_model: "Model",
    options_model_hint: "e.g. gpt-4o, gpt-3.5-turbo, llama3, qwen2.5",
    options_temperature: "Temperature",
    options_main_language: "Main language",
    options_main_language_hint: "Language for translating modes and auto-detection",
    options_save: "Save",
    options_test_connection: "Test connection",
    options_saved: "Saved",
    options_testing: "Testing...",
    options_modes_title: "Modes / Tools",
    options_add_mode: "+ New Mode",
    options_add_group: "+ New Group",
    options_reset_defaults: "Restore defaults",
    options_prompt_variables: "Available variables in prompts",
    options_prompt_variables_hint: "Use {{selection}} to insert the user's selected text.",
    options_prompt_variables_example: "Example: Translate this to French: {{selection}}",
    options_tw_title: "Translate / Write Mode",
    options_tw_target_lang: "Target language",
    options_tw_target_lang_hint: "Language your text will be translated to while typing",
    options_tw_debounce: "Debounce (milliseconds)",
    options_tw_debounce_hint: "Wait time after you stop typing (500-5000ms)",
    mode_name: "Mode name",
    mode_name_placeholder: "e.g. Translate to German",
    mode_prompt: "Prompt (AI instruction)",
    mode_prompt_placeholder: "Use {{selection}} where you want the selected text inserted...",
    mode_prompt_hint: "Include {{selection}} to insert the selected text.",
    mode_model_optional: "Model (optional)",
    mode_model_placeholder: "Empty = use global model",
    mode_model_hint: "Leave empty to use the model configured above.",
    group_description: "Groups contain sub-modes that appear as a submenu in the context menu and toolbar. Add sub-modes after creating the group.",
    presets_label: "Quick presets (click to use)",
    preset_translate: "Translate",
    preset_fix: "Fix",
    preset_formal: "Formalize",
    preset_informal: "Informalize",
    preset_keypoints: "Key points",
    preset_code: "Generate code",
    preset_json: "To JSON",
    preset_eli5: "ELI5",
    modal_cancel: "Cancel",
    modal_save_mode: "Save mode",
    modal_save_sub: "Save sub-mode",
    modal_new_mode: "New Mode",
    modal_edit_mode: "Edit Mode",
    modal_new_group: "New Group",
    modal_edit_group: "Edit Group",
    modal_new_sub: "New Sub-Mode",
    modal_edit_sub: "Edit Sub-Mode",
    sub_mode_name: "Sub-mode name",
    sub_mode_name_placeholder: "e.g. Informal",
    sub_mode_model: "Model (optional, inherits from group if empty)",
    sub_mode_model_placeholder: "Empty = inherit from group or global",
    confirm_reset: "Restore default modes? Custom modes will be deleted.",
    confirm_delete: "Delete this mode?",
    confirm_delete_sub: "Delete this sub-mode?",
    error_cannot_delete: "You cannot delete default modes.",
    no_modes: "No modes configured",
    sub_modes_count: "sub-modes",
    type_group: "Group",
    type_mode: "Mode",
    content_copy: "Copy",
    content_close: "Close",
    content_result: "Result",
    content_error: "Error",
    content_processing: "Processing with AI...",
    content_copy_all: "Copy all",
    content_confirm_yes: "Yes, process",
    content_confirm_no: "Cancel",
    content_undo: "Undo",
    content_tw_active: "Translate mode active",
    content_tw_stop: "Stop translation",
    content_tw_activate: "Activate translate mode",
    content_copied: " Copied!",
    chatbot_title: "Lang Utils Chat",
    chatbot_context_label: "Selected text:",
    chatbot_no_text: "(No text selected)",
    chatbot_greeting: "Hi! I'm your Lang Utils assistant. I can help you analyze, translate, summarize, or explain the selected text. What would you like to know?",
    chatbot_input_placeholder: "Ask a question about the text...",
    chatbot_summarize: "Summarize",
    chatbot_explain: "Explain",
    chatbot_keypoints: "Key points",
    chatbot_translate_en: "Translate EN",
    chatbot_translate_es: "Translate ES",
    bg_api_not_configured: "No API key configured. Go to extension settings.",
    bg_lang_detection_failed: "Language detection failed",
    bg_same_lang_confirm: "The text is already in ",
    bg_same_lang_confirm_suffix: ". Process anyway?",
    bg_system_prompt: "You are a language utility assistant. Reply clear and direct.",
    bg_test_prompt: "Reply with only the word OK",
    bg_chatbot_menu: "Ask about the text...",
    bg_chatbot_system: "You are a Lang Utils assistant. The user has selected the following text from a webpage and wants to discuss it with you. Reply clearly, usefully and concisely.\n\n",
    bg_chatbot_lang_hint: "Reply in the same language the user writes. If they don't specify a language, reply in English.",
    lang_es: "Spanish", lang_en: "English", lang_pt: "Portuguese", lang_fr: "French",
    lang_de: "German", lang_it: "Italian", lang_zh: "Chinese", lang_ja: "Japanese",
    lang_ko: "Korean", lang_ru: "Russian", lang_nl: "Dutch", lang_pl: "Polish",
    lang_tr: "Turkish", lang_ar: "Arabic", lang_hi: "Hindi"
  };

  // Translation cache: { key: message }
  var _cache = {};
  var _currentLocale = null;
  var _loaded = false;

  // Get the browser's default locale (e.g. "es" from "es-MX")
  function getBrowserLocale() {
    try {
      var lang = browser.i18n.getUILanguage ? browser.i18n.getUILanguage() : "en";
      return lang.split("-")[0];
    } catch (e) {
      return "en";
    }
  }

  // Load translations from _locales/{code}/messages.json
  async function loadLocale(code) {
    if (!code || code === "en") {
      _cache = Object.assign({}, EN_MESSAGES);
      _currentLocale = "en";
      _loaded = true;
      return;
    }
    try {
      var url = browser.runtime.getURL("_locales/" + code + "/messages.json");
      var resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      var data = await resp.json();
      // Convert Firefox message format { key: { message: "..." } } to { key: "..." }
      _cache = {};
      for (var key in data) {
        if (data[key] && data[key].message) {
          _cache[key] = data[key].message;
        }
      }
      _currentLocale = code;
      _loaded = true;
    } catch (e) {
      // Fallback to English if loading fails
      _cache = Object.assign({}, EN_MESSAGES);
      _currentLocale = "en";
      _loaded = true;
    }
  }

  // Initialize: read stored uiLocale and load it
  async function init() {
    var locale = null;
    try {
      var stored = await browser.storage.local.get(["uiLocale"]);
      locale = stored.uiLocale || null;
    } catch (e) {}
    if (!locale) {
      locale = getBrowserLocale();
    }
    await loadLocale(locale);
  }

  // Get a translated message by key (synchronous)
  // Requires init() to have completed first
  function msg(key, substitutions) {
    // If loaded and we have the key in cache, use it
    if (_loaded && _cache[key]) return _cache[key];
    // Fallback: try browser.i18n.getMessage (browser default locale)
    try {
      var result = browser.i18n.getMessage(key, substitutions);
      if (result) return result;
    } catch (e) {}
    // Fallback: try English hardcoded
    if (EN_MESSAGES[key]) return EN_MESSAGES[key];
    // Last resort: return key itself
    return key;
  }

  // Get localized language name for a language code
  function langName(code) {
    var uiLang = _loaded ? _currentLocale : getBrowserLocale();
    var names = LANG_NAMES[code];
    if (!names) return code;
    return names[uiLang] || names.en || code;
  }

  // Get all language options as [{code, name}]
  function langOptions() {
    return Object.keys(LANG_NAMES).map(function (code) {
      return { code: code, name: langName(code) };
    });
  }

  // Apply translations to all elements with data-i18n attribute
  function translatePage() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var text = msg(key);
      if (text && text !== key) {
        el.textContent = text;
      }
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      var text = msg(key);
      if (text && text !== key) {
        el.title = text;
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      var text = msg(key);
      if (text && text !== key) {
        el.placeholder = text;
      }
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-html");
      var text = msg(key);
      if (text && text !== key) {
        el.innerHTML = text;
      }
    });
  }

  // Get current locale
  function getLocale() {
    return _currentLocale || getBrowserLocale();
  }

  // Set locale and save to storage (does NOT reload pages)
  async function setLocale(code) {
    await browser.storage.local.set({ uiLocale: code });
    await loadLocale(code);
  }

  // Init on script load (auto-run)
  init();

  return {
    msg: msg,
    langName: langName,
    langOptions: langOptions,
    translatePage: translatePage,
    init: init,
    setLocale: setLocale,
    getLocale: getLocale
  };
})();
