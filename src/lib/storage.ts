// ============================================
// Lang Utils - Typed storage helpers
// Wraps browser.storage.local with typed getters/setters.
// ============================================

import browser from "./browser-compat";
import {
  AnyMode,
  DEFAULT_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_TW_SETTINGS,
  Settings,
  ThemeSettings,
  TranslateWriteSettings,
} from "../types";

/** Type-safe wrapper around browser.storage.local. */
export const storage = {
  /** Get a single typed value from local storage. */
  async get<T>(key: string): Promise<T | undefined> {
    const result = await browser.storage.local.get([key]);
    return result[key] as T | undefined;
  },

  /** Set a single typed value in local storage. */
  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },

  /** Remove a single key from local storage. */
  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },

  // ---- Convenience helpers for known keys ----

  async getModes(): Promise<AnyMode[] | undefined> {
    return this.get<AnyMode[]>("modes");
  },
  async setModes(modes: AnyMode[]): Promise<void> {
    await this.set("modes", modes);
  },

  async getSettings(): Promise<Settings> {
    const stored = (await this.get<Partial<Settings>>("settings")) || {};
    return { ...DEFAULT_SETTINGS, ...stored };
  },
  async setSettings(settings: Settings): Promise<void> {
    await this.set("settings", settings);
  },

  async getTranslateWriteSettings(): Promise<TranslateWriteSettings> {
    const stored = (await this.get<Partial<TranslateWriteSettings>>(
      "translateWriteSettings"
    )) || {};
    return { ...DEFAULT_TW_SETTINGS, ...stored };
  },
  async setTranslateWriteSettings(s: TranslateWriteSettings): Promise<void> {
    await this.set("translateWriteSettings", s);
  },

  async getThemeSettings(): Promise<ThemeSettings> {
    const stored = (await this.get<Partial<ThemeSettings>>("themeSettings")) || {};
    return {
      current: stored.current ?? DEFAULT_THEME_SETTINGS.current,
      custom: { ...DEFAULT_THEME_SETTINGS.custom, ...(stored.custom ?? {}) },
    };
  },
  async setThemeSettings(s: ThemeSettings): Promise<void> {
    await this.set("themeSettings", s);
  },

  async getUiLocale(): Promise<string | undefined> {
    return this.get<string>("uiLocale");
  },
  async setUiLocale(locale: string): Promise<void> {
    await this.set("uiLocale", locale);
  },
} as const;
