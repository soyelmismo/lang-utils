// ============================================
// Lang Utils - Markdown bundle (lazy-loaded)
// ============================================
//
// This module is bundled as a SEPARATE IIFE entry point
// (see scripts/build.mjs → ENTRY_POINTS) and is loaded
// on demand from the content script and the chatbot via
// `<script src="chrome.runtime.getURL("markdown.js")">`.
//
// Keeping marked + dompurify out of the main content
// script bundle saves ~100 KB on every page load where
// the extension is injected — the heavy deps only ship
// when the user actually triggers an AI response.
//
// The bundle exposes its API on a global Symbol so that
// two bundles (content + chatbot) can each load it
// independently without polluting window with named
// globals that could clash with the host page.

import { marked } from "marked";
import DOMPurify from "dompurify";

/** Symbol used to register/retrieve the markdown API on globalThis. */
export const MARKDOWN_API_SYMBOL = Symbol.for("lang-utils.markdown");

/**
 * Convert markdown to a sanitized HTML DocumentFragment.
 *
 * Uses `marked` for parsing (GFM: tables, strikethrough, task lists, fenced
 * code, autolinks) and `DOMPurify` to strip any HTML/script content that the
 * model might emit, so it's safe to insert into the DOM without `innerHTML`.
 *
 * Returns an empty fragment for null/undefined/empty input.
 */
export function markdownToFragment(md: string | null | undefined): DocumentFragment {
  if (!md) return document.createDocumentFragment();

  // Replace literal '\n' sequences with real newlines.
  const cleanMd = md.replace(/\\n/g, "\n");

  // GFM features (tables, strikethrough, task lists) + line breaks like the
  // previous custom parser did.
  const rawHtml = marked.parse(cleanMd, {
    gfm: true,
    breaks: true,
    async: false,
  }) as string;

  const safeHtml = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    // Allow a few extra tags that are safe and commonly emitted by LLMs.
    ADD_TAGS: ["del", "sub", "sup"],
  });

  const doc = new DOMParser().parseFromString(safeHtml, "text/html");
  const fragment = document.createDocumentFragment();
  while (doc.body.firstChild) {
    fragment.appendChild(doc.body.firstChild);
  }
  return fragment;
}

// Register the API on globalThis so the IIFE bundle loaded as a <script>
// exposes it to whichever caller (content script, chatbot) injected it.
// We attach to a Symbol.for() key so it doesn't collide with host page state
// and so multiple bundles can share one registration.
const g = globalThis as unknown as Record<symbol, unknown>;
g[MARKDOWN_API_SYMBOL] = { markdownToFragment };
