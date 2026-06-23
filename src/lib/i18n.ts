// ============================================
// Lang Utils - i18n helper
// Loads _locales/{code}/messages.json based on
// the stored uiLocale preference. Falls back to
// browser default, then English.
// ============================================

import browser from "./browser-compat";
import type { MessageKey } from "../types/messages";

/** Map of supported language codes → native name (the language's own name) and ES/EN fallbacks. */
export const LANG_NAMES: Record<
  string,
  { native: string; es: string; en: string }
> = {
  es: { native: "Espanol", es: "Espanol", en: "Spanish" },
  en: { native: "English", es: "English", en: "English" },
  pt: { native: "Portugues", es: "Portugues", en: "Portuguese" },
  fr: { native: "Francais", es: "Frances", en: "French" },
  de: { native: "Deutsch", es: "Aleman", en: "German" },
  it: { native: "Italiano", es: "Italiano", en: "Italian" },
  zh: { native: "中文", es: "Chino", en: "Chinese" },
  ja: { native: "日本語", es: "Japones", en: "Japanese" },
  ko: { native: "한국어", es: "Coreano", en: "Korean" },
  ru: { native: "Русский", es: "Ruso", en: "Russian" },
  nl: { native: "Nederlands", es: "Holandes", en: "Dutch" },
  pl: { native: "Polski", es: "Polaco", en: "Polish" },
  tr: { native: "Turkce", es: "Turco", en: "Turkish" },
  ar: { native: "العربية", es: "Arabe", en: "Arabic" },
  hi: { native: "हिन्दी", es: "Hindi", en: "Hindi" },
};

/** English fallback messages (hardcoded so the extension works even if locale files are missing). */
const EN_MESSAGES: Record<MessageKey, string> = {
  extensionName: "Lang Utils",
  extensionDescription:
    "AI language utilities: translate, summarize, explain and more",
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
  options_subtitle:
    "Configure your API and create custom AI language tools",
  options_api_config: "API Settings",
  options_api_url_hint:
    "Compatible with OpenAI, OpenRouter, LM Studio, Ollama, vLLM, etc.",
  options_api_key_hint: "Your API key. Stored locally in your browser.",
  options_model: "Model",
  options_model_hint: "e.g. gpt-4o, gpt-3.5-turbo, llama3, qwen2.5",
  options_temperature: "Temperature",
  options_main_language: "Main language",
  options_main_language_hint:
    "Language for translating modes and auto-detection",
  options_save: "Save",
  options_test_connection: "Test connection",
  options_saved: "Saved",
  options_testing: "Testing...",
  options_modes_title: "Modes / Tools",
  options_add_mode: "+ New Mode",
  options_add_group: "+ New Group",
  options_reset_defaults: "Restore defaults",
  options_prompt_variables: "Available variables in prompts",
  options_prompt_variables_hint:
    "Use {{selection}} to insert the user's selected text.",
  options_prompt_variables_example:
    "Example: Translate this to French: {{selection}}",
  options_tw_title: "Translate / Write Mode",
  options_tw_target_lang: "Target language",
  options_tw_target_lang_hint:
    "Language your text will be translated to while typing",
  options_tw_debounce: "Debounce (milliseconds)",
  options_tw_debounce_hint:
    "Wait time after you stop typing (500-5000ms)",
  options_result_popup: "Result popup",
  options_result_popup_hint:
    "Show results as a small popup near the selected text that closes when you click outside or change focus.",
  options_themes_title: "Theme",
  options_themes_select: "Select a theme",
  options_themes_customize: "Customize colors",
  options_themes_bg: "Background",
  options_themes_bg_panel: "Panel background",
  options_themes_bg_input: "Input background",
  options_themes_border: "Border",
  options_themes_border_strong: "Strong border",
  options_themes_text: "Text",
  options_themes_text_muted: "Muted text",
  options_themes_text_on_accent: "Text on accent",
  options_themes_accent: "Accent",
  options_themes_accent_hover: "Accent (hover)",
  options_themes_success: "Success",
  options_themes_warning: "Warning",
  options_themes_danger: "Danger",
  options_themes_favorite: "Favorite star",
  options_themes_preset_midnight: "Midnight",
  options_themes_preset_light: "Light",
  options_themes_preset_ocean: "Ocean",
  options_themes_preset_solarized: "Solarized",
  options_themes_preset_rose: "Rose",
  options_themes_apply: "Apply theme",
  options_themes_export: "Export theme",
  options_themes_import: "Import theme",
  mode_name: "Mode name",
  mode_name_placeholder: "e.g. Translate to German",
  mode_prompt: "Prompt (AI instruction)",
  mode_prompt_placeholder:
    "Use {{selection}} where you want the selected text inserted...",
  mode_prompt_hint: "Include {{selection}} to insert the selected text.",
  mode_model_optional: "Model (optional)",
  mode_model_placeholder: "Empty = use global model",
  mode_model_hint: "Leave empty to use the model configured above.",
  group_description:
    "Groups contain sub-modes that appear as a submenu in the context menu and toolbar. Add sub-modes after creating the group.",
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
  content_undo: "Undo",
  content_tw_active: "Translate mode active",
  content_tw_stop: "Stop translation",
  content_tw_activate: "Activate translate mode",
  content_copied: " Copied!",
  chatbot_title: "Lang Utils Chat",
  chatbot_context_label: "Selected text:",
  chatbot_no_text: "(No text selected)",
  chatbot_greeting:
    "Hi! I'm your Lang Utils assistant. I can help you analyze, translate, summarize, or explain the selected text. What would you like to know?",
  chatbot_input_placeholder: "Ask a question about the text...",
  chatbot_summarize: "Summarize",
  chatbot_explain: "Explain",
  chatbot_keypoints: "Key points",
  chatbot_translate_en: "Translate EN",
  chatbot_translate_es: "Translate ES",
  bg_api_not_configured:
    "No API key configured. Go to extension settings.",
  bg_system_prompt:
    "You are a language utility assistant. Reply clear and direct.",
  bg_test_prompt: "Reply with only the word OK",
  bg_chatbot_menu: "Ask about the text...",
  bg_chatbot_system:
    "You are a Lang Utils assistant. The user has selected the following text from a webpage and wants to discuss it with you. Reply clearly, usefully and concisely.\n\n",
  bg_chatbot_lang_hint:
    "Reply in the same language the user writes. If they don't specify a language, reply in English.",
  lang_es: "Spanish",
  lang_en: "English",
  lang_pt: "Portuguese",
  lang_fr: "French",
  lang_de: "German",
  lang_it: "Italian",
  lang_zh: "Chinese",
  lang_ja: "Japanese",
  lang_ko: "Korean",
  lang_ru: "Russian",
  lang_nl: "Dutch",
  lang_pl: "Polish",
  lang_tr: "Turkish",
  lang_ar: "Arabic",
  lang_hi: "Hindi",
};

// ---- Module state ----
let cache: Record<string, string> = {};
let currentLocale: string | null = null;
let loaded = false;
let initPromise: Promise<void> | null = null;

/** Get the browser's default locale (e.g. "es" from "es-MX"). */
function getBrowserLocale(): string {
  try {
    const lang: string = browser.i18n.getUILanguage
      ? browser.i18n.getUILanguage()
      : "en";
    return lang.split("-")[0] || "en";
  } catch {
    return "en";
  }
}

/** Load a locale's messages from _locales/{code}/messages.json. */
async function loadLocale(code: string | null): Promise<void> {
  if (!code || code === "en") {
    cache = { ...EN_MESSAGES };
    currentLocale = "en";
    loaded = true;
    return;
  }
  try {
    const url = browser.runtime.getURL("_locales/" + code + "/messages.json");
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = (await resp.json()) as Record<string, { message?: string }>;
    cache = {};
    for (const key of Object.keys(data)) {
      const msg = data[key]?.message;
      if (typeof msg === "string") {
        cache[key] = msg;
      }
    }
    currentLocale = code;
    loaded = true;
  } catch {
    // Fallback to English
    cache = { ...EN_MESSAGES };
    currentLocale = "en";
    loaded = true;
  }
}

/** Initialize: read stored uiLocale and load it. */
async function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    let locale: string | null = null;
    try {
      const stored = await browser.storage.local.get(["uiLocale"]);
      locale = (stored.uiLocale as string) || null;
    } catch {
      // ignore
    }
    if (!locale) {
      locale = getBrowserLocale();
    }
    await loadLocale(locale);
  })();
  return initPromise;
}

/** Force a fresh re-init: clears cached locale/messages and re-fetches
 *  the stored uiLocale. Used when the user changes the main language
 *  setting in Options so msg() picks up the new locale immediately. */
export async function reinit(): Promise<void> {
  initPromise = null;
  loaded = false;
  cache = {};
  await init();
}

/** Get a translated message by key (synchronous; requires init() to have completed). */
export function msg(key: MessageKey, substitutions?: string | string[]): string {
  if (loaded && cache[key]) return cache[key];
  try {
    const result = browser.i18n.getMessage(key, substitutions);
    if (result) return result;
  } catch {
    // ignore
  }
  if (EN_MESSAGES[key]) return EN_MESSAGES[key];
  return key;
}

/** Get localized language name for a language code. */
export function langName(code: string): string {
  const uiLang = loaded ? currentLocale || "en" : getBrowserLocale();
  const names = LANG_NAMES[code];
  if (!names) return code;
  return names[uiLang as "es" | "en"] || names.en || code;
}

/** Get the language's own native name (e.g. "Espanol", "中文"), regardless of UI locale. */
export function nativeLangName(code: string): string {
  return LANG_NAMES[code]?.native || code;
}

/** Regional indicator flag emoji for a language code (e.g. "es" -> "🇪🇸"), empty string if unknown. */
export function langFlag(code: string): string {
  const map: Record<string, string> = {
    es: "🇪🇸",
    en: "🇬🇧",
    pt: "🇵🇹",
    fr: "🇫🇷",
    de: "🇩🇪",
    it: "🇮🇹",
    zh: "🇨🇳",
    ja: "🇯🇵",
    ko: "🇰🇷",
    ru: "🇷🇺",
    nl: "🇳🇱",
    pl: "🇵🇱",
    tr: "🇹🇷",
    ar: "🇸🇦",
    hi: "🇮🇳",
  };
  return map[code] || "";
}

/** All supported language codes, in display order. */
export function langCodes(): string[] {
  return Object.keys(LANG_NAMES);
}

/** Get all language options as [{code, name}]. */
export function langOptions(): Array<{ code: string; name: string }> {
  return Object.keys(LANG_NAMES).map((code) => ({
    code,
    name: langName(code),
  }));
}

/** Apply translations to all elements with data-i18n* attributes. */
export function translatePage(): void {
  const setAttr = (
    selector: string,
    attr: "textContent" | "title" | "placeholder" | "innerHTML"
  ) => {
    document.querySelectorAll(selector).forEach((el) => {
      const key = el.getAttribute(selector.slice(1, -1)) as MessageKey | null;
      if (!key) return;
      const text = msg(key);
      if (text && text !== key) {
        (el as unknown as Record<string, unknown>)[attr] = text;
      }
    });
  };

  setAttr("[data-i18n]", "textContent");
  setAttr("[data-i18n-title]", "title");
  setAttr("[data-i18n-placeholder]", "placeholder");
  setAttr("[data-i18n-html]", "innerHTML");
}

/** Get the current locale code. */
export function getLocale(): string {
  return currentLocale || getBrowserLocale();
}

/** Set the locale, persist it, and load it. */
async function setLocale(code: string): Promise<void> {
  await browser.storage.local.set({ uiLocale: code });
  await loadLocale(code);
}

/** Public i18n API. */
export const i18n = {
  init,
  reinit,
  msg,
  langName,
  langOptions,
  translatePage,
  getLocale,
  setLocale,
};

export default i18n;
