// ============================================
// Lang Utils - Content script
// Injects UI into web pages: result panel,
// floating toolbar with groups, form-injection
// button + menu, and translate-write mode.
// ============================================

import browser from "../lib/browser-compat";
import { i18n, msg, nativeLangName, langFlag, langCodes } from "../lib/i18n";
import { copyWithFeedback, markdownToFragmentWithUpgrade } from "../lib/utils";
import { loadAndApplyTheme, subscribeToSystemColorScheme } from "../lib/themes";
import { CONTENT_STYLES } from "./styles";
import type { AnyMode, Mode, ModeGroup, Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

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

// ============================================
// UI tunables
// ============================================

/** Vertical gap (px) between the user's selection and the floating toolbar. */
const TOOLBAR_OFFSET_PX = 10;

/** Max number of "favorite" modes shown in the floating toolbar (overflow goes into a submenu). */
const TOOLBAR_MAX_FAVORITES = 4;

/** Min characters of selected text before the floating toolbar appears (avoids showing on every click). */
const TOOLBAR_MIN_TEXT_CHARS = 3;

/** Delay (ms) after mouseup before positioning the toolbar, so the browser finalizes the selection. */
const TOOLBAR_POSITION_DELAY_MS = 10;

/** Min characters of text in a field before translate-while-write fires (avoid firing on 1-2 chars). */
const TRANSLATE_WRITE_MIN_CHARS = 3;

/** Default debounce (ms) for translate-while-write if the user has no saved setting. */
const TRANSLATE_WRITE_DEFAULT_DEBOUNCE_MS = 1500;

/** Debounce (ms) for form-field click events that decide whether to show the LU indicator. */
const FORM_CLICK_DEBOUNCE_MS = 200;

/** Safety margin (px) kept between injected UI and the viewport edges, so nothing gets clipped. */
const VIEWPORT_EDGE_MARGIN_PX = 4;

/** Fixed width and height (px) of the small floating "LU" button next to text fields. */
const FORM_BTN_WIDTH_PX = 36;
const FORM_BTN_HEIGHT_PX = 18;

/** Width of the form-mode menu in pixels. */
const FORM_MENU_WIDTH_PX = 210;
/** Height (px) per item inside the form-mode menu. */
const FORM_MENU_ITEM_HEIGHT_PX = 28;
/** Extra vertical padding (px) inside the form-mode menu. */
const FORM_MENU_VERTICAL_PADDING_PX = 16;

// ============================================
// Result popup tunables (when Settings.resultPopup is true)
// ============================================

/** Max width (px) of the result popup. */
const POPUP_MAX_WIDTH_PX = 380;
/** Max height (px) of the result popup. Content scrolls if it exceeds this. */
const POPUP_MAX_HEIGHT_PX = 320;
/** Min width (px) of the result popup (so short messages don't look like a chip). */
const POPUP_MIN_WIDTH_PX = 200;
/** Offset (px) from the selection rectangle to the popup edge. */
const POPUP_OFFSET_PX = 12;
/** Safety margin (px) between the popup and the viewport edges, same convention as the form UI. */
const POPUP_VIEWPORT_MARGIN_PX = VIEWPORT_EDGE_MARGIN_PX;

/** Default (px) top/left offset used when the popup is shown without a selection anchor. */
const POPUP_FALLBACK_OFFSET_PX = 20;

/** Main entry point for the content script. */
async function contentMain(): Promise<void> {
  // Clean up any ghost UI from a previous extension version/reload
  removeToolbar();
  removePanel();

  // Apply the user's theme to this page's :root so injected UI matches.
  await loadAndApplyTheme();
  await i18n.init();

  // Load current settings (so we can honor resultPopup preference, etc.)
  try {
    const resp = (await browser.runtime.sendMessage({
      type: "get-settings",
    })) as { settings?: Partial<Settings> };
    if (resp && resp.settings) {
      currentSettings = { ...currentSettings, ...resp.settings };
    }
  } catch {
    // No background yet; keep defaults.
  }

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

  // Live OS color-scheme sync. Only effective when mode === "auto".
  subscribeToSystemColorScheme(() => {
    void loadAndApplyTheme();
  });
}

// ============================================================
//  PANEL MANAGEMENT
// ============================================================

/** Local copy of the user's settings, loaded once at content script init. */
let currentSettings: Settings = { ...DEFAULT_SETTINGS };

let currentPanel: HTMLDivElement | null = null;
let currentPopup: HTMLDivElement | null = null;

/** Remove the current result panel if any. */
function removePanel(): void {
  if (currentPanel) {
    currentPanel.remove();
    currentPanel = null;
  }
}

// ============================================
//  RESULT POPUP (when Settings.resultPopup is true)
// ============================================

/** Active listeners for auto-dismissing the current popup; cleared on close. */
let popupDismissHandlers: {
  blur: () => void;
  pointer: (e: PointerEvent) => void;
  key: (e: KeyboardEvent) => void;
} | null = null;

/** Close + tear down the result popup, removing all dismiss listeners. */
function closePopup(): void {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  if (popupDismissHandlers) {
    window.removeEventListener("blur", popupDismissHandlers.blur);
    document.removeEventListener("pointerdown", popupDismissHandlers.pointer);
    document.removeEventListener("keydown", popupDismissHandlers.key);
    popupDismissHandlers = null;
  }
}

/** Position `popup` next to the given selection bounding rect, staying in the viewport. */
function positionPopupNearSelection(
  popup: HTMLDivElement,
  rect: DOMRect
): void {
  const margin = POPUP_VIEWPORT_MARGIN_PX;
  const offset = POPUP_OFFSET_PX;
  const popupWidth = popup.offsetWidth;
  const popupHeight = popup.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer below the selection; flip up if there's not enough room.
  let top = rect.bottom + window.scrollY + offset;
  if (top + popupHeight > window.scrollY + vh - margin) {
    top = rect.top + window.scrollY - popupHeight - offset;
  }
  // Nudge up if even the flipped position is off-screen.
  if (top < window.scrollY + margin) top = window.scrollY + margin;

  // Center horizontally on the selection, clamped to viewport.
  let left =
    rect.left + window.scrollX + (rect.width - popupWidth) / 2;
  if (left + popupWidth > window.scrollX + vw - margin) {
    left = window.scrollX + vw - popupWidth - margin;
  }
  if (left < window.scrollX + margin) left = window.scrollX + margin;

  popup.style.position = "absolute";
  popup.style.top = top + "px";
  popup.style.left = left + "px";
}

/** Get the bounding rect of the current selection, or null if empty/collapsed. */
function getSelectionRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

/** Open a transient result popup anchored at the current selection. */
function createPopup(
  title: string,
  bodyContent: string | Node,
  extraOptions: { copyText?: string } = {}
): HTMLDivElement {
  closePopup();

  const popup = document.createElement("div");
  popup.id = "lang-utils-popup";
  popup.dataset.luRoot = "1";

  const headerEl = document.createElement("div");
  headerEl.className = "lu-popup-header";
  const titleEl = document.createElement("span");
  titleEl.className = "lu-popup-title";
  titleEl.textContent = title;
  headerEl.appendChild(titleEl);

  const body = document.createElement("div");
  body.className = "lu-popup-body";
  if (typeof bodyContent === "string") {
    body.textContent = bodyContent;
  } else {
    body.appendChild(bodyContent);
  }

  popup.appendChild(headerEl);
  popup.appendChild(body);
  if (extraOptions.copyText) {
    const copyBtnEl = document.createElement("button");
    copyBtnEl.className = "lu-popup-copy";
    copyBtnEl.type = "button";
    copyBtnEl.title = msg("content_copy");
    copyBtnEl.textContent = "\uD83D\uDCCB";
    popup.appendChild(copyBtnEl);
  }
  document.body.appendChild(popup);

  // Make sure it's rendered with max sizes before we position it.
  popup.style.maxWidth = POPUP_MAX_WIDTH_PX + "px";
  popup.style.maxHeight = POPUP_MAX_HEIGHT_PX + "px";
  popup.style.minWidth = POPUP_MIN_WIDTH_PX + "px";

  // Wire the copy button if present.
  if (extraOptions.copyText) {
    const btn = popup.querySelector<HTMLButtonElement>(".lu-popup-copy");
    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      copyWithFeedback(
        extraOptions.copyText || "",
        btn,
        msg("content_copy")
      );
    });
  }

  // Position next to the selection, otherwise default to top-left with a fallback.
  const rect = getSelectionRect();
  if (rect) {
    positionPopupNearSelection(popup, rect);
  } else {
    popup.style.top = window.scrollY + POPUP_FALLBACK_OFFSET_PX + "px";
    popup.style.left = window.scrollX + POPUP_FALLBACK_OFFSET_PX + "px";
  }

  // Auto-dismiss handlers.
  const onBlur = () => closePopup();
  const onPointer = (e: PointerEvent) => {
    const target = e.target as Node | null;
    if (target && popup.contains(target)) return;
    closePopup();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closePopup();
    }
  };

  window.addEventListener("blur", onBlur);
  document.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", onKey);
  popupDismissHandlers = {
    blur: onBlur,
    pointer: onPointer,
    key: onKey,
  };

  currentPopup = popup;
  return popup;
}

/** Create the result panel with title + content. */
function createPanel(
  title: string,
  content: string | Node,
  options: { actions?: Node } = {}
): HTMLDivElement {
  removePanel();
  const panel = document.createElement("div");
  panel.id = "lang-utils-panel";

  const headerEl = document.createElement("div");
  headerEl.className = "lu-header";
  const titleEl = document.createElement("span");
  titleEl.className = "lu-header-title";
  titleEl.textContent = title;
  headerEl.appendChild(titleEl);

  const actions = document.createElement("div");
  actions.className = "lu-header-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "lu-btn";
  copyBtn.id = "lu-copy-btn";
  copyBtn.title = msg("content_copy");
  copyBtn.textContent = "\uD83D\uDCCB";
  actions.appendChild(copyBtn);

  const closeBtnHeader = document.createElement("button");
  closeBtnHeader.className = "lu-btn";
  closeBtnHeader.id = "lu-close-btn";
  closeBtnHeader.title = msg("content_close");
  closeBtnHeader.textContent = "\u2715";
  actions.appendChild(closeBtnHeader);

  headerEl.appendChild(actions);

  const body = document.createElement("div");
  body.className = "lu-body";
  body.id = "lu-body";
  if (typeof content === "string") {
    body.textContent = content;
  } else {
    body.appendChild(content);
  }

  panel.appendChild(headerEl);
  panel.appendChild(body);
  if (options.actions) {
    panel.appendChild(options.actions);
  }
  document.body.appendChild(panel);
  currentPanel = panel;

  const closeBtn = panel.querySelector<HTMLButtonElement>("#lu-close-btn");
  closeBtn?.addEventListener("click", removePanel);

  const copyBtn2 = panel.querySelector<HTMLButtonElement>("#lu-copy-btn");
  copyBtn2?.addEventListener("click", () => {
    const body = panel.querySelector<HTMLElement>("#lu-body");
    if (body) copyWithFeedback(body.textContent || "", copyBtn2);
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
  btn: HTMLButtonElement | null,
  targetLang?: string
): void {
  if (btn) {
    btn.disabled = true;
    if (btn.dataset.code) {
      btn.classList.add("lu-sub-loading");
      btn.setAttribute("aria-busy", "true");
    } else {
      btn.textContent = "...";
    }
  }
  browser.runtime
    .sendMessage({
      type: "process-mode-from-tab",
      modeId,
      subModeId: subModeId || "",
      text: selectedText,
      ...(targetLang ? { targetLang } : {}),
    })
    .then((resp: unknown) => {
      const r = resp as { ok?: boolean; content?: string; error?: string };
      removeToolbar();
      if (r && r.ok && r.content) {
        // markdownToFragment is async (lazy-loaded). Show the raw text in a
        // placeholder immediately so the popup/panel appears without delay,
        // then upgrade to rendered HTML once the bundle is ready.
        const placeholder = document.createElement("div");
        placeholder.className = "lu-markdown-loading";
        placeholder.textContent = r.content.replace(/\\n/g, "\n");
        if (currentSettings.resultPopup) {
          createPopup(msg("content_result"), placeholder, {
            copyText: r.content,
          });
        } else {
          createPanel(msg("content_result"), placeholder);
        }
        void markdownToFragmentWithUpgrade(r.content, placeholder);
      } else {
        const errMsg = r ? r.error || "Unknown error" : "Unknown error";
        const errorDiv = document.createElement("div");
        errorDiv.className = "lu-error";
        errorDiv.textContent = errMsg;
        if (currentSettings.resultPopup) {
          createPopup(
            msg("content_error"),
            errorDiv
          );
        } else {
          const errorDiv2 = document.createElement("div");
          errorDiv2.className = "lu-error";
          errorDiv2.textContent = errMsg;
          createPanel(
            msg("content_error"),
            errorDiv2
          );
        }
      }
    })
    .catch((err: Error) => {
      removeToolbar();
      const catchErrorDiv = document.createElement("div");
      catchErrorDiv.className = "lu-error";
      catchErrorDiv.textContent = err.message;
      if (currentSettings.resultPopup) {
        createPopup(
          msg("content_error"),
          catchErrorDiv
        );
      } else {
        const catchErrorDiv2 = document.createElement("div");
        catchErrorDiv2.className = "lu-error";
        catchErrorDiv2.textContent = err.message;
        createPanel(
          msg("content_error"),
          catchErrorDiv2
        );
      }
    });
}

/** Position a dropdown menu below a trigger button, keeping it within viewport. */
function positionMenu(trigger: HTMLElement, menu: HTMLElement): void {
  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const GAP = 4;

  // Preferred: below the trigger
  let top = triggerRect.bottom + GAP;
  let left = triggerRect.left;

  // Flip vertically if would go off bottom
  if (top + menuRect.height > vh) {
    top = triggerRect.top - menuRect.height - GAP;
  }

  // Flip horizontally if would go off right
  if (left + menuRect.width > vw) {
    left = triggerRect.right - menuRect.width;
  }

  // Clamp
  top = Math.max(GAP, Math.min(top, vh - menuRect.height - GAP));
  left = Math.max(GAP, Math.min(left, vw - menuRect.width - GAP));

  menu.style.top = top + "px";
  menu.style.left = left + "px";
}

/** Resolve {{targetLang}} placeholder in a mode name using the user's favorite target language. */
function renderModeName(mode: Mode): string {
  const target = currentSettings.favoriteTargetLang || "es";
  return mode.name.replace(/\{\{targetLang\}\}/g, nativeLangName(target));
}

/** Show the floating toolbar at coordinates. */
function showToolbar(x: number, y: number, selectedText: string): void {
  removeToolbar();

  toolbarEl = document.createElement("div");
  toolbarEl.id = "lu-toolbar";
  toolbarEl.style.left = x + "px";
  toolbarEl.style.top = y + TOOLBAR_OFFSET_PX + "px";

  // ── Always-present translate-to-favorite button (protected mode) ──────
  const translateMode = toolbarModes.find(
    (m): m is Mode => m.type === "single" && m.id === "translate-to-favorite"
  );
  if (translateMode) {
    const langWrapper = document.createElement("div");
    langWrapper.className = "lu-tb-group lu-tb-lang";

    const langBtn = document.createElement("button");
    langBtn.className = "lu-tb-btn lu-tb-fav lu-tb-lang-btn";
    langBtn.setAttribute("aria-haspopup", "true");
    langBtn.setAttribute("aria-expanded", "false");
    const targetCode = currentSettings.favoriteTargetLang || "es";
    const flag = langFlag(targetCode);
    const langLabel = document.createElement("span");
    langLabel.textContent = flag + " " + renderModeName(translateMode);
    langBtn.appendChild(langLabel);
    const langArrow = document.createElement("span");
    langArrow.className = "lu-tb-arrow";
    langArrow.setAttribute("aria-hidden", "true");
    langArrow.textContent = "\u25BC";
    langBtn.appendChild(langArrow);

    const langMenu = document.createElement("div");
    langMenu.className = "lu-tb-group-menu lu-tb-lang-menu";

    for (const code of langCodes()) {
      const item = document.createElement("button");
      item.className = "lu-tb-sub";
      item.dataset.code = code;
      if (code === targetCode) item.classList.add("lu-tb-sub-current");
      const itemLabel = document.createElement("span");
      itemLabel.textContent = langFlag(code) + " " + nativeLangName(code);
      item.appendChild(itemLabel);
      if (code === targetCode) {
        const check = document.createElement("span");
        check.className = "lu-tb-check";
        check.textContent = "\u2713";
        item.appendChild(check);
      }
      item.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentSettings.autoSetFavorite) {
          currentSettings.favoriteTargetLang = code;
          void browser.runtime.sendMessage({
            type: "save-settings",
            settings: { favoriteTargetLang: code },
          });
        }
        // Always translate to the selected language (code), not the old favorite
        sendModeToAPI(translateMode.id, "", selectedText, item, code);
      });
      langMenu.appendChild(item);
    }

    langBtn.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const wasOpen = langMenu.classList.contains("lu-show");
      document
        .querySelectorAll<HTMLDivElement>(".lu-tb-group-menu.lu-show")
        .forEach((m) => m.classList.remove("lu-show"));
      if (!wasOpen) {
        positionMenu(langBtn, langMenu);
        langMenu.classList.add("lu-show");
      }
      // Directly translate to the current favorite language as well
      sendModeToAPI(translateMode.id, "", selectedText, langBtn, targetCode);
    });

    // JS hover with delay & gap tolerance (replaces CSS :hover)
    let hoverTimer: number;
    const HOVER_OPEN_DELAY = 120;
    const HOVER_CLOSE_DELAY = 200;

    function openMenu() {
      clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => {
        document
          .querySelectorAll<HTMLDivElement>(".lu-tb-group-menu.lu-show")
          .forEach((m) => m.classList.remove("lu-show"));
        positionMenu(langBtn, langMenu);
        langMenu.classList.add("lu-show");
      }, HOVER_OPEN_DELAY);
    }
    function closeMenu() {
      clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => {
        langMenu.classList.remove("lu-show");
      }, HOVER_CLOSE_DELAY);
    }

    langBtn.addEventListener("mouseenter", openMenu);
    langBtn.addEventListener("mouseleave", closeMenu);
    langMenu.addEventListener("mouseenter", openMenu);
    langMenu.addEventListener("mouseleave", closeMenu);

    langWrapper.appendChild(langBtn);
    langWrapper.appendChild(langMenu);
    toolbarEl.appendChild(langWrapper);
  }

  // ── Other single modes (skip translate-to-favorite; already rendered) ──
  const singleModesFrag = document.createDocumentFragment();
  for (const mode of toolbarModes) {
    if (mode.type !== "single") continue;
    if (mode.id === "translate-to-favorite") continue;
    const btn = document.createElement("button");
    btn.className = mode.favorite ? "lu-tb-fav" : "lu-tb-btn";
    btn.textContent = mode.name;
    btn.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sendModeToAPI(mode.id, "", selectedText, btn);
    });
    singleModesFrag.appendChild(btn);
  }
  toolbarEl.appendChild(singleModesFrag);

  // ── Group modes (sub-menus) ────────────────────────────────────────────
  const groupModesFrag = document.createDocumentFragment();
  for (const group of toolbarGroups) {
    const wrapper = document.createElement("div");
    wrapper.className = "lu-tb-group";

    const btn = document.createElement("button");
    btn.className = "lu-tb-group-btn";
    const groupName = document.createElement("span");
    groupName.textContent = group.name;
    btn.appendChild(groupName);
    const groupArrow = document.createElement("span");
    groupArrow.className = "lu-tb-arrow";
    groupArrow.textContent = "\u25BC";
    btn.appendChild(groupArrow);

    const menu = document.createElement("div");
    menu.className = "lu-tb-group-menu";

    const subModesFrag = document.createDocumentFragment();
    for (const sub of group.subModes || []) {
      const subBtn = document.createElement("button");
      subBtn.className = "lu-tb-sub";
      subBtn.textContent = sub.name;
      subBtn.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        sendModeToAPI(group.id, sub.id, selectedText, subBtn);
      });
      subModesFrag.appendChild(subBtn);
    }
    menu.appendChild(subModesFrag);

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
    groupModesFrag.appendChild(wrapper);
  }
  toolbarEl.appendChild(groupModesFrag);

  document.body.appendChild(toolbarEl);
}

/** Fetch modes from the background, classify into favorites + groups, and
 *  ensure the protected translate-to-favorite mode is always present. */
function refreshToolbarModes(): Promise<void> {
  return browser.runtime
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
          .slice(0, TOOLBAR_MAX_FAVORITES);
      }
      // Ensure the protected translate-to-favorite mode is always present,
      // even if the user toggled it off in favorites.
      const hasTranslateMode = toolbarModes.some(
        (m) => m.id === "translate-to-favorite"
      );
      if (!hasTranslateMode) {
        const fallback = r.modes.find((m) => m.id === "translate-to-favorite");
        if (fallback) toolbarModes.unshift(fallback);
      }
    })
    .catch(() => {
      // ignore — content script may run before background is ready
    });
}

/** Set up the toolbar: load modes + listen for selection changes. */
function setupToolbar(): void {
  // Load modes (initial fetch)
  void refreshToolbarModes();

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
      if (text.length < TOOLBAR_MIN_TEXT_CHARS) {
        removeToolbar();
        return;
      }
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showToolbar(rect.left + window.scrollX, rect.bottom + window.scrollY, text);
    }, TOOLBAR_POSITION_DELAY_MS);
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
  formBtn.title = "Lang Utils — translate this field";
  formBtn.textContent = "LU";
  const formArrow = document.createElement("span");
  formArrow.className = "lu-form-arrow";
  formArrow.setAttribute("aria-hidden", "true");
  formArrow.textContent = "\u25BE";
  formBtn.appendChild(formArrow);
  formBtn.style.cssText = "position:fixed;z-index:2147483645;";
  document.body.appendChild(formBtn);

  const btnW = FORM_BTN_WIDTH_PX;
  const btnH = FORM_BTN_HEIGHT_PX;
  const edge = VIEWPORT_EDGE_MARGIN_PX;
  let top = rect.top - btnH - edge;
  let left = rect.right - btnW - edge;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left < edge) left = edge;
  if (left + btnW > vw - edge) left = vw - btnW - edge;
  if (top < edge) top = rect.bottom + edge;
  if (top + btnH > vh - edge) top = vh - btnH - edge;
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

  const fragment = document.createDocumentFragment();

  // Single modes (skip translate-to-favorite — handled by the toolbar)
  for (const mode of toolbarModes) {
    if (mode.type === "single" && mode.id === "translate-to-favorite") continue;
    const item = document.createElement("div");
    item.className = "lu-fm-item";
    item.textContent = mode.name;
    item.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void processFormMode(el, mode.id, "");
    });
    fragment.appendChild(item);
  }

  // Groups
  for (const group of toolbarGroups) {
    const groupItem = document.createElement("div");
    groupItem.className = "lu-fm-group";
    const groupName = document.createElement("span");
    groupName.textContent = group.name;
    groupItem.appendChild(groupName);
    groupItem.appendChild(document.createTextNode(" "));
    const groupArrow = document.createElement("span");
    groupArrow.className = "lu-fm-arrow";
    groupArrow.textContent = "\u25B6";
    groupItem.appendChild(groupArrow);

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

    fragment.appendChild(groupItem);
    fragment.appendChild(subsContainer);
  }

  // ---- Translate-write section ----
  const divider = document.createElement("div");
  divider.className = "lu-fm-divider";
  fragment.appendChild(divider);

  if (twActive && twTargetField === el) {
    // Active: show language picker + stop
    const header = document.createElement("div");
    header.className = "lu-fm-tw-header";
    const twDot = document.createElement("span");
    twDot.className = "lu-fm-tw-dot";
    header.appendChild(twDot);
    header.appendChild(document.createTextNode(" " + msg("content_tw_active")));
    fragment.appendChild(header);

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
      fragment.appendChild(langItem);
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
    fragment.appendChild(stopItem);
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
    fragment.appendChild(activateItem);
  }

  formMenu.appendChild(fragment);

  // Position menu
  const menuW = FORM_MENU_WIDTH_PX;
  const menuH =
    formMenu.children.length * FORM_MENU_ITEM_HEIGHT_PX +
    FORM_MENU_VERTICAL_PADDING_PX;
  const edge = VIEWPORT_EDGE_MARGIN_PX;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.top - menuH - edge;
  if (top < edge) top = rect.bottom + edge;
  if (top + menuH > vh - edge) top = vh - menuH - edge;
  let left = rect.right - menuW;
  if (left < edge) left = edge;
  if (left + menuW > vw - edge) left = vw - menuW - edge;
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

  if (!text.trim() || text.trim().length < TRANSLATE_WRITE_MIN_CHARS) return;

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
      twTargetLang = resp.settings.targetLang || currentSettings.favoriteTargetLang || "es";
      twDebounceMs = resp.settings.debounceMs || TRANSLATE_WRITE_DEFAULT_DEBOUNCE_MS;
    }
  } catch {
    // ignore
  }
}

/** Re-fetch both general settings and translate-write settings from background
 *  so the content script stays in sync after options-page saves. */
async function refreshSettings(): Promise<void> {
  try {
    const resp = (await browser.runtime.sendMessage({
      type: "get-settings",
    })) as { settings?: Partial<Settings> };
    if (resp && resp.settings) {
      currentSettings = { ...currentSettings, ...resp.settings };
    }
  } catch {
    // no background yet
  }
  // Re-init i18n so msg() picks up the new locale
  await i18n.reinit();
  await loadTWSettings();
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
       
      alert("Lang Utils error: " + (resp ? resp.error : "Unknown error"));
    }
  } catch (err) {
    if (formLoadingEl) {
      formLoadingEl.remove();
      formLoadingEl = null;
    }
     
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
    }, FORM_CLICK_DEBOUNCE_MS);
  });
}

// ============================================================
//  MESSAGE HANDLER (from background)
// ============================================================

function handleShowLoading(message: Record<string, unknown>) {
  const title = String(message.title || "");
  const loadingOuter = document.createElement("div");
  loadingOuter.className = "lu-loading";
  const spinner = document.createElement("div");
  spinner.className = "lu-spinner";
  loadingOuter.appendChild(spinner);
  const loadingSpan = document.createElement("span");
  loadingSpan.textContent = msg("content_processing");
  loadingOuter.appendChild(loadingSpan);
  if (currentSettings.resultPopup) {
    createPopup(title, loadingOuter);
  } else {
    const loadingOuter2 = document.createElement("div");
    loadingOuter2.className = "lu-loading";
    const spinner2 = document.createElement("div");
    spinner2.className = "lu-spinner";
    loadingOuter2.appendChild(spinner2);
    const loadingSpan2 = document.createElement("span");
    loadingSpan2.textContent = msg("content_processing");
    loadingOuter2.appendChild(loadingSpan2);
    createPanel(title, loadingOuter2);
  }
}

function handleShowResult(message: Record<string, unknown>) {
  const title = String(message.title || "");
  const content = String(message.content || "");
  // markdownToFragment is async (lazy-loaded). Use a placeholder
  // element so the panel/popup appears immediately, then upgrade
  // to rendered HTML once the bundle is ready.
  const placeholder = document.createElement("div");
  placeholder.className = "lu-markdown-loading";
  placeholder.textContent = content.replace(/\\n/g, "\n");
  if (currentSettings.resultPopup) {
    createPopup(title, placeholder, { copyText: content });
    void markdownToFragmentWithUpgrade(content, placeholder);
  } else {
    const actionsBar = document.createElement("div");
    actionsBar.className = "lu-actions-bar";
    const copyFullBtn = document.createElement("button");
    copyFullBtn.className = "lu-action-btn";
    copyFullBtn.id = "lu-copy-full";
    copyFullBtn.textContent = msg("content_copy_all");
    actionsBar.appendChild(copyFullBtn);
    createPanel(title, placeholder, { actions: actionsBar });
    copyFullBtn.addEventListener("click", () => {
      copyWithFeedback(
        content,
        copyFullBtn as HTMLButtonElement,
        msg("content_copy_all")
      );
    });
    void markdownToFragmentWithUpgrade(content, placeholder);
  }
}

function handleShowError(message: Record<string, unknown>) {
  const title = String(message.title || "");
  const content = String(message.content || "");
  const showErrorDiv = document.createElement("div");
  showErrorDiv.className = "lu-error";
  showErrorDiv.textContent = content;
  if (currentSettings.resultPopup) {
    createPopup(title, showErrorDiv);
  } else {
    const showErrorDiv2 = document.createElement("div");
    showErrorDiv2.className = "lu-error";
    showErrorDiv2.textContent = content;
    createPanel(title, showErrorDiv2);
  }
}

function handleToggleTranslateWrite() {
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
}

function handleModesUpdated() {
  // Toolbar must reflect the latest mode list (favorites, additions,
  // deletions, edits). Re-fetch and rebuild.
  removeToolbar();
  void refreshToolbarModes();
}

function handleSettingsUpdated() {
  // Options/background saved new settings (favoriteTargetLang,
  // resultPopup, translate-write target/debounce, etc.).
  void refreshSettings();
}

function handleCleanupUI() {
  // Extension updated or browser started — remove any ghost UI from
  // previous versions that might still be in the DOM.
  removeToolbar();
  removePanel();
}

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
        case "show-loading":
          handleShowLoading(message);
          return;
        case "show-result":
          handleShowResult(message);
          return;
        case "show-error":
          handleShowError(message);
          return;
        case "toggle-translate-write":
          handleToggleTranslateWrite();
          return;
        case "modes-updated":
          handleModesUpdated();
          return;
        case "settings-updated":
          handleSettingsUpdated();
          return;
        case "cleanup-ui":
          handleCleanupUI();
          return;
      }
    } catch (e) {
      console.error("[Lang Utils Content] Error handling:", type, e);
    }
    return;
  }) as never;

  browser.runtime.onMessage.addListener(listener);
}
