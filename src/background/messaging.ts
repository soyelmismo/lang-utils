// ============================================
// Lang Utils - Background handler logic
// Pure(ish) functions that the background entry
// (index.ts) wires up to listeners. Keeping them
// separate makes them testable and shorter.
// ============================================

import browser from "../lib/browser-compat";
import { storage } from "../lib/storage";
import { i18n, msg } from "../lib/i18n";
import {
  buildBody,
  callAPI,
  callChatAPI,
  doAPIFetch,
  testAPIConnection,
} from "../lib/api";
import {
  AnyMode,
  ChatMessage,
  Result,
  Settings,
  SubMode,
} from "../types";
import {
  cloneDefaultModes,
  DEFAULT_MODES,
  LANG_MAP,
} from "./modes";
import {
  findModeById,
  getEffectiveModel,
  getEffectivePrompt,
  ModeLookup,
} from "./mode-helpers";

// ---- Module state (single source of truth in background) ----
let currentModes: AnyMode[] = [];
let settings: Settings = {
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.7,
  language: "es",
  resultPopup: true,
  favoriteTargetLang: "es",
  autoSetFavorite: false,
};
let popupWindowId: number | null = null;

/** Tagged console.log with [Lang Utils] prefix. */
export function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log("[Lang Utils]", ...args);
}

/** Number of characters echoed back from the API test connection (for the user to confirm the model is alive). */
const API_TEST_ECHO_CHARS = 60;

// ============================================
//  INIT
// ============================================

/** Initialize background: load modes + settings, build context menus. */
let initPromise: Promise<void> | null = null;
export async function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    log("Starting init...");
  await i18n.init();

  const storedModes = await storage.getModes();
  if (!storedModes || storedModes.length === 0) {
    currentModes = cloneDefaultModes();
    await storage.setModes(currentModes);
    log("Created default modes:", currentModes.length);
  } else {
    currentModes = storedModes;
    // Migration: ensure all modes have required fields
    let changed = false;
    for (const m of currentModes as Array<Record<string, unknown> & AnyMode>) {
      if (m.favorite === undefined) {
        m.favorite = false;
        changed = true;
      }
      if (m.model === undefined) {
        m.model = "";
        changed = true;
      }
      if (m.type === undefined) {
        (m as { type: string }).type = "single";
        changed = true;
      }
      if (m.type === "group" && !m.subModes) {
        (m as { subModes: unknown[] }).subModes = [];
        changed = true;
      }
    }
    if (changed) await storage.setModes(currentModes);
    log("Loaded stored modes:", currentModes.length);
  }

  settings = await storage.getSettings();
  await storage.setSettings(settings);

  buildContextMenus();
  log("Init complete. API key present:", !!settings.apiKey);
  })();
  return initPromise;
}

// ============================================
//  CONTEXT MENUS
// ============================================

/** Remove all existing context menus and rebuild from currentModes. */
export function buildContextMenus(): void {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "lang-utils-root",
      title: "Lang Utils",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: "lang-utils-chatbot",
      title: msg("bg_chatbot_menu"),
      parentId: "lang-utils-root",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: "lang-utils-sep1",
      type: "separator",
      parentId: "lang-utils-root",
      contexts: ["selection"],
    });

    for (const mode of currentModes) {
      if (mode.type === "group" && mode.subModes && mode.subModes.length > 0) {
        browser.contextMenus.create({
          id: "group-" + mode.id,
          title: mode.name + (mode.favorite ? " \u2B50" : ""),
          parentId: "lang-utils-root",
          contexts: ["selection"],
        });
        for (const sub of mode.subModes) {
          browser.contextMenus.create({
            id: "sub-" + mode.id + ":" + sub.id,
            title: sub.name,
            parentId: "group-" + mode.id,
            contexts: ["selection"],
          });
        }
      } else if (mode.type === "single" && mode.prompt === "__CHATBOT__") {
        continue; // chatbot already added above
      } else {
        browser.contextMenus.create({
          id: "mode-" + mode.id,
          title: mode.name + (mode.favorite ? " \u2B50" : ""),
          parentId: "lang-utils-root",
          contexts: ["selection"],
        });
      }
    }
    log("Context menus built");
  });
}

// ============================================
//  TAB / INJECTION HELPERS
// ============================================

interface TabLike {
  id?: number;
}

/** Resolve a tab object or query the active tab. */
async function getTab(tab?: TabLike | null): Promise<browser.Tabs.Tab | null> {
  if (tab && tab.id) return tab as browser.Tabs.Tab;
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

/**
 * Try to ping the content script in a tab. If not present, inject it.
 * In MV3 we cannot use browser.tabs.executeScript (that's MV2 only);
 * we use browser.scripting.executeScript instead, and rely on the
 * content_scripts entry in manifest.json for auto-injection.
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  // Try ping first
  try {
    const response = (await browser.tabs.sendMessage(tabId, {
      type: "ping",
    })) as { pong?: boolean } | undefined;
    if (response && response.pong) return true;
  } catch {
    // not injected yet
  }
  // Try scripting API (MV3). If not available, the content_scripts
  // entry in manifest.json should still have injected it on page load
  // — but for already-loaded pages we need this manual injection.
  try {
    if (browser.scripting && browser.scripting.executeScript) {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      log("Injected content.js into tab", tabId);
      return true;
    }
  } catch (e) {
    log("Cannot inject into tab", tabId, (e as Error).message);
  }
  return false;
}

/** Send a message to a tab, injecting the content script if needed. */
export async function sendToTab(
  tabId: number,
  message: unknown
): Promise<boolean> {
  try {
    await browser.tabs.sendMessage(tabId, message);
    return true;
  } catch (e) {
    log("sendMessage failed, trying injection...", (e as Error).message);
    const ok = await ensureContentScript(tabId);
    if (!ok) return false;
    try {
      await browser.tabs.sendMessage(tabId, message);
      return true;
    } catch (e2) {
      log(
        "sendMessage still failed after injection:",
        (e2 as Error).message
      );
      return false;
    }
  }
}

// ============================================
//  AI PROCESSING
// ============================================

interface ProcessOpts {
  model: string;
  name: string;
}

/** Process a selection with AI and show the result panel. */
export async function processWithAI(
  prompt: string,
  tab: browser.Tabs.Tab | { id?: number },
  modeName: string,
  modeOpts: ProcessOpts
): Promise<void> {
  log("processWithAI:", modeName, "tab:", tab.id);
  const tabId = tab.id ?? -1;
  if (tabId < 0) {
    log("ERROR: No tab id");
    return;
  }

  const sent = await sendToTab(tabId, { type: "show-loading", title: modeName });
  if (!sent) {
    log("ERROR: Could not send to tab, aborting");
    return;
  }

  if (!settings.apiKey) {
    void sendToTab(tabId, {
      type: "show-error",
      title: msg("content_error"),
      content: msg("bg_api_not_configured"),
    });
    return;
  }

  try {
    const result = await callAPI(
      prompt,
      modeOpts.model || "",
      settings,
      msg("bg_system_prompt")
    );
    void sendToTab(tabId, { type: "show-result", title: modeName, content: result });
  } catch (err) {
    log("API error:", (err as Error).message);
    void sendToTab(tabId, {
      type: "show-error",
      title: msg("content_error"),
      content: (err as Error).message,
    });
  }
}

/** Process a mode triggered from inside a tab (toolbar / form injection). */
async function processModeFromTab(
  modeId: string,
  subModeId: string,
  text: string,
  targetLang?: string
): Promise<Result> {
  if (!settings.apiKey) {
    return { ok: false, error: msg("bg_api_not_configured") };
  }
  const found = findModeById(currentModes, subModeId || modeId);
  if (!found) return { ok: false, error: "Mode not found" };

  const effectiveMode = (found.subMode || found.mode) as {
    prompt?: string;
  };
  const model = getEffectiveModel(found.subMode, found.mode);
  const prompt = getEffectivePrompt(effectiveMode, text, targetLang);

  try {
    const result = await callAPI(
      prompt,
      model,
      settings,
      msg("bg_system_prompt")
    );
    return { ok: true, content: result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================
//  CHATBOT
// ============================================

/** Open the chatbot window with the selected text. */
export function openChatbot(selectionText: string, tab: browser.Tabs.Tab): void {
  browser.windows.create({
    url:
      "chatbot/chatbot.html?text=" +
      encodeURIComponent(selectionText) +
      "&tabId=" +
      tab.id,
    type: "popup",
    width: 500,
    height: 650,
  });
}

/** Handle multi-turn chat from chatbot window. */
async function handleChatMessage(
  tab: browser.Tabs.Tab | null,
  messages: ChatMessage[]
): Promise<void> {
  if (!tab || !tab.id) return;
  try {
    const result = await callChatAPI(messages, settings);
    await browser.tabs
      .sendMessage(tab.id, { type: "chat-response", content: result })
      .catch(() => {
        // ignore
      });
  } catch (err) {
    await browser.tabs
      .sendMessage(tab.id, {
        type: "chat-error",
        content: (err as Error).message,
      })
      .catch(() => {
        // ignore
      });
  }
}

// ============================================
//  MODE TRANSLATION (translate-mode / undo-translate-mode)
// ============================================

/** Translate a mode's name + prompt to the target language. */
async function handleTranslateMode(
  modeId: string,
  targetLang: string
): Promise<Result> {
  const found: ModeLookup | null = findModeById(currentModes, modeId);
  if (!found) return { ok: false, error: "Mode not found" };
  if (!settings.apiKey) {
    return { ok: false, error: msg("bg_api_not_configured") };
  }

  const mode = (found.subMode || found.mode) as {
    name: string;
    prompt: string;
    _originalName?: string;
    _originalPrompt?: string;
    _translatedTo?: string;
  };

  // Undo previous translation if any
  if (mode._originalName) {
    mode.name = mode._originalName; // type narrowing: truthy → string
    if (mode._originalPrompt !== undefined) {
      mode.prompt = mode._originalPrompt;
    }
    delete mode._originalName;
    delete mode._originalPrompt;
    delete mode._translatedTo;
  }

  const origName = mode.name;
  const origPrompt = mode.prompt;

  // Translate name
  const namePrompt =
    'Translate the following mode name to ' +
    targetLang +
    '. Reply ONLY with the translated name, nothing else:\n\n"' +
    origName +
    '"';
  let translatedName: string;
  try {
    translatedName = await doAPIFetch(
      buildBody([{ role: "user", content: namePrompt }], "", settings),
      settings
    );
  } catch (e) {
    return { ok: false, error: "Name translation failed: " + (e as Error).message };
  }

  // Translate prompt (if not chatbot placeholder)
  let translatedPrompt = origPrompt;
  if (origPrompt && origPrompt !== "__CHATBOT__") {
    const promptPrompt =
      "Translate the following instruction/prompt to " +
      targetLang +
      ". Keep the {{selection}} placeholder exactly as-is. Reply ONLY with the translated prompt:\n\n" +
      origPrompt;
    try {
      translatedPrompt = await doAPIFetch(
        buildBody([{ role: "user", content: promptPrompt }], "", settings),
        settings
      );
    } catch (e) {
      return {
        ok: false,
        error: "Prompt translation failed: " + (e as Error).message,
      };
    }
  }

  mode._originalName = origName;
  mode._originalPrompt = origPrompt;
  mode._translatedTo = targetLang;
  mode.name = (translatedName || origName).replace(/^["']|["']$/g, "").trim();
  mode.prompt = translatedPrompt || origPrompt;

  await storage.setModes(currentModes);
  buildContextMenus();
  return { ok: true, modes: currentModes };
}

/** Undo a previously-translated mode. */
function handleUndoTranslate(modeId: string): Result {
  const found = findModeById(currentModes, modeId);
  if (!found) return { ok: false, error: "Mode not found" };
  const mode = (found.subMode || found.mode) as {
    name: string;
    prompt: string;
    _originalName?: string;
    _originalPrompt?: string;
    _translatedTo?: string;
  };
  if (!mode._originalName) return { ok: false, error: "No translation to undo" };
  mode.name = mode._originalName; // truthy → string
  if (mode._originalPrompt !== undefined) {
    mode.prompt = mode._originalPrompt;
  }
  delete mode._originalName;
  delete mode._originalPrompt;
  delete mode._translatedTo;
  void storage.setModes(currentModes);
  buildContextMenus();
  return { ok: true, modes: currentModes };
}

// ============================================
//  TRANSLATE-WRITE
// ============================================

/** Live translate text while the user types (translate-write mode). */
async function handleTranslateWrite(
  text: string,
  targetLang: string,
  sourceLang: string
): Promise<Result> {
  if (!settings.apiKey) {
    return { ok: false, error: msg("bg_api_not_configured") };
  }
  if (!text || !text.trim()) return { ok: true, content: "" };

  const targetName = LANG_MAP[targetLang] || targetLang;
  const sourceHint = sourceLang
    ? (LANG_MAP[sourceLang] || sourceLang) + " or "
    : "";
  const promptText =
    "Translate the following text to " +
    targetName +
    ". The text may be in " +
    sourceHint +
    "any language. Reply ONLY with the translation, no explanations:\n\n" +
    text;

  try {
    const result = await callAPI(
      promptText,
      "",
      settings,
      msg("bg_system_prompt")
    );
    return { ok: true, content: result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================
//  POPUP WINDOW
// ============================================

/** Open the popup as a persistent window (or focus if already open). */
export function openPopupWindow(): void {
  if (popupWindowId !== null) {
    browser.windows
      .get(popupWindowId)
      .then(() => {
        void browser.windows.update(popupWindowId!, { focused: true });
      })
      .catch(() => {
        popupWindowId = null;
        openPopupWindow();
      });
    return;
  }
  browser.windows
    .create({
      url: "popup/popup.html",
      type: "popup",
      width: 380,
      height: 520,
    })
    .then((win: browser.Windows.Window) => {
      popupWindowId = win.id ?? null;
      browser.windows.onRemoved.addListener(function onRemoved(winId: number) {
        if (winId === popupWindowId) {
          popupWindowId = null;
          browser.windows.onRemoved.removeListener(onRemoved);
        }
      });
    });
}

// ============================================
//  CONTEXT MENU CLICK
// ============================================

/** Handle a context menu click. */
export async function onContextMenuClicked(
  info: { menuItemId: string | number; selectionText?: string },
  tab?: { id?: number } | null
): Promise<void> {
  log("Context menu clicked:", info.menuItemId);
  const resolvedTab = await getTab(tab);
  if (!resolvedTab || !resolvedTab.id) {
    log("ERROR: No tab available");
    return;
  }

  // Chatbot shortcut
  if (info.menuItemId === "lang-utils-chatbot") {
    openChatbot(info.selectionText || "", resolvedTab);
    return;
  }

  const menuItemId = String(info.menuItemId);
  const selectionText = info.selectionText || "";

  if (menuItemId.startsWith("sub-")) {
    // Sub-mode click: "sub-{groupId}:{subModeId}"
    const ids = menuItemId.replace("sub-", "").split(":");
    const subModeId = ids[1] || "";
    const found = findModeById(currentModes, subModeId);
    if (!found || !found.subMode) {
      log("ERROR: Sub-mode not found:", subModeId);
      return;
    }
    const prompt = getEffectivePrompt(found.subMode, selectionText);
    const model = getEffectiveModel(found.subMode, found.mode);
    const displayName = found.mode.name + " > " + found.subMode.name;
    log("Processing sub-mode:", displayName, "model:", model || "(default)");
    await processWithAI(prompt, resolvedTab, displayName, {
      model,
      name: displayName,
    });
  } else if (menuItemId.startsWith("mode-")) {
    const modeId = menuItemId.replace("mode-", "");
    const found = findModeById(currentModes, modeId);
    if (!found) {
      log("ERROR: Mode not found:", modeId);
      return;
    }
    // For top-level modes, only single modes have a prompt to use.
    const mode = found.mode;
    if (mode.type !== "single") {
      log("ERROR: Top-level mode is a group:", modeId);
      return;
    }
    const prompt = getEffectivePrompt(mode, selectionText);
    const model = getEffectiveModel(null, mode);
    const displayName = mode.name;
    log("Processing mode:", displayName);
    await processWithAI(prompt, resolvedTab, displayName, {
      model,
      name: displayName,
    });
  }
}

// ============================================
//  MESSAGE ROUTER
// ============================================

import type { BackgroundMessage } from "../types";

/** Handle a runtime message from popup/options/chatbot/content. */
export async function onMessage(
  message: BackgroundMessage,
  sender: browser.Runtime.MessageSender
): Promise<unknown> {
  if (initPromise) await initPromise;
  switch (message.type) {
    case "ping":
      return { pong: true };

    case "test-api": {
      if (!settings.apiKey) {
        return { ok: false, error: msg("bg_api_not_configured") };
      }
      try {
        const text = await testAPIConnection(settings, msg("bg_test_prompt"));
        return { ok: true, data: (text || "").substring(0, API_TEST_ECHO_CHARS) };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }

    case "get-modes":
      return { modes: currentModes };

    case "get-settings":
      return { settings };

    case "save-settings":
      settings = { ...settings, ...message.settings };
      await storage.setSettings(settings);
      return { ok: true };

    case "save-modes":
      currentModes = message.modes;
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true };

    case "add-mode":
      currentModes.push(message.mode);
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };

    case "update-mode":
      currentModes = currentModes.map((m) =>
        m.id === message.mode.id ? message.mode : m
      );
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };

    case "delete-mode": {
      const target = currentModes.find((m) => m.id === message.id);
      if (target && "protected" in target && target.protected) {
        return { ok: false, error: "Cannot delete protected mode" };
      }
      currentModes = currentModes.filter((m) => m.id !== message.id);
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };
    }

    case "toggle-favorite":
      currentModes = currentModes.map((m) =>
        m.id === message.id ? { ...m, favorite: !m.favorite } : m
      );
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };

    case "add-sub-mode": {
      currentModes = currentModes.map((m) => {
        if (m.id === message.groupId && m.type === "group") {
          const g = m;
          return { ...g, subModes: [...(g.subModes || []), message.subMode] };
        }
        return m;
      });
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };
    }

    case "update-sub-mode": {
      currentModes = currentModes.map((m) => {
        if (m.id === message.groupId && m.type === "group" && m.subModes) {
          return {
            ...m,
            subModes: m.subModes.map((s) =>
              s.id === message.subMode.id ? message.subMode : s
            ),
          };
        }
        return m;
      });
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };
    }

    case "delete-sub-mode": {
      currentModes = currentModes.map((m) => {
        if (m.id === message.groupId && m.type === "group" && m.subModes) {
          return {
            ...m,
            subModes: m.subModes.filter((s) => s.id !== message.subId),
          };
        }
        return m;
      });
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };
    }

    case "chat-message":
      void handleChatMessage(sender.tab ?? null, message.messages);
      return true; // async — response will come as a separate message

    case "process-mode-from-tab":
      return processModeFromTab(message.modeId, message.subModeId, message.text, message.targetLang);

    case "reset-modes":
      currentModes = cloneDefaultModes();
      await storage.setModes(currentModes);
      buildContextMenus();
      return { ok: true, modes: currentModes };

    case "close-popup":
      if (sender.tab && sender.tab.id !== undefined) {
        void browser.tabs.remove(sender.tab.id);
      }
      return { ok: true };

    case "translate-mode":
      return handleTranslateMode(message.modeId, message.targetLang);

    case "undo-translate-mode":
      return handleUndoTranslate(message.modeId);

    case "get-favorites": {
      const favs = currentModes.filter((m) => m.favorite);
      return { favorites: favs };
    }

    case "get-translate-write-settings": {
      const tw = await storage.getTranslateWriteSettings();
      return { settings: tw };
    }

    case "save-translate-write-settings":
      await storage.setTranslateWriteSettings(message.settings);
      return { ok: true };

    case "translate-write":
      return handleTranslateWrite(
        message.text,
        message.targetLang,
        message.sourceLang
      );

    default:
      return { ok: false, error: "Unknown message type" };
  }
}

// Re-export for index.ts to use
export { DEFAULT_MODES, findModeById };
export type { SubMode };
