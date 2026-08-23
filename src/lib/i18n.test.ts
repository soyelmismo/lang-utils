import { describe, it, expect, vi, beforeEach } from 'vitest';
import { i18n, langName, langOptions, nativeLangName, langFlag, langCodes } from './i18n';
import { storage } from './storage';

vi.mock('./browser-compat', () => ({
  default: {
    runtime: {
      getURL: vi.fn((path: string) => path),
    },
    i18n: {
      getUILanguage: vi.fn(() => 'en-US'),
      getMessage: vi.fn(),
    },
  },
}));

vi.mock('./storage', () => ({
  storage: {
    getUiLocale: vi.fn(),
    setUiLocale: vi.fn(),
  },
}));

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with stored uiLocale', async () => {
    vi.mocked(storage.getUiLocale).mockResolvedValue('es');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ popup_title: { message: 'Lang Utils Spanish' } }),
    } as Response);

    await i18n.reinit();
    expect(storage.getUiLocale).toHaveBeenCalled();
    expect(i18n.getLocale()).toBe('es');
  });

  it('should update locale and persist it via setLocale', async () => {
    vi.mocked(storage.setUiLocale).mockResolvedValue(undefined);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ popup_title: { message: 'Lang Utils Spanish' } }),
    } as Response);

    await i18n.setLocale('es');
    expect(storage.setUiLocale).toHaveBeenCalledWith('es');
    expect(i18n.getLocale()).toBe('es');
  });

  it('should return correct messages from msg()', () => {
    const message = i18n.msg('popup_title');
    expect(message).toBeDefined();
  });

  it('should return native language names and options', () => {
    expect(nativeLangName('es')).toBe('Espanol');
    expect(langFlag('es')).toBe('🇪🇸');
    expect(langCodes()).toContain('es');
    expect(langOptions().length).toBeGreaterThan(0);
    expect(langName('es')).toBeDefined();
  });
});
