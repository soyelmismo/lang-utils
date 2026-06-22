// ============================================
// Lang Utils - Shared utilities
// HTML escaping, lightweight markdown → HTML,
// and clipboard copy with button feedback.
// ============================================

import { msg } from "./i18n";

/** Escape a string for safe insertion as HTML text. */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Convert a (very small subset of) markdown to HTML.
 * Supports: headings, bold, italic, inline code, code blocks,
 * unordered lists, ordered lists, paragraphs, and line breaks.
 * NOT a full markdown parser — kept tiny on purpose.
 */
export function markdownToHtml(md: string | null | undefined): string {
  if (!md) return "";

  let html = escapeHtml(md);
  // Code blocks (must come before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold + italic, bold, italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Lists
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  // Numbered lists (best-effort)
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Paragraphs and line breaks
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = "<p>" + html + "</p>";
  return html;
}

/**
 * Copy text to the clipboard and give the user visual feedback
 * by temporarily replacing the button's text. Falls back silently
 * if no button is provided.
 */
export function copyWithFeedback(
  text: string,
  btnEl: HTMLElement | null,
  label?: string
): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      if (!btnEl) return;
      const original = btnEl.textContent || "";
      const copiedMsg = msg("content_copied");
      btnEl.textContent = (label || "\u2713") + copiedMsg;
      setTimeout(() => {
        btnEl.textContent = original;
      }, 1500);
    })
    .catch(() => {
      // ignore clipboard errors
    });
}

/** LangUtils namespace for backwards compatibility with HTML files that expect `window.LangUtils`. */
export const LangUtils = {
  escapeHtml,
  markdownToHtml,
  copyWithFeedback,
};

// Expose on window for HTML pages that use `window.LangUtils` directly.
declare global {
  interface Window {
    LangUtils?: typeof LangUtils;
  }
}
if (typeof window !== "undefined") {
  window.LangUtils = LangUtils;
}

export default LangUtils;
