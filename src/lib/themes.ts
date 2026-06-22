// ============================================
// Lang Utils - Theme manager
// Provides preset themes + a customizable theme
// (user picks individual colors). All themes are
// applied via CSS custom properties on :root.
// ============================================

import browser from "./browser-compat";
import { CustomTheme, DEFAULT_THEME_SETTINGS, ThemeId, ThemeSettings } from "../types";
import { storage } from "./storage";

/** Preset themes shipped with the extension. */
export const PRESET_THEMES: Record<Exclude<ThemeId, "custom">, CustomTheme> = {
  midnight: {
    bg: "#0f0f23",
    bgPanel: "#1a1a2e",
    bgInput: "#0f0f23",
    border: "#16213e",
    borderStrong: "#0f3460",
    text: "#e0e0e0",
    textMuted: "#888888",
    accent: "#e94560",
    accentHover: "#c73650",
    success: "#4ade80",
    warning: "#facc15",
    danger: "#f87171",
    favorite: "#facc15",
  },
  light: {
    bg: "#f5f5f7",
    bgPanel: "#ffffff",
    bgInput: "#f9f9fb",
    border: "#e2e2e8",
    borderStrong: "#c7c7d0",
    text: "#1a1a2e",
    textMuted: "#666678",
    accent: "#e94560",
    accentHover: "#c73650",
    success: "#16a34a",
    warning: "#ca8a04",
    danger: "#dc2626",
    favorite: "#ca8a04",
  },
  ocean: {
    bg: "#0a1929",
    bgPanel: "#102a43",
    bgInput: "#0a1929",
    border: "#1e3a5f",
    borderStrong: "#2c5282",
    text: "#e6f1ff",
    textMuted: "#8baec5",
    accent: "#64ffda",
    accentHover: "#4fd1c5",
    success: "#68d391",
    warning: "#f6e05e",
    danger: "#fc8181",
    favorite: "#f6e05e",
  },
  solarized: {
    bg: "#002b36",
    bgPanel: "#073642",
    bgInput: "#002b36",
    border: "#073642",
    borderStrong: "#586e75",
    text: "#93a1a1",
    textMuted: "#657b83",
    accent: "#cb4b16",
    accentHover: "#dc5517",
    success: "#859900",
    warning: "#b58900",
    danger: "#dc322f",
    favorite: "#b58900",
  },
  rose: {
    bg: "#1a0a14",
    bgPanel: "#2a1020",
    bgInput: "#1a0a14",
    border: "#3a1530",
    borderStrong: "#5a2050",
    text: "#f0d0e0",
    textMuted: "#a08090",
    accent: "#ff4080",
    accentHover: "#e03070",
    success: "#80ff80",
    warning: "#ffd040",
    danger: "#ff6080",
    favorite: "#ffd040",
  },
};

/** All keys of CustomTheme — used for iteration. */
export const THEME_COLOR_KEYS: Array<keyof CustomTheme> = [
  "bg",
  "bgPanel",
  "bgInput",
  "border",
  "borderStrong",
  "text",
  "textMuted",
  "accent",
  "accentHover",
  "success",
  "warning",
  "danger",
  "favorite",
];

/** Map CustomTheme keys → CSS variable names on :root. */
const CSS_VAR_MAP: Record<keyof CustomTheme, string> = {
  bg: "--lu-bg",
  bgPanel: "--lu-bg-panel",
  bgInput: "--lu-bg-input",
  border: "--lu-border",
  borderStrong: "--lu-border-strong",
  text: "--lu-text",
  textMuted: "--lu-text-muted",
  accent: "--lu-accent",
  accentHover: "--lu-accent-hover",
  success: "--lu-success",
  warning: "--lu-warning",
  danger: "--lu-danger",
  favorite: "--lu-favorite",
};

/** Resolve a ThemeId to its actual CustomTheme colors. */
export function resolveTheme(themeSettings: ThemeSettings): CustomTheme {
  if (themeSettings.current === "custom") {
    return { ...DEFAULT_THEME_SETTINGS.custom, ...themeSettings.custom };
  }
  return PRESET_THEMES[themeSettings.current] ?? PRESET_THEMES.midnight;
}

/** Apply a CustomTheme to the document by setting CSS variables on :root. */
export function applyThemeToDocument(theme: CustomTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of THEME_COLOR_KEYS) {
    root.style.setProperty(CSS_VAR_MAP[key], theme[key]);
  }
}

/** Load theme settings from storage and apply them. */
export async function loadAndApplyTheme(): Promise<ThemeSettings> {
  const themeSettings = await storage.getThemeSettings();
  applyThemeToDocument(resolveTheme(themeSettings));
  return themeSettings;
}

/** Save theme settings to storage and apply them. */
export async function saveAndApplyTheme(themeSettings: ThemeSettings): Promise<void> {
  await storage.setThemeSettings(themeSettings);
  applyThemeToDocument(resolveTheme(themeSettings));
  // Notify other extension pages to refresh theme
  try {
    await browser.runtime.sendMessage({ type: "theme-changed" } as never).catch(() => {
      // Background may not handle this; that's fine.
    });
  } catch {
    // ignore
  }
}

/** Convert a theme to a JSON string for export. */
export function exportTheme(theme: CustomTheme): string {
  return JSON.stringify(theme, null, 2);
}

/** Parse an exported theme JSON. Returns null if invalid. */
export function importTheme(json: string): CustomTheme | null {
  try {
    const parsed = JSON.parse(json) as Partial<CustomTheme>;
    // Validate: must have at least all required keys
    const result: CustomTheme = { ...DEFAULT_THEME_SETTINGS.custom };
    for (const key of THEME_COLOR_KEYS) {
      if (typeof parsed[key] === "string") {
        result[key] = parsed[key] as string;
      }
    }
    return result;
  } catch {
    return null;
  }
}
