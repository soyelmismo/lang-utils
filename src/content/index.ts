// ============================================
// Lang Utils - Content script
// Injects UI into web pages: result panel,
// floating toolbar with groups, form-injection
// button + menu, and translate-write mode.
// ============================================

import browser from "../lib/browser-compat";
import { i18n, msg } from "../lib/i18n";
import { escapeHtml, markdownToHtml, copyWithFeedback } from "../lib/utils";
import { loadAndApplyTheme } from "../lib/themes";
import { CONTENT_STYLES } from "./styles";
import type { AnyMode, ModeGroup } from "../types";

// ---- Guard against double-injection ----
declare global {
  interface Window {
    __langUtilsLoaded?: boolean;
  }
}
if (window.__langUtilsLoaded) {
  // Already loaded; bail out.
} else {
  window.__langUtilsLoaded = true;
  void contentMain();
}

/** Main entry point for the content script. */
async function contentMain(): Promise<void> {
  // Apply the user's theme to this page's :root so injected UI matches.
  await loadAndApplyTheme();
  await i18n.init();

  // Inject styles
  const style = document.createElement("style");
  style.textContent = CONTENT_STYLES;
  document.head.appendChild(style);

  // eslint-disable-next-line no-console
  console.log("[Lang Utils Content] Loaded in", window.location.href);

  setupPanel();
  setupToolbar();
  setupFormInjection();
  setupMessageHandler();
}

// ============================================================
//  PANEL MANAGEMENT
// ============================================================

let currentPanel: HTMLDivElement | null = null;

/** Remove the current result panel if any. */
function removePanel(): void {
  if (currentPanel) {
    currentPanel.remove();
    currentPanel = null;
  }
}

/** Create the result panel with title + content. */
function createPanel(
  title: string,
  contentHTML: string,
  options: { actions?: string } = {}
): HTMLDivElement {
  removePanel();
  const panel = document.createElement("div");
  panel.id = "lang-utils-panel";
  panel.innerHTML =
    '<div class="lu-header">' +
    '<span class="lu-header-title">' +
    escapeHtml(title) +
    "</span>" +
    '<div class="lu-header-actions">' +
    '<button class="lu-btn" id="lu-copy-btn" title="' +
    msg("content_copy") +
    '">\uD83D\uDCCB</button>' +
    '<button class="lu-btn" id="lu-close-btn" title="' +
    msg("content_close") +
    '">\u2715</button>' +
    "</div>" +
    "</div>" +
    '<div class="lu-body" id="lu-body">' +
    contentHTML +
    "</div>" +
    (options.actions || "");
  document.body.appendChild(panel);
  currentPanel = panel;

  const closeBtn = panel.querySelector<HTMLButtonElement>("#lu-close-btn");
  closeBtn?.addEventListener("click", removePanel);

  const copyBtn = panel.querySelector<HTMLButtonElement>("#lu-copy-btn");
  copyBtn?.addEventListener("click", () => {
    const body = panel.querySelector<HTMLElement>("#lu-body");
    if (body) copyWithFeedback(body.textContent || "", copyBtn);
  });

  makeDraggable(panel, panel.querySelector<HTMLElement>(".lu-header"));
  return panel;
}

/** Make an element draggable by a handle. */
function makeDraggable(element: HTMLElement, handle: HTMLElement | null): void {
  if (!handle) return;
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener("mousedown", (e: MouseEvent) => {
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isDragging) return;
    element.style.left = e.clientX - offsetX + "px";
    element.style.top = e.clientY - offsetY + "px";
    element.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function setupPanel(): void {
  // Nothing to do here yet — panels are created on demand.
}

// ============================================================
//  FLOATING TOOLBAR (with group support)
// ============================================================

let toolbarEl: HTMLDivElement | null = null;
let toolbarModes: AnyMode[] = []; // single modes
let toolbarGroups: ModeGroup[] = []; // group modes

/** Remove the floating toolbar. */
function removeToolbar(): void {
  if (toolbarEl) {
    toolbarEl.remove();
    toolbarEl = null;
  }
}

/** Send a mode to the background for processing, then show result panel. */
function sendModeToAPI(
  modeId: string,
  subModeId: string,
  selectedText: string,
  btn: HTMLButtonElement | null
): void {
  if (btn) {
    btn.disabled = true;
    btn.textContent = "...";
  }
  browser.runtime
    .sendMessage({
      type: "process-mode-from-tab",
      modeId,
      subModeId: subModeId || "",
      text: selectedText,
    })
    .then((resp: unknown) => {
      const r = resp as { ok?: boolean; content?: string; error?: string };
      removeToolbar();
      if (r && r.ok && r.content) {
        createPanel(msg("content_result"), markdownToHtml(r.content));
      } else {
        createPanel(
          msg("content_error"),
          '<div class="lu-error">' +
            escapeHtml(r ? r.error || "Unknown error" : "Unknown error") +
            "</div>"
        );
      }
    })
    .catch((err: Error) => {
      removeToolbar();
      createPanel(
        msg("content_error"),
        '<div class="lu-error">' + escapeHtml(err.message) + "</div>"
      );
    });
}

/** Show the floating toolbar at coordinates. */
function showToolbar(x: number, y: number, selectedText: string): void {
  removeToolbar();
  if (toolbarModes.length === 0 && toolbarGroups.length === 0) return;

  toolbarEl = document.createElement("div");
  toolbarEl.id = "lu-toolbar";
  toolbarEl.style.left = x + "px";
  toolbarEl.style.top = y + 10 + "px";

  // Single modes
  for (const mode of toolbarModes) {
    const btn = document.createElement("button");
    btn.className = mode.favorite ? "lu-tb-fav" : "lu-tb-btn";
    btn.textContent = mode.name;
    btn.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sendModeToAPI(mode.id, "", selectedText, btn);
    });
    toolbarEl.appendChild(btn);
  }

  // Groups
  for (const group of toolbarGroups) {
    const wrapper = document.createElement("div");
    wrapper.className = "lu-tb-group";

    const btn = document.createElement("button");
    btn.className = "lu-tb-group-btn";
    btn.innerHTML = escapeHtml(group.name) + '<span class="lu-tb-arrow">\u25BC</span>';

    const menu = document.createElement("div");
    menu.className = "lu-tb-group-menu";

    for (const sub of group.subModes || []) {
      const subBtn = document.createElement("button");
      subBtn.className = "lu-tb-sub";
      subBtn.textContent = sub.name;
      subBtn.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        sendModeToAPI(group.id, sub.id, selectedText, subBtn);
      });
      menu.appendChild(subBtn);
    }

    btn.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const wasOpen = menu.classList.contains("lu-show");
      document
        .querySelectorAll<HTMLDivElement>(".lu-tb-group-menu.lu-show")
        .forEach((m) => m.classList.remove("lu-show"));
      if (!wasOpen) menu.classList.add("lu-show");
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(menu);
    toolbarEl.appendChild(wrapper);
  }

  document.body.appendChild(toolbarEl);
}

/** Set up the toolbar: load modes + listen for selection changes. */
function setupToolbar(): void {
  // Load modes
  browser.runtime
    .sendMessage({ type: "get-modes" })
    .then((resp: unknown) => {
      const r = resp as { modes?: AnyMode[] } | undefined;
      if (!r || !r.modes) return;
      const favs: AnyMode[] = [];
      const groups: ModeGroup[] = [];
      for (const m of r.modes) {
        if (m.type === "group") {
          groups.push(m);
        } else if (m.favorite && m.prompt !== "__CHATBOT__") {
          favs.push(m);
        }
      }
      toolbarGroups = groups;
      if (favs.length > 0) {
        toolbarModes = favs;
      } else {
        toolbarModes = r.modes
          .filter(
            (m) => m.type === "single" && m.prompt !== "__CHATBOT__"
          )
          .slice(0, 4);
      }
    })
    .catch(() => {
      // ignore — content script may run before background is ready
    });

  // Selection changes → show toolbar
  document.addEventListener("mouseup", (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest("#lu-toolbar") ||
      target?.closest("#lang-utils-panel") ||
      target?.closest("#lu-form-btn") ||
      target?.closest("#lu-form-menu")
    ) {
      return;
    }
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text.length < 3) {
        removeToolbar();
        return;
      }
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showToolbar(rect.left + window.scrollX, rect.bottom + window.scrollY, text);
    }, 10);
  });

  document.addEventListener("mousedown", (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (toolbarEl && !target?.closest("#lu-toolbar")) {
      removeToolbar();
    }
  });
}

// ============================================================
//  FORM INJECTION (with group + translate-write support)
// ============================================================

const TW_LANGUAGES = ["es", "en", "pt", "fr", "de", "it", "zh", "ja", "ko", "ru", "nl", "pl", "tr"];

let formBtn: HTMLButtonElement | null = null;
let formMenu: HTMLDivElement | null = null;
let formLoadingEl: HTMLDivElement | null = null;
let activeField: HTMLElement | null = null;
let fieldOriginal: string | null = null;

// Translate-write state (per-field)
let twActive = false;
let twTargetField: HTMLElement | null = null;
let twDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let twDebounceMs = 1500;
let twTargetLang = "en";
let twTranslating = false;
let twLastTranslatedText = "";

function removeFormUI(): void {
  if (formBtn) {
    formBtn.remove();
    formBtn = null;
  }
  if (formMenu) {
    formMenu.remove();
    formMenu = null;
  }
  if (formLoadingEl) {
    formLoadingEl.remove();
    formLoadingEl = null;
  }
}

function isFormElement(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const t = (el as HTMLInputElement).type;
    return t === "text" || t === "search" || t === "" || t === "url" || t === "email";
  }
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function getFieldValue(el: HTMLElement): string {
  if (el.isContentEditable) return el.textContent || el.innerText || "";
  return (el as HTMLInputElement).value || "";
}

function setFieldValue(el: HTMLElement, text: string): void {
  el.focus();
  if (el.isContentEditable) {
    // contentEditable: select all children, then replace with new text.
    // The previous implementation dispatched a fake Ctrl+A keydown which
    // doesn't actually select anything, causing text to be appended.
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand("insertText", false, text);
    // After execCommand, place cursor at the end so the user keeps typing.
    setTimeout(() => {
      el.focus();
      const selection2 = window.getSelection();
      if (selection2) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        selection2.removeAllRanges();
        selection2.addRange(range);
      }
    }, 0);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const input = el as HTMLInputElement;
    // setRangeText is the modern, reliable way to replace field content.
    // Falls back to direct assignment for inputs that don't support it
    // (e.g. type=email/number with selectionStart === null).
    try {
      input.setRangeText(text, 0, input.value.length, "end");
    } catch {
      input.value = text;
      try {
        const end = text.length;
        input.setSelectionRange(end, end);
      } catch {
        // some input types don't support setSelectionRange
      }
    }
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertReplacementText",
        data: text,
      })
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function showFormButton(el: HTMLElement): void {
  removeFormUI();
  activeField = el;
  const rect = el.getBoundingClientRect();

  formBtn = document.createElement("button");
  formBtn.id = "lu-form-btn";
  formBtn.textContent = "LU";
  formBtn.style.cssText = "position:fixed;z-index:2147483645;";
  document.body.appendChild(formBtn);

  const btnW = 28;
  const btnH = 18;
  let top = rect.top - btnH - 4;
  let left = rect.right - btnW - 4;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left < 4) left = 4;
  if (left + btnW > vw - 4) left = vw - btnW - 4;
  if (top < 4) top = rect.bottom + 4;
  if (top + btnH > vh - 4) top = vh - btnH - 4;
  formBtn.style.top = top + "px";
  formBtn.style.left = left + "px";

  if (twActive && twTargetField === el) {
    formBtn.classList.add("lu-tw-active");
  }

  formBtn.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (formMenu) {
      removeFormUI();
      return;
    }
    showFormMenu(el);
  });
}

function showFormMenu(el: HTMLElement): void {
  if (formMenu) {
    formMenu.remove();
    formMenu = null;
  }
  const rect = el.getBoundingClientRect();

  formMenu = document.createElement("div");
  formMenu.id = "lu-form-menu";
  formMenu.style.position = "fixed";
  formMenu.style.visibility = "hidden";
  document.body.appendChild(formMenu);

  // Single modes
  for (const mode of toolbarModes) {
    const item = document.createElement("div");
    item.className = "lu-fm-item";
    item.textContent = mode.name;
    item.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void processFormMode(el, mode.id, "");
    });
    formMenu.appendChild(item);
  }

  // Groups
  for (const group of toolbarGroups) {
    const groupItem = document.createElement("div");
    groupItem.className = "lu-fm-group";
    groupItem.innerHTML =
      escapeHtml(group.name) + ' <span class="lu-fm-arrow">\u25B6</span>';

    const subsContainer = document.createElement("div");
    subsContainer.className = "lu-fm-subs";

    for (const sub of group.subModes || []) {
      const subItem = document.createElement("div");
      subItem.className = "lu-fm-sub";
      subItem.textContent = sub.name;
      subItem.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        void processFormMode(el, group.id, sub.id);
      });
      subsContainer.appendChild(subItem);
    }

    groupItem.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const wasOpen = subsContainer.classList.contains("lu-show");
      formMenu
        ?.querySelectorAll<HTMLDivElement>(".lu-fm-subs.lu-show")
        .forEach((s) => s.classList.remove("lu-show"));
      if (!wasOpen) subsContainer.classList.add("lu-show");
    });

    formMenu.appendChild(groupItem);
    formMenu.appendChild(subsContainer);
  }

  // ---- Translate-write section ----
  const divider = document.createElement("div");
  divider.className = "lu-fm-divider";
  formMenu.appendChild(divider);

  if (twActive && twTargetField === el) {
    // Active: show language picker + stop
    const header = document.createElement("div");
    header.className = "lu-fm-tw-header";
    header.innerHTML =
      '<span class="lu-fm-tw-dot"></span> ' + msg("content_tw_active");
    formMenu.appendChild(header);

    for (const code of TW_LANGUAGES) {
      const langItem = document.createElement("div");
      langItem.className =
        "lu-fm-tw-lang" + (code === twTargetLang ? " lu-tw-selected" : "");
      langItem.textContent = i18n.langName(code);
      langItem.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        twTargetLang = code;
        void saveTWSettings();
        if (twTargetField && getFieldValue(twTargetField).trim()) {
          void triggerTranslate(twTargetField);
        }
        removeFormUI();
        showFormButton(el);
        showFormMenu(el);
      });
      formMenu.appendChild(langItem);
    }

    const stopItem = document.createElement("div");
    stopItem.className = "lu-fm-tw-stop";
    stopItem.textContent = "\u25A0 " + msg("content_tw_stop");
    stopItem.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      deactivateTW(el);
      removeFormUI();
      showFormButton(el);
    });
    formMenu.appendChild(stopItem);
  } else {
    // Inactive: show activate option
    const activateItem = document.createElement("div");
    activateItem.className = "lu-fm-item";
    activateItem.style.color = "var(--lu-accent, #e94560)";
    activateItem.style.fontWeight = "600";
    activateItem.textContent = "\uD83C\uDF10 " + msg("content_tw_activate");
    activateItem.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      activateTW(el);
      removeFormUI();
      showFormButton(el);
      showFormMenu(el);
    });
    formMenu.appendChild(activateItem);
  }

  // Position menu
  const menuW = 210;
  const menuH = formMenu.children.length * 28 + 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.top - menuH - 4;
  if (top < 4) top = rect.bottom + 4;
  if (top + menuH > vh - 4) top = vh - menuH - 4;
  let left = rect.right - menuW;
  if (left < 4) left = 4;
  if (left + menuW > vw - 4) left = vw - menuW - 4;
  formMenu.style.top = top + "px";
  formMenu.style.left = left + "px";
  formMenu.style.visibility = "";
}

// ---- Translate-write ----

function activateTW(el: HTMLElement): void {
  twActive = true;
  twTargetField = el;
  twTargetLang = twTargetLang || "en";
  el.classList.add("lu-tw-field-active");
  el.addEventListener("input", twInputHandler);
  void loadTWSettings();
}

function deactivateTW(el: HTMLElement | null): void {
  twActive = false;
  if (twDebounceTimer) {
    clearTimeout(twDebounceTimer);
    twDebounceTimer = null;
  }
  if (el) {
    el.classList.remove("lu-tw-field-active");
    el.removeEventListener("input", twInputHandler);
  }
  twTargetField = null;
  twTranslating = false;
}

function twInputHandler(e: Event): void {
  let el = e.target as HTMLElement;
  if (
    twTargetField &&
    twTargetField.isContentEditable &&
    twTargetField.contains(el)
  ) {
    el = twTargetField;
  }
  if (!twActive || twTargetField !== el) return;
  if (twTranslating) return;

  const text = getFieldValue(el);
  if (text === twLastTranslatedText) return;

  if (twDebounceTimer) {
    clearTimeout(twDebounceTimer);
    twDebounceTimer = null;
  }

  if (!text.trim() || text.trim().length < 3) return;

  twDebounceTimer = setTimeout(() => {
    void triggerTranslate(el);
  }, twDebounceMs);
}

async function triggerTranslate(el: HTMLElement): Promise<void> {
  if (twTranslating) return;
  const text = getFieldValue(el);
  if (!text.trim()) return;

  twTranslating = true;
  el.style.opacity = "0.6";

  try {
    const resp = (await browser.runtime.sendMessage({
      type: "translate-write",
      text: text.trim(),
      targetLang: twTargetLang,
      sourceLang: "",
    })) as { ok?: boolean; content?: string };

    if (resp && resp.ok && resp.content) {
      twLastTranslatedText = resp.content;
      setFieldValue(el, resp.content);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Lang Utils] Translate-write error:", (err as Error).message);
  }

  twTranslating = false;
  el.style.opacity = "";
}

function saveTWSettings(): Promise<void> {
  return browser.runtime
    .sendMessage({
      type: "save-translate-write-settings",
      settings: { targetLang: twTargetLang, debounceMs: twDebounceMs },
    })
    .then(() => undefined)
    .catch(() => undefined);
}

async function loadTWSettings(): Promise<void> {
  try {
    const resp = (await browser.runtime.sendMessage({
      type: "get-translate-write-settings",
    })) as { settings?: { targetLang?: string; debounceMs?: number } };
    if (resp && resp.settings) {
      twTargetLang = resp.settings.targetLang || "en";
      twDebounceMs = resp.settings.debounceMs || 1500;
    }
  } catch {
    // ignore
  }
}

async function processFormMode(
  el: HTMLElement,
  modeId: string,
  subModeId: string
): Promise<void> {
  removeFormUI();
  const text = getFieldValue(el);
  if (!text.trim()) return;

  fieldOriginal = text;
  const parent = el.parentElement;
  if (!parent) return;
  parent.style.position = parent.style.position || "relative";

  formLoadingEl = document.createElement("div");
  formLoadingEl.id = "lu-form-loading";
  parent.appendChild(formLoadingEl);

  try {
    const resp = (await browser.runtime.sendMessage({
      type: "process-mode-from-tab",
      modeId,
      subModeId: subModeId || "",
      text,
    })) as { ok?: boolean; content?: string; error?: string };
    if (formLoadingEl) {
      formLoadingEl.remove();
      formLoadingEl = null;
    }
    if (resp && resp.ok && resp.content) {
      setFieldValue(el, resp.content);
      showFormUndo(el, fieldOriginal);
    } else {
      // eslint-disable-next-line no-alert
      alert("Lang Utils error: " + (resp ? resp.error : "Unknown error"));
    }
  } catch (err) {
    if (formLoadingEl) {
      formLoadingEl.remove();
      formLoadingEl = null;
    }
    // eslint-disable-next-line no-alert
    alert("Lang Utils error: " + (err as Error).message);
  }
}

function showFormUndo(el: HTMLElement, original: string): void {
  const parent = el.parentElement;
  if (!parent) return;
  const existing = parent.querySelector<HTMLButtonElement>(".lu-form-undo");
  if (existing) existing.remove();

  const undoBtn = document.createElement("button");
  undoBtn.className = "lu-form-undo";
  undoBtn.textContent = "\uD83D\uDD04 " + msg("content_undo");
  parent.appendChild(undoBtn);

  undoBtn.addEventListener("click", () => {
    setFieldValue(el, original);
    undoBtn.remove();
  });
}

function setupFormInjection(): void {
  document.addEventListener("focusin", (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest("#lang-utils-panel") ||
      target?.closest("#lu-toolbar") ||
      target?.closest("#lu-form-menu") ||
      target?.closest("#lu-form-btn")
    ) {
      return;
    }
    let el: Element | null = e.target as Element | null;
    while (el && el !== document.body) {
      if (isFormElement(el)) {
        showFormButton(el);
        return;
      }
      el = el.parentElement;
    }
    removeFormUI();
  });

  document.addEventListener("focusout", (e: FocusEvent) => {
    setTimeout(() => {
      const active = document.activeElement;
      if (active === formBtn || (formMenu && active && formMenu.contains(active))) {
        return;
      }
      if (isFormElement(active as Element | null)) {
        if (activeField !== active) {
          showFormButton(active as HTMLElement);
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      if (!target?.closest("#lu-form-btn") && !target?.closest("#lu-form-menu")) {
        removeFormUI();
      }
    }, 200);
  });
}

// ============================================================
//  MESSAGE HANDLER (from background)
// ============================================================

function setupMessageHandler(): void {
  // The polyfill's OnMessageListener type expects one of three signatures:
  //   (msg, sender, sendResponse) => true   // sync response via sendResponse
  //   (msg, sender) => Promise<unknown>     // async response via returned Promise
  //   (msg, sender) => void                 // no response
  // We mix sync sendResponse (ping) and no-response (others), so cast.
  const listener = ((
    rawMessage: unknown,
    _sender: unknown,
    sendResponse: (response: unknown) => void
  ): true | undefined => {
    const message = rawMessage as Record<string, unknown>;
    const type = String(message.type || "");
    // eslint-disable-next-line no-console
    console.log("[Lang Utils Content] Received:", type);
    try {
      switch (type) {
        case "ping":
          sendResponse({ pong: true });
          return true; // keep channel open for sendResponse

        case "show-loading": {
          const title = String(message.title || "");
          createPanel(
            title,
            '<div class="lu-loading"><div class="lu-spinner"></div><span>' +
              msg("content_processing") +
              "</span></div>"
          );
          return;
        }

        case "show-result": {
          const title = String(message.title || "");
          const content = String(message.content || "");
          createPanel(title, markdownToHtml(content), {
            actions:
              '<div class="lu-actions-bar"><button class="lu-action-btn" id="lu-copy-full">' +
              msg("content_copy_all") +
              "</button></div>",
          });
          const copyFull = document.getElementById("lu-copy-full");
          copyFull?.addEventListener("click", () => {
            copyWithFeedback(
              content,
              copyFull as HTMLButtonElement,
              msg("content_copy_all")
            );
          });
          return;
        }

        case "show-error": {
          const title = String(message.title || "");
          const content = String(message.content || "");
          createPanel(
            title,
            '<div class="lu-error">' + escapeHtml(content) + "</div>"
          );
          return;
        }

        case "show-confirm": {
          const title = String(message.title || "");
          const content = String(message.content || "");
          const originalPrompt = String(message.originalPrompt || "");
          const modeName = String(message.modeName || "");
          const model = String(message.model || "");
          createPanel(
            title,
            '<div class="lu-info">' +
              escapeHtml(content) +
              "</div>" +
              '<div class="lu-confirm-btns">' +
              '<button class="lu-confirm-yes" id="lu-confirm-yes">' +
              msg("content_confirm_yes") +
              "</button>" +
              '<button class="lu-confirm-no" id="lu-confirm-no">' +
              msg("content_confirm_no") +
              "</button>" +
              "</div>"
          );
          const yesBtn = document.getElementById("lu-confirm-yes");
          yesBtn?.addEventListener("click", () => {
            removePanel();
            void browser.runtime.sendMessage({
              type: "confirm-proceed",
              proceed: true,
              originalPrompt,
              modeName,
              model,
            });
          });
          const noBtn = document.getElementById("lu-confirm-no");
          noBtn?.addEventListener("click", () => {
            removePanel();
          });
          return;
        }

        case "toggle-translate-write": {
          if (activeField && isFormElement(activeField)) {
            if (twActive && twTargetField === activeField) {
              deactivateTW(activeField);
            } else {
              activateTW(activeField);
            }
            removeFormUI();
            showFormButton(activeField);
            showFormMenu(activeField);
          }
          return;
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Lang Utils Content] Error handling:", type, e);
    }
    return;
  }) as never;

  browser.runtime.onMessage.addListener(listener);
}
