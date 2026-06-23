// ============================================
//  Lang Utils - Popup script
//  Persistent window with favorites + all modes.
// ============================================

/** Delay (ms) before closing the popup after it loses focus. */
const POPUP_BLUR_CLOSE_DELAY_MS = 150;

import browser from "../lib/browser-compat";
import { i18n, msg } from "../lib/i18n";
import { escapeHtml } from "../lib/utils";
import { loadAndApplyTheme } from "../lib/themes";
import { $, $span, $div, $btn } from "../lib/dom";
import type { AnyMode, Settings } from "../types";

document.addEventListener("DOMContentLoaded", () => {
  void popupMain();
});

async function popupMain(): Promise<void> {
  await loadAndApplyTheme();
  await i18n.init();
  i18n.translatePage();
  await checkAPIStatus();
  await loadModes();
  setupButtons();

  // Close popup window when it loses focus (browser action behavior)
  window.addEventListener("blur", () => {
    setTimeout(() => {
      window.close();
    }, POPUP_BLUR_CLOSE_DELAY_MS);
  });
}

async function checkAPIStatus(): Promise<void> {
  const dot = $span("status-dot");
  const text = $span("status-text");
  const modelInfo = $span("model-info");
  if (!dot || !text || !modelInfo) return;

  try {
    const resp = (await browser.runtime.sendMessage({
      type: "get-settings",
    })) as { settings: Settings };
    const s = resp.settings;
    if (!s.apiKey) {
      dot.className = "status-dot offline";
      text.textContent = msg("popup_status_not_configured");
      modelInfo.textContent = msg("popup_status_configure_hint");
      return;
    }
    dot.className = "status-dot online";
    text.textContent = msg("popup_status_configured");
    modelInfo.textContent = msg("popup_status_model") + s.model;
  } catch (err) {
    dot.className = "status-dot offline";
    text.textContent = msg("popup_status_error");
    modelInfo.textContent = String((err as Error).message || err);
  }
}

async function loadModes(): Promise<void> {
  const container = $div("popup-modes-list");
  const favContainer = $div("favorites-list");
  const favSection = $div("favorites-section");
  if (!container || !favContainer || !favSection) return;

  const resp = (await browser.runtime.sendMessage({
    type: "get-modes",
  })) as { modes: AnyMode[] };
  const modes = resp.modes;

  if (!modes || modes.length === 0) {
    container.innerHTML =
      '<p style="color:var(--lu-text-muted);text-align:center;">' +
      msg("popup_no_modes") +
      "</p>";
    return;
  }

  const favs = modes.filter((m) => m.favorite);
  const nonChatbot = modes.filter((m) => m.type === "single" && m.prompt !== "__CHATBOT__");

  if (favs.length > 0) {
    favSection.style.display = "block";
    favContainer.innerHTML = "";
    for (const mode of favs) {
      const item = document.createElement("div");
      item.className = "mode-item fav-item";
      item.innerHTML =
        '<span class="mode-icon">\u2B50</span>' +
        '<span class="mode-name">' +
        escapeHtml(mode.name) +
        "</span>" +
        (mode.model
          ? '<span class="mode-model-badge">' + escapeHtml(mode.model) + "</span>"
          : "");
      item.addEventListener("click", () => {
        void browser.runtime.openOptionsPage();
      });
      favContainer.appendChild(item);
    }
  } else {
    favSection.style.display = "none";
  }

  container.innerHTML = "";
  for (const mode of nonChatbot) {
    const item = document.createElement("div");
    item.className = "mode-item" + (mode.favorite ? " mode-item-fav" : "");
    item.innerHTML =
      '<span class="mode-icon">' +
      (mode.favorite ? "\u2B50" : "\u26A1") +
      "</span>" +
      '<span class="mode-name">' +
      escapeHtml(mode.name) +
      "</span>" +
      (mode.model
        ? '<span class="mode-model-badge">' + escapeHtml(mode.model) + "</span>"
        : "");
    item.addEventListener("click", () => {
      void browser.runtime.openOptionsPage();
    });
    container.appendChild(item);
  }
}

function setupButtons(): void {
  const closeBtn = $btn("close-popup-btn");
  closeBtn?.addEventListener("click", () => {
    void browser.runtime.sendMessage({ type: "close-popup" });
  });

  const settingsBtn = $btn("settings-btn");
  settingsBtn?.addEventListener("click", () => {
    void browser.runtime.openOptionsPage();
  });

  const chatbotBtn = $btn("open-chatbot-btn");
  chatbotBtn?.addEventListener("click", async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].id) return;
    let selectedText = "";
    try {
      if (browser.scripting) {
        const results = await browser.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => window.getSelection()?.toString() || "",
        });
        selectedText = String((results && results[0]?.result) || "");
      } else if (browser.tabs.executeScript) {
        // Firefox legacy MV2 fallback
        const results = await browser.tabs.executeScript(tabs[0].id, {
          code: "window.getSelection().toString()",
        });
        selectedText = String((results && results[0]) || "");
      }
    } catch {
      // ignore — selectedText stays empty
    }
    void browser.windows.create({
      url:
        browser.runtime.getURL("chatbot/chatbot.html") +
        "?text=" +
        encodeURIComponent(selectedText) +
        "&tabId=" +
        tabs[0].id,
      type: "popup",
      width: 500,
      height: 650,
    });
  });
}

// Suppress unused import warning for `$` (kept for future use)
void $;
