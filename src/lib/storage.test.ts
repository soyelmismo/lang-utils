import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from './storage';
import { DEFAULT_SETTINGS, DEFAULT_TW_SETTINGS, DEFAULT_THEME_SETTINGS, Settings, ThemeSettings, TranslateWriteSettings, AnyMode } from '../types';

vi.mock('./browser-compat', () => {
  const store: Record<string, unknown> = {};
  return {
    default: {
      storage: {
        local: {
          get: vi.fn(async (keys: string[]) => {
            const res: Record<string, unknown> = {};
            for (const key of keys) {
              if (key in store) {
                res[key] = store[key];
              }
            }
            return res;
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(store, items);
          }),
          remove: vi.fn(async (key: string) => {
            delete store[key];
          }),
        },
      },
    },
  };
});

describe('storage module', () => {
  beforeEach(async () => {
    // Clear the store mock before each test
    await storage.remove('settings');
    await storage.remove('modes');
    await storage.remove('translateWriteSettings');
    await storage.remove('themeSettings');
    await storage.remove('uiLocale');
    await storage.remove('enc_key_v1');
  });

  it('should return default settings when no settings are stored', async () => {
    const settings = await storage.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('should set and get custom settings properly with encrypted API key', async () => {
    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'test-api-key-12345',
      apiUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.5,
      language: 'en',
    };

    await storage.setSettings(customSettings);

    // Verify stored raw value is encrypted
    const rawStored = await storage.get<{ apiKey: string }>('settings');
    expect(rawStored?.apiKey).not.toBe('test-api-key-12345');
    expect(rawStored?.apiKey.startsWith('enc:')).toBe(true);

    // Verify getSettings decrypts it
    const retrievedSettings = await storage.getSettings();
    expect(retrievedSettings).toEqual(customSettings);
  });

  it('should support unencrypted plaintext legacy API keys gracefully', async () => {
    await storage.set('settings', { apiKey: 'legacy-plaintext-key' });
    const settings = await storage.getSettings();
    expect(settings.apiKey).toBe('legacy-plaintext-key');
  });

  it('should merge partial stored settings with DEFAULT_SETTINGS', async () => {
    await storage.set('settings', { apiKey: 'partial-key' });
    const settings = await storage.getSettings();
    expect(settings.apiKey).toBe('partial-key');
    expect(settings.apiUrl).toBe(DEFAULT_SETTINGS.apiUrl);
    expect(settings.model).toBe(DEFAULT_SETTINGS.model);
  });

  it('should handle modes getter and setter', async () => {
    expect(await storage.getModes()).toBeUndefined();

    const mockModes: AnyMode[] = [
      {
        id: 'mode-1',
        name: 'Test Mode',
        prompt: 'Test Prompt',
        model: 'gpt-4o-mini',
        type: 'single',
        favorite: false,
      },
    ];

    await storage.setModes(mockModes);
    const retrievedModes = await storage.getModes();
    expect(retrievedModes).toEqual(mockModes);
  });

  it('should handle translate write settings', async () => {
    const defaultTw = await storage.getTranslateWriteSettings();
    expect(defaultTw).toEqual(DEFAULT_TW_SETTINGS);

    const customTw: TranslateWriteSettings = {
      targetLang: 'fr',
      debounceMs: 2000,
    };

    await storage.setTranslateWriteSettings(customTw);
    const retrievedTw = await storage.getTranslateWriteSettings();
    expect(retrievedTw).toEqual(customTw);
  });

  it('should handle theme settings', async () => {
    const defaultTheme = await storage.getThemeSettings();
    expect(defaultTheme).toEqual(DEFAULT_THEME_SETTINGS);

    const customTheme: ThemeSettings = {
      mode: 'manual',
      current: 'solarized',
      custom: DEFAULT_THEME_SETTINGS.custom,
    };

    await storage.setThemeSettings(customTheme);
    const retrievedTheme = await storage.getThemeSettings();
    expect(retrievedTheme).toEqual(customTheme);
  });

  it('should handle UI locale', async () => {
    expect(await storage.getUiLocale()).toBeUndefined();

    await storage.setUiLocale('es');
    expect(await storage.getUiLocale()).toBe('es');
  });
});
