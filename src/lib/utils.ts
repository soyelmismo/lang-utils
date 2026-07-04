// ============================================
// Lang Utils - Shared utilities
// Lazy-loaded markdown rendering + clipboard copy.
// ============================================
//
// `marked` and `dompurify` together weigh ~70 KB minified. They used to be
// statically imported here, which meant every page where the content script
// is injected (i.e. every page the user visits) shipped them in
// `dist/content.js`. Now they live in a separate bundle, `dist/markdown.js`,
// built from `src/lib/markdown.ts`. This module loads it on demand the first
// time `markdownToFragment()` is called, caches the load promise, and
// resolves to the exposed API.
//
// Until the bundle finishes loading, callers receive a fragment containing
// the raw markdown as plain text — safe via `textContent`, no sanitization
// needed. This avoids any layout shift: the popup/panel/message appears
// immediately with the raw text and gets upgraded to rendered HTML once the
// script finishes. Callers can then replace the placeholder node if they
// want to upgrade after the fact (see `markdownToFragmentWithUpgrade`).

/** How long (ms) the "Copied!" feedback is shown before the button restores its original label. */
const COPY_FEEDBACK_MS = 1500;

import { msg } from "./i18n";
import browser from "./browser-compat";

/** Symbol used by the lazy bundle to register its API on globalThis. Must stay in sync with `src/lib/markdown.ts`. */
const MARKDOWN_API_SYMBOL = Symbol.for("lang-utils.markdown");

interface MarkdownApi {
  markdownToFragment: (md: string | null | undefined) => DocumentFragment;
}

/** Minimal shape of the Chrome extension runtime we use. */
interface ChromeRuntimeShape {
  getURL: (path: string) => string;
}

interface ChromeShape {
  runtime?: ChromeRuntimeShape;
}

declare const chrome: ChromeShape | undefined;

/** Cached in-flight (or resolved) load promise. Module-level — one fetch per page. */
let loaderPromise: Promise<MarkdownApi | null> | null = null;

/**
 * Returns a fragment containing the markdown source as plain text.
 * Used as a placeholder while the lazy bundle loads.
 */
function plainTextFragment(md: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const div = document.createElement("div");
  div.className = "lu-markdown-loading";
  div.style.whiteSpace = "pre-wrap";
  div.textContent = md.replace(/\\n/g, "\n");
  frag.appendChild(div);
  return frag;
}

/**
 * Inject `dist/markdown.js` and resolve when it has
 * registered the markdown API on `globalThis[MARKDOWN_API_SYMBOL]`.
 *
 * If we are running in an extension page (e.g. chatbot, popup), we inject it as a <script> tag.
 * If we are running as a content script (isolated world), we ask the background script
 * to execute it in our isolated world via `browser.scripting.executeScript`.
 */
function loadMarkdownBundle(): Promise<MarkdownApi | null> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<MarkdownApi | null>((resolve) => {
    // Resolve a getter for the extension URL, or null if we're outside an
    // extension context (e.g. unit tests, plain page load).
    const getUrl: ((path: string) => string) | null =
      typeof chrome !== "undefined" &&
      chrome !== null &&
      chrome.runtime &&
      typeof chrome.runtime.getURL === "function"
        ? chrome.runtime.getURL.bind(chrome.runtime)
        : null;

    if (!getUrl) {
      resolve(null);
      return;
    }

    let resolved = false;
    const finish = (api: MarkdownApi | null) => {
      if (resolved) return;
      resolved = true;
      resolve(api);
    };

    // Timeout fallback: if the script doesn't register within 5s, treat
    // it as a failure and fall back to plain text.
    const POLL_TIMEOUT_MS = 5000;
    const start = Date.now();
    const poll = () => {
      const g = globalThis as unknown as Record<symbol, unknown>;
      const api = g[MARKDOWN_API_SYMBOL] as MarkdownApi | undefined;
      if (api) {
        finish(api);
        return;
      }
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        console.warn("[Lang Utils] markdown.js did not register in time");
        finish(null);
        return;
      }
      requestAnimationFrame(poll);
    };

    const isExtensionPage =
      typeof window !== "undefined" &&
      window.location &&
      window.location.protocol === "chrome-extension:";

    if (isExtensionPage) {
      const url = getUrl("markdown.js");
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset["langUtils"] = "markdown";

      script.onerror = () => {
        console.warn("[Lang Utils] failed to load markdown.js");
        finish(null);
      };

      (document.head || document.documentElement).appendChild(script);
      requestAnimationFrame(poll);
    } else {
      // Content script (isolated world): request background script to run markdown.js
      browser.runtime
        .sendMessage({ type: "inject-markdown" })
        .then((resp: unknown) => {
          const r = resp as { ok?: boolean; error?: string } | undefined;
          if (r && r.ok) {
            requestAnimationFrame(poll);
          } else {
            console.warn("[Lang Utils] failed to request markdown.js injection:", r?.error);
            finish(null);
          }
        })
        .catch((err: Error) => {
          console.warn("[Lang Utils] message error requesting markdown.js:", err.message);
          finish(null);
        });
    }
  });

  return loaderPromise;
}

/**
 * Convert markdown to a sanitized HTML DocumentFragment.
 *
 * Async because the markdown bundle is loaded on demand the first time
 * this is called. Until the bundle is ready, returns a placeholder
 * fragment containing the raw markdown as plain text. Callers that want
 * to upgrade the placeholder once rendering is ready can pass the
 * placeholder node to `markdownToFragmentWithUpgrade`.
 */
export async function markdownToFragment(
  md: string | null | undefined,
): Promise<DocumentFragment> {
  if (!md) return document.createDocumentFragment();

  const api = await loadMarkdownBundle();
  if (!api) return plainTextFragment(md);

  return api.markdownToFragment(md);
}

/**
 * Like `markdownToFragment`, but replaces `placeholder` in the DOM with the
 * rendered fragment once the lazy bundle finishes loading. If the bundle is
 * already loaded, replaces synchronously after the next microtask.
 *
 * If `placeholder` is not attached when the upgrade happens, no DOM
 * mutation occurs — the returned fragment is still returned so the caller
 * can use it.
 */
export async function markdownToFragmentWithUpgrade(
  md: string | null | undefined,
  placeholder: HTMLElement | null,
): Promise<DocumentFragment> {
  const fragment = await markdownToFragment(md);
  if (placeholder && placeholder.isConnected && fragment.firstChild) {
    placeholder.replaceWith(...Array.from(fragment.childNodes));
  }
  return fragment;
}

/**
 * Copy text to the clipboard with a temporary "Copied!" label on the button.
 */
export function copyWithFeedback(
  text: string,
  btnEl: HTMLElement | null,
  label?: string,
): void {
  const handleSuccess = (): void => {
    if (!btnEl) return;
    const original = btnEl.textContent || "";
    const copiedMsg = label || msg("content_copied");
    btnEl.textContent = copiedMsg;
    btnEl.classList.add("lu-copied");
    setTimeout(() => {
      btnEl.textContent = original;
      btnEl.classList.remove("lu-copied");
    }, COPY_FEEDBACK_MS);
  };

  const handleFailure = (err: unknown): void => {
    console.error("[Lang Utils] clipboard write failed", err);
  };

  // navigator.clipboard requires a secure context (https or extension).
  // Fall back to the legacy execCommand path otherwise.
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function" &&
    (typeof window !== "undefined" ? window.isSecureContext : true)
  ) {
    navigator.clipboard.writeText(text).then(handleSuccess).catch(handleFailure);
  } else {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) handleSuccess();
      else handleFailure(new Error("execCommand copy returned false"));
    } catch (err) {
      handleFailure(err);
    }
  }
}
