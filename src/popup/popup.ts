// ============================================
//  Lang Utils - Popup script
//  Persistent window with favorites + all modes.
// ============================================

/** Delay (ms) before closing the popup after it loses focus. */
const POPUP_BLUR_CLOSE_DELAY_MS = 150;

import browser from "../lib/browser-compat";
import { i18n, msg } from "../lib/i18n";
import { loadAndApplyTheme, subscribeToSystemColorScheme } from "../lib/themes";
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

  // Live OS color-scheme sync while the popup is open. Only effective
  // when mode === "auto".
  subscribeToSystemColorScheme(() => {
    void loadAndApplyTheme();
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
    const empty = document.createElement("p");
    empty.style.color = "var(--lu-text-muted)";
    empty.style.textAlign = "center";
    empty.textContent = msg("popup_no_modes");
    container.replaceChildren(empty);
    return;
  }

  const favs = modes.filter((m) => m.favorite);
  const nonChatbot = modes.filter(
    (m) => m.type === "single" && m.prompt !== "__CHATBOT__"
  );

  if (favs.length > 0) {
    favSection.style.display = "block";
    favContainer.replaceChildren();
    for (const mode of favs) {
      const item = buildModeItem(mode, true);
      item.addEventListener("click", () => {
        void browser.runtime.openOptionsPage();
      });
      favContainer.appendChild(item);
    }
  } else {
    favSection.style.display = "none";
  }

  container.replaceChildren();
  for (const mode of nonChatbot) {
    const item = buildModeItem(mode, mode.favorite);
    item.addEventListener("click", () => {
      void browser.runtime.openOptionsPage();
    });
    container.appendChild(item);
  }
}

/** Build a single mode entry in the popup. */
function buildModeItem(mode: AnyMode, isFav: boolean): HTMLDivElement {
  const item = document.createElement("div");
  item.className = "mode-item" + (isFav ? " mode-item-fav" : "");

  const icon = document.createElement("span");
  icon.className = "mode-icon";
  icon.textContent = isFav ? "\u2B50" : "\u26A1";
  item.appendChild(icon);

  const name = document.createElement("span");
  name.className = "mode-name";
  name.textContent = mode.name;
  item.appendChild(name);

  if (mode.model) {
    const modelBadge = document.createElement("span");
    modelBadge.className = "mode-model-badge";
    modelBadge.textContent = mode.model;
    item.appendChild(modelBadge);
  }

  return item;
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
