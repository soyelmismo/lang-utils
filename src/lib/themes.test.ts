import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveTheme, PRESET_THEMES, detectSystemColorScheme } from './themes';
import { DEFAULT_THEME_SETTINGS, CustomTheme, ThemeId } from '../types';

describe('detectSystemColorScheme', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalWindow: typeof global.window;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalWindow = global.window;
  });

  afterEach(() => {
    if (global.window) {
      window.matchMedia = originalMatchMedia;
    } else {
      global.window = originalWindow;
    }
  });

  function setMatchMedia(matchesLight: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: light)' ? matchesLight : !matchesLight,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  it('should return dark when window is undefined', () => {
    const originalWindow = global.window;
    Object.defineProperty(global, 'window', { value: undefined, writable: true });

    expect(detectSystemColorScheme()).toBe('dark');

    Object.defineProperty(global, 'window', { value: originalWindow, writable: true });
  });

  it('should return dark when window.matchMedia is missing', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });

    expect(detectSystemColorScheme()).toBe('dark');
  });

  it('should return light when prefers-color-scheme: light matches', () => {
    setMatchMedia(true);
    expect(detectSystemColorScheme()).toBe('light');
  });

  it('should return dark when prefers-color-scheme: light does not match', () => {
    setMatchMedia(false);
    expect(detectSystemColorScheme()).toBe('dark');
  });
});

describe('resolveTheme', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function setMatchMedia(matchesLight: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: light)' ? matchesLight : !matchesLight,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  it('should return custom theme when mode is manual and current is custom', () => {
    const customTheme = { ...DEFAULT_THEME_SETTINGS.custom, bg: '#ffffff' };
    const result = resolveTheme({ mode: 'manual', current: 'custom', custom: customTheme });
    expect(result).toEqual(customTheme);
  });

  it('should merge with DEFAULT_THEME_SETTINGS when custom theme is missing properties', () => {
    const customThemePartial = { bg: '#123456' } as unknown as CustomTheme;
    const result = resolveTheme({ mode: 'manual', current: 'custom', custom: customThemePartial });
    expect(result.bg).toBe('#123456');
    expect(result.text).toBe(DEFAULT_THEME_SETTINGS.custom.text);
  });

  it('should return preset theme when mode is manual and current is a preset', () => {
    const result = resolveTheme({ mode: 'manual', current: 'ocean', custom: DEFAULT_THEME_SETTINGS.custom });
    expect(result).toEqual(PRESET_THEMES.ocean);
  });

  it('should fallback to midnight if preset theme does not exist', () => {
    const current = 'non-existent' as unknown as ThemeId;
    const result = resolveTheme({ mode: 'manual', current, custom: DEFAULT_THEME_SETTINGS.custom });
    expect(result).toEqual(PRESET_THEMES.midnight);
  });

  it('should return light preset in auto mode when prefers-color-scheme is light', () => {
    setMatchMedia(true);
    const result = resolveTheme({ mode: 'auto', current: 'midnight', custom: DEFAULT_THEME_SETTINGS.custom });
    expect(result).toEqual(PRESET_THEMES.light);
  });

  it('should return midnight preset in auto mode when prefers-color-scheme is dark', () => {
    setMatchMedia(false);
    const result = resolveTheme({ mode: 'auto', current: 'light', custom: DEFAULT_THEME_SETTINGS.custom });
    expect(result).toEqual(PRESET_THEMES.midnight);
  });

  it('should return midnight preset in auto mode if window.matchMedia is missing', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });
    const result = resolveTheme({ mode: 'auto', current: 'light', custom: DEFAULT_THEME_SETTINGS.custom });
    expect(result).toEqual(PRESET_THEMES.midnight);
  });
});
