// ============================================
// Lang Utils - Theme manager
// Provides preset themes + a customizable theme
// (user picks individual colors). All themes are
// applied via CSS custom properties on :root.
//
// In `auto` mode the active preset is chosen from
// the OS/browser color scheme via `prefers-color-scheme`,
// and on Firefox the browser theme's accent color
// is overlaid on top of --lu-accent / --lu-accent-hover.
// In `manual` mode the user's pick is used verbatim.
// ============================================

import browser from "./browser-compat";
import { CustomTheme, DEFAULT_THEME_SETTINGS, ThemeId, ThemeSettings } from "../types";
import { storage } from "./storage";
import {
  BrowserThemeInfo,
  getCurrentBrowserTheme,
  subscribeToBrowserTheme,
} from "./browser-theme";

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
    textOnAccent: "#ffffff",
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
    textOnAccent: "#ffffff",
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
    textOnAccent: "#0a1929",
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
    textOnAccent: "#002b36",
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
    textOnAccent: "#ffffff",
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
  "textOnAccent",
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
  textOnAccent: "--lu-text-on-accent",
  accent: "--lu-accent",
  accentHover: "--lu-accent-hover",
  success: "--lu-success",
  warning: "--lu-warning",
  danger: "--lu-danger",
  favorite: "--lu-favorite",
};

/**
 * Pick the dark-mode and light-mode preset ids used when
 * `themeSettings.mode === "auto"`. Users who want a specific
 * dark/light preset can still set mode to "manual".
 */
const AUTO_DARK_PRESET: Exclude<ThemeId, "custom"> = "midnight";
const AUTO_LIGHT_PRESET: Exclude<ThemeId, "custom"> = "light";

/** Detects the user's OS/browser color scheme. Defaults to dark. */
export function detectSystemColorScheme(): "dark" | "light" {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Module-level cache for the most recent browser accent (Firefox only). */
let browserAccent: string | null = null;

/**
 * Resolve a ThemeSettings to its actual CustomTheme colors.
 *
 * - `mode === "manual"`: returns the user's chosen preset/custom theme.
 * - `mode === "auto"`:   picks the dark or light preset based on
 *                        `prefers-color-scheme`.
 *
 * The browser accent overlay is NOT applied here — it's added on top
 * by `applyThemeToDocument`.
 */
export function resolveTheme(themeSettings: ThemeSettings): CustomTheme {
  if (themeSettings.mode === "manual") {
    if (themeSettings.current === "custom") {
      return { ...DEFAULT_THEME_SETTINGS.custom, ...themeSettings.custom };
    }
    return PRESET_THEMES[themeSettings.current] ?? PRESET_THEMES.midnight;
  }
  // auto mode
  const presetId = detectSystemColorScheme() === "light"
    ? AUTO_LIGHT_PRESET
    : AUTO_DARK_PRESET;
  return PRESET_THEMES[presetId];
}

/**
 * Apply a CustomTheme to the document by setting CSS variables on :root.
 * If a browser accent is known (Firefox only), it overrides --lu-accent
 * and --lu-accent-hover so the extension inherits the toolbar color.
 */
export function applyThemeToDocument(theme: CustomTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of THEME_COLOR_KEYS) {
    // Skip accent keys when a browser accent is active — we override below.
    if ((key === "accent" || key === "accentHover") && browserAccent) continue;
    root.style.setProperty(CSS_VAR_MAP[key], theme[key]);
  }
  // Overlay browser accent (Firefox). We set both --lu-accent and
  // --lu-accent-hover to the same color since we can't derive a darker
  // hover tint generically. Consumers that want a richer hover can
  // extend this with a luminance-based adjustment.
  if (browserAccent) {
    root.style.setProperty(CSS_VAR_MAP.accent, browserAccent);
    root.style.setProperty(CSS_VAR_MAP.accentHover, browserAccent);
  }
}

/**
 * Apply an incoming browser theme update. Called from the subscription
 * registered via `initBrowserThemeSync`. No-op on browsers without
 * `browser.theme` (Chrome) or when no accent is provided.
 */
function applyBrowserTheme(info: BrowserThemeInfo): void {
  const next = info.accent ? info.accent : null;
  if (next === browserAccent) return;
  browserAccent = next;
  // Re-apply the currently-resolved theme so the new accent (or its
  // removal) takes effect on :root. We don't await storage here —
  // the current theme settings are already in memory.
  void storage.getThemeSettings().then((s) => {
    applyThemeToDocument(resolveTheme(s));
  });
}

/**
 * Subscribe to browser theme changes (Firefox only) and overlay the
 * accent color onto --lu-accent. Returns an unsubscribe fn; on Chrome
 * (no browser.theme) returns a no-op unsubscribe.
 *
 * Intended to be called once per page from each entry point that
 * needs the overlay (background, popup, options, chatbot, content).
 * Idempotent: safe to call multiple times — but typically you only
 * need one place per page.
 */
export function initBrowserThemeSync(): () => void {
  return subscribeToBrowserTheme(applyBrowserTheme);
}

/**
 * Read the current browser theme (Firefox only). Returns null on Chrome.
 * Used at startup so the first paint already has the browser accent.
 */
export async function primeBrowserAccent(): Promise<void> {
  const info = await getCurrentBrowserTheme();
  if (info?.accent) browserAccent = info.accent;
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

/**
 * Subscribe to changes in `prefers-color-scheme` (when the user toggles
 * dark mode in the OS / browser settings) and re-apply the current
 * theme. Returns an unsubscribe fn.
 *
 * Only has a visible effect when `themeSettings.mode === "auto"` —
 * manual themes ignore the system color scheme.
 */
export function subscribeToSystemColorScheme(
  callback: () => void,
): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (): void => callback();
  // Newer browsers: addEventListener; older Safari: addListener.
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }
  mql.addListener(handler);
  return () => mql.removeListener(handler);
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
