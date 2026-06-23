// ============================================
// Lang Utils - Background entry point
// Wires up init + listeners and delegates to
// messaging.ts for the actual logic.
// Works as both a service worker (Chrome MV3)
// and an event page (Firefox MV3).
// ============================================

import browser from "../lib/browser-compat";
import {
  init,
  onMessage,
  onContextMenuClicked,
  openPopupWindow,
  log,
} from "./messaging";
import type { BackgroundMessage } from "../types";

// ---- Start up ----
void init().catch((err) => {
  log("Init failed:", err);
});

// ---- Context menu clicks ----
browser.contextMenus.onClicked.addListener((info, tab) => {
  void onContextMenuClicked(info, tab).catch((err: unknown) => {
    log("CLICK HANDLER ERROR:", (err as Error).message, (err as Error).stack);
  });
});

// ---- Toolbar icon click → open popup window ----
// In MV3 the property is browser.action (Firefox/Chrome) or browser.browserAction (legacy).
const action = browser.action || browser.browserAction;
if (action && action.onClicked) {
  action.onClicked.addListener(() => {
    openPopupWindow();
  });
}

// ---- Runtime messages ----
browser.runtime.onMessage.addListener((message: unknown, sender: unknown) => {
  // The polyfill types message as `unknown`; cast to our tagged union.
  return onMessage(
    message as BackgroundMessage,
    sender as browser.Runtime.MessageSender
  );
});

// ---- Lifecycle: handle install / startup ----
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") {
    log("Extension updated — cleaning up ghost UI in all tabs");
    broadcastCleanup();
  } else {
    log("Extension installed");
  }
});

// On browser startup, re-init in case the service worker was killed
if (browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(() => {
    log("Browser startup — re-initializing + cleanup");
    void init();
    broadcastCleanup();
  });
}

function broadcastCleanup(): void {
  browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { type: "cleanup-ui" }).catch(() => {
          // Ignore tabs that can't receive messages (e.g., chrome://, about:)
        });
      }
    }
  });
}

log("Background loaded");
