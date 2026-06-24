// ============================================
// Lang Utils - Browser theme sync (Firefox only)
// ============================================
//
// Firefox lets extensions react when the user changes the browser theme
// (the colored themes distributed by Mozilla or third parties). Chrome
// has no equivalent — it only exposes `prefers-color-scheme` for light/
// dark. We feature-detect and no-op on Chrome.
//
// This module is meant to run from the background script (which is the
// only context where `browser.theme` is reliably available in Firefox).
// It broadcasts theme updates to all extension pages via runtime
// messages, so popup / options / chatbot / content-script can each
// react.
//
// We only sync the *accent* color: changing the browser's toolbar
// background would be jarring if applied to chat bubbles and panels.
// The accent (used for buttons, links, focus rings) is the most
// visually consistent property to inherit.

import browser from "./browser-compat";

/** Minimal shape of the subset of a browser theme we care about. */
export interface BrowserThemeInfo {
  /** Accent color used by the browser toolbar (e.g. Firefox's blue theme). */
  accent?: string;
  /** Background color of toolbar / UI chrome. Informational; not applied. */
  background?: string;
  /** Text color on top of background. Informational; not applied. */
  text?: string;
}

const ACCENT_FALLBACK = "";

/** Read the current browser theme (Firefox only). Returns null on Chrome / unsupported. */
export async function getCurrentBrowserTheme(): Promise<BrowserThemeInfo | null> {
  // Feature detection — `browser.theme` is undefined on Chrome.
  const t = (browser as unknown as { theme?: { getCurrent?: (id?: number) => Promise<Record<string, unknown>> } })
    .theme;
  if (!t || typeof t.getCurrent !== "function") return null;
  try {
    const theme = await t.getCurrent();
    const colors = (theme?.colors ?? {}) as Record<string, unknown>;
    return {
      accent: typeof colors.accentcolor === "string" ? colors.accentcolor : undefined,
      background: typeof colors.toolbar === "string" ? colors.toolbar : undefined,
      text: typeof colors.toolbar_text === "string" ? colors.toolbar_text : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Subscribe to browser theme updates. The listener fires once immediately
 * with the current theme, then on every change. Returns an unsubscribe fn.
 *
 * Returns a no-op unsubscribe on browsers without `browser.theme`.
 */
export function subscribeToBrowserTheme(
  callback: (info: BrowserThemeInfo) => void,
): () => void {
  const t = (browser as unknown as {
    theme?: {
      onUpdated?: { addListener: (cb: (info: { theme?: { colors?: Record<string, unknown> } }) => void) => void };
    };
  }).theme;
  if (!t || !t.onUpdated) {
    // No support — call once with empty accent so the caller can clear
    // any previously-applied browser accent.
    callback({ accent: ACCENT_FALLBACK });
    return () => {
      /* no-op */
    };
  }

  let disposed = false;

  const listener = (info: { theme?: { colors?: Record<string, unknown> } }): void => {
    if (disposed) return;
    const colors = info?.theme?.colors ?? {};
    callback({
      accent: typeof colors.accentcolor === "string" ? colors.accentcolor : undefined,
      background: typeof colors.toolbar === "string" ? colors.toolbar : undefined,
      text: typeof colors.toolbar_text === "string" ? colors.toolbar_text : undefined,
    });
  };

  t.onUpdated.addListener(listener);

  // Push the current theme immediately so consumers don't have to
  // poll. `getCurrent()` is async; swallow errors.
  void getCurrentBrowserTheme().then((info) => {
    if (disposed || !info) return;
    callback(info);
  });

  return () => {
    disposed = true;
  };
}
