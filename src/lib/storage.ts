// ============================================
// Lang Utils - Typed storage helpers
// Wraps browser.storage.local with typed getters/setters.
// Encrypts sensitive fields (apiKey) using Web Crypto API (AES-GCM).
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

const KEY_ALIAS = "enc_key_v1";
const AES_KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12;
const HEX_PAD = 2;
const RADIX_HEX = 16;
const SPLIT_PARTS_COUNT = 3;

/** Get or create a persistent AES-GCM CryptoKey stored in local storage. */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const stored = await browser.storage.local.get([KEY_ALIAS]);
  if (stored[KEY_ALIAS]) {
    const rawKey = new Uint8Array(stored[KEY_ALIAS] as number[]);
    return await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: AES_KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );

  const exported = await crypto.subtle.exportKey("raw", key);
  await browser.storage.local.set({
    [KEY_ALIAS]: Array.from(new Uint8Array(exported)),
  });

  return key;
}

/** Encrypt text value using AES-GCM. Returns format "enc:iv_hex:ciphertext_hex" */
async function encryptValue(plainText: string): Promise<string> {
  if (!plainText) return "";
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoded = new TextEncoder().encode(plainText);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const ivHex = Array.from(iv)
    .map((b) => b.toString(RADIX_HEX).padStart(HEX_PAD, "0"))
    .join("");
  const cipherHex = Array.from(new Uint8Array(ciphertextBuffer))
    .map((b) => b.toString(RADIX_HEX).padStart(HEX_PAD, "0"))
    .join("");

  return `enc:${ivHex}:${cipherHex}`;
}

/** Decrypt "enc:iv_hex:ciphertext_hex" formatted string. */
async function decryptValue(encryptedText: string): Promise<string> {
  if (!encryptedText) return "";
  if (!encryptedText.startsWith("enc:")) {
    // Return raw text if not encrypted (backwards compatibility / unencrypted legacy)
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(":");
    if (parts.length !== SPLIT_PARTS_COUNT) return encryptedText;

    const ivHex = parts[1] ?? "";
    const cipherHex = parts[2] ?? "";

    if (!ivHex || !cipherHex) return encryptedText;

    const ivMatches = ivHex.match(/.{1,2}/g) || [];
    const cipherMatches = cipherHex.match(/.{1,2}/g) || [];

    const iv = new Uint8Array(ivMatches.map((byte) => parseInt(byte, RADIX_HEX)));
    const ciphertext = new Uint8Array(cipherMatches.map((byte) => parseInt(byte, RADIX_HEX)));

    const key = await getOrCreateEncryptionKey();
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    return encryptedText;
  }
}

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
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    if (settings.apiKey) {
      settings.apiKey = await decryptValue(settings.apiKey);
    }
    return settings;
  },

  async setSettings(settings: Settings): Promise<void> {
    const settingsToStore = { ...settings };
    if (settingsToStore.apiKey) {
      settingsToStore.apiKey = await encryptValue(settingsToStore.apiKey);
    }
    await this.set("settings", settingsToStore);
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
      mode: stored.mode ?? DEFAULT_THEME_SETTINGS.mode,
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
