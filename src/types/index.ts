// ============================================
// Lang Utils - Shared types
// Used across background, content, popup, options, chatbot
// ============================================

/** A single AI mode/tool (e.g. "Translate to English"). */
export interface Mode {
  id: string;
  name: string;
  prompt: string;
  model: string;
  type: "single";
  favorite: boolean;
  isDefault?: boolean;
  /** Shipped with the extension and editable, but cannot be deleted by the user. */
  protected?: boolean;
  /** Translation state — present when the user clicked 🌐 to translate the mode's name+prompt. */
  _originalName?: string;
  _originalPrompt?: string;
  _translatedTo?: string;
}

/** A sub-mode belonging to a group (e.g. "Informal" inside "Rewrite"). */
export interface SubMode {
  id: string;
  name: string;
  prompt: string;
  model: string;
  _originalName?: string;
  _originalPrompt?: string;
  _translatedTo?: string;
}

/** A group of sub-modes (e.g. "Rewrite" with Formal/Informal/Creative...). */
export interface ModeGroup {
  id: string;
  name: string;
  type: "group";
  model: string;
  favorite: boolean;
  subModes: SubMode[];
  _originalName?: string;
  _originalPrompt?: string;
  _translatedTo?: string;
}

/** Any kind of mode entry (single or group). */
export type AnyMode = Mode | ModeGroup;

/** User-configured API + global settings. */
export interface Settings {
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  /** Main language code (used for auto-detection + mode translation). */
  language: string;
  /** Show result/loading/error as a transient popup near the selection instead of a persistent panel. */
  resultPopup: boolean;
  /** ISO 639-1 code of the language the toolbar's "Translate to" button targets. */
  favoriteTargetLang: string;
  /** When the user picks a different language from the toolbar submenu, persist it as the new favorite. */
  autoSetFavorite: boolean;
}

/** Settings for the "Translate / Write" mode (live translation while typing). */
export interface TranslateWriteSettings {
  targetLang: string;
  debounceMs: number;
}

/** Result returned by most background handlers. */
export interface ResultOk<T = unknown> {
  ok: true;
  modes?: AnyMode[];
  settings?: Settings;
  content?: string;
  data?: T;
}

export interface ResultErr {
  ok: false;
  error: string;
}

export type Result<T = unknown> = ResultOk<T> | ResultErr;

/** Chat message used in chatbot multi-turn conversations. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** OpenAI-compatible chat completion response shape (subset). */
export interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
  error?: { message?: string; msg?: string } | string;
}

// ============================================
//  THEMES
// ============================================

export type ThemeId = "midnight" | "light" | "ocean" | "solarized" | "rose" | "custom";

/** A custom theme defined by the user. */
export interface CustomTheme {
  bg: string;
  bgPanel: string;
  bgInput: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textOnAccent: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  danger: string;
  favorite: string;
}

/** All theme-related data stored in storage. */
export interface ThemeSettings {
  /** How the active theme is chosen.
   *  - "auto":   follow the browser/OS color scheme. Light/dark is picked
   *              at runtime via `prefers-color-scheme`. On Firefox, the
   *              active browser theme's accent color is also applied to
   *              --lu-accent dynamically (see src/lib/browser-theme.ts).
   *  - "manual": user has picked a specific preset/custom theme; browser
   *              color scheme is ignored.
   */
  mode: "auto" | "manual";
  /** Currently selected theme id (only used when mode === "manual"). */
  current: ThemeId;
  /** User-defined custom theme (used when current === "custom"). */
  custom: CustomTheme;
}

// ============================================
//  MESSAGING
// ============================================

/** Tagged union of all messages sent to the background script. */
export type BackgroundMessage =
  | { type: "ping" }
  | { type: "test-api" }
  | { type: "get-modes" }
  | { type: "get-settings" }
  | { type: "save-settings"; settings: Settings }
  | { type: "save-modes"; modes: AnyMode[] }
  | { type: "add-mode"; mode: AnyMode }
  | { type: "update-mode"; mode: AnyMode }
  | { type: "delete-mode"; id: string }
  | { type: "toggle-favorite"; id: string }
  | { type: "add-sub-mode"; groupId: string; subMode: SubMode }
  | { type: "update-sub-mode"; groupId: string; subMode: SubMode }
  | { type: "delete-sub-mode"; groupId: string; subId: string }
  | { type: "chat-message"; messages: ChatMessage[] }
  | { type: "process-mode-from-tab"; modeId: string; subModeId: string; text: string; targetLang?: string }
  | {
      type: "confirm-proceed";
      proceed: boolean;
      originalPrompt: string;
      modeName: string;
      model: string;
      tabId?: number;
    }
  | { type: "reset-modes" }
  | { type: "close-popup" }
  | { type: "translate-mode"; modeId: string; targetLang: string }
  | { type: "undo-translate-mode"; modeId: string }
  | { type: "get-favorites" }
  | { type: "get-translate-write-settings" }
  | { type: "save-translate-write-settings"; settings: TranslateWriteSettings }
  | { type: "translate-write"; text: string; targetLang: string; sourceLang: string }
  | { type: "cleanup-ui" };

/** Messages sent from background → content script. */
export type ContentMessage =
  | { type: "ping" }
  | { type: "show-loading"; title: string }
  | { type: "show-result"; title: string; content: string }
  | { type: "show-error"; title: string; content: string }
  | {
      type: "show-confirm";
      title: string;
      content: string;
      originalPrompt: string;
      modeName: string;
      model: string;
    }
  | { type: "chat-response"; content: string }
  | { type: "chat-error"; content: string }
  | { type: "toggle-translate-write" }
  | { type: "cleanup-ui" };

/** Default settings used on first install. */
export const DEFAULT_SETTINGS: Settings = {
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.7,
  language: "es",
  resultPopup: true,
  favoriteTargetLang: "es",
  autoSetFavorite: false,
};

/** Default Translate/Write settings. */
export const DEFAULT_TW_SETTINGS: TranslateWriteSettings = {
  targetLang: "en",
  debounceMs: 1500,
};

/** Default theme settings. */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: "auto",
  current: "midnight",
  custom: {
    bg: "#0f0f23",
    bgPanel: "#1a1a2e",
    bgInput: "#0f0f23",
    border: "#16213e",
    borderStrong: "#0f3460",
    text: "#e0e0e0",
    textMuted: "#888888",
    textOnAccent: "#ffffff",
    accent: "#e94560",
    accentHover: "#c73650",
    success: "#4ade80",
    warning: "#facc15",
    danger: "#f87171",
    favorite: "#facc15",
  },
};
