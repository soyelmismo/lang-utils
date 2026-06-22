// ============================================
// Lang Utils - Browser API compatibility layer
// Re-exports webextension-polyfill as the default `browser` object.
// Works in Firefox (native Promise APIs) and Chrome (polyfilled).
// ============================================

import browser from "webextension-polyfill";

export default browser;
export { browser };
