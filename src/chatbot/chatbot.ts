// ============================================
// Lang Utils - Chatbot script
// Multi-turn conversation about selected text.
// API calls go through the background script.
// ============================================

import browser from "../lib/browser-compat";
import { i18n, msg } from "../lib/i18n";
import { copyWithFeedback, markdownToFragmentWithUpgrade } from "../lib/utils";
import { loadAndApplyTheme, subscribeToSystemColorScheme } from "../lib/themes";
import { $div, $btn, $textarea } from "../lib/dom";
import type { ChatMessage, ContentMessage } from "../types";

const params = new URLSearchParams(window.location.search);
const selectedText = decodeURIComponent(params.get("text") || "");

/** Max height in px that the chat input textarea auto-grows to. */
const CHAT_INPUT_MAX_HEIGHT_PX = 120;
const TYPING_INDICATOR_DOT_COUNT = 3;

const contextText = $div("context-text");
const messagesContainer = $div("messages");
const userInput = $textarea("user-input");
const sendBtn = $btn("send-btn");
const closeBtn = $btn("close-btn");

const conversationHistory: ChatMessage[] = [];
let isLoading = false;
let loadingEl: HTMLDivElement | null = null;

/** Initialize on script load. */
async function chatbotMain(): Promise<void> {
  await loadAndApplyTheme();
  await i18n.init();
  i18n.translatePage();

  if (contextText) {
    contextText.textContent = selectedText || msg("chatbot_no_text");
  }

  // Live OS color-scheme sync. Only effective when mode === "auto".
  subscribeToSystemColorScheme(() => {
    void loadAndApplyTheme();
  });

  conversationHistory.push({
    role: "system",
    content:
      msg("bg_chatbot_system") +
      'TEXTO SELECCIONADO:\n"""\n' +
      selectedText +
      '\n"""\n\n' +
      msg("bg_chatbot_lang_hint"),
  });

  setupListeners();
  userInput?.focus();
}

function setupListeners(): void {
  // Listen for responses from background (no response needed back).
  const listener = ((rawMessage: unknown): void => {
    const message = rawMessage as ContentMessage;
    if (message.type === "chat-response") {
      removeLoading();
      addMessage("ai", message.content);
      conversationHistory.push({ role: "assistant", content: message.content });
      isLoading = false;
      scrollToBottom();
    }
    if (message.type === "chat-error") {
      removeLoading();
      addMessage("error", message.content);
      isLoading = false;
      scrollToBottom();
    }
  }) as never;

  browser.runtime.onMessage.addListener(listener);

  // Send button
  sendBtn?.addEventListener("click", () => {
    if (userInput) sendMessage(userInput.value);
  });

  // Enter to send (Shift+Enter for newline)
  userInput?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(userInput.value);
    }
  });

  // Auto-resize textarea
  userInput?.addEventListener("input", () => {
    if (!userInput) return;
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, CHAT_INPUT_MAX_HEIGHT_PX) + "px";
  });

  // Close
  closeBtn?.addEventListener("click", () => window.close());

  // Quick prompts
  document.querySelectorAll<HTMLButtonElement>(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sendMessage(btn.dataset.prompt || "");
    });
  });
}

function sendMessage(text: string): void {
  if (!text.trim() || isLoading) return;
  addMessage("user", text);
  conversationHistory.push({ role: "user", content: text });
  if (userInput) {
    userInput.value = "";
    userInput.style.height = "auto";
  }
  isLoading = true;
  addLoading();
  scrollToBottom();
  void browser.runtime.sendMessage({
    type: "chat-message",
    messages: conversationHistory,
  });
}

type MessageType = "user" | "ai" | "error";

function addMessage(type: MessageType, content: string): void {
  if (!messagesContainer) return;
  const div = document.createElement("div");
  div.className = "message " + type + "-message";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  if (type === "ai") {
    // Render trusted markdown from our own AI response. If the response ever
    // could include user-influenced HTML, switch to DOMPurify.
    // The renderer is lazy-loaded on first AI message; until it finishes,
    // we show the raw markdown as plain text in a placeholder element and
    // upgrade it to rendered HTML once the bundle is ready.
    const placeholder = document.createElement("div");
    placeholder.className = "lu-markdown-loading";
    placeholder.textContent = content.replace(/\\n/g, "\n");
    contentDiv.appendChild(placeholder);
    void markdownToFragmentWithUpgrade(content, placeholder);
  } else {
    contentDiv.textContent = content;
  }
  div.appendChild(contentDiv);

  if (type === "ai") {
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "message-actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn";
    copyBtn.textContent = "\uD83D\uDCCB";
    copyBtn.addEventListener("click", () => {
      copyWithFeedback(content, copyBtn);
    });
    actionsDiv.appendChild(copyBtn);
    div.appendChild(actionsDiv);
  }

  messagesContainer.appendChild(div);
  scrollToBottom();
}

function addLoading(): void {
  if (!messagesContainer) return;
  loadingEl = document.createElement("div");
  loadingEl.className = "message ai-message loading-message";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  for (let i = 0; i < TYPING_INDICATOR_DOT_COUNT; i++) {
    const dot = document.createElement("span");
    indicator.appendChild(dot);
  }
  contentDiv.appendChild(indicator);
  loadingEl.appendChild(contentDiv);

  messagesContainer.appendChild(loadingEl);
  scrollToBottom();
}

function removeLoading(): void {
  if (loadingEl) {
    loadingEl.remove();
    loadingEl = null;
  }
}

function scrollToBottom(): void {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

void chatbotMain();
