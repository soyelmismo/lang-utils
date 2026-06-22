/* ============================================
   Lang Utils - Chatbot Script
   Multi-turn conversation about selected text
   API calls go through background.js
   Uses shared utils.js and i18n.js (loaded via <script>)
   ============================================ */

(function () {
  "use strict";

  var LU = window.LangUtils;

  var params = new URLSearchParams(window.location.search);
  var selectedText = decodeURIComponent(params.get("text") || "");

  var contextText = document.getElementById("context-text");
  var messagesContainer = document.getElementById("messages");
  var userInput = document.getElementById("user-input");
  var sendBtn = document.getElementById("send-btn");
  var closeBtn = document.getElementById("close-btn");

  var conversationHistory = [];
  var isLoading = false;
  var loadingEl = null;

  contextText.textContent = selectedText || LUI18n.msg("chatbot_no_text");

  conversationHistory.push({
    role: "system",
    content:
      LUI18n.msg("bg_chatbot_system") +
      'TEXTO SELECCIONADO:\n"""\n' + selectedText + '\n"""\n\n' +
      LUI18n.msg("bg_chatbot_lang_hint")
  });

  // ---- Listen for responses from background ----
  browser.runtime.onMessage.addListener(function (msg) {
    if (msg.type === "chat-response") {
      removeLoading();
      addMessage("ai", msg.content);
      conversationHistory.push({ role: "assistant", content: msg.content });
      isLoading = false;
      scrollToBottom();
    }
    if (msg.type === "chat-error") {
      removeLoading();
      addMessage("error", msg.content);
      isLoading = false;
      scrollToBottom();
    }
  });

  // ---- Send ----
  function sendMessage(text) {
    if (!text.trim() || isLoading) return;
    addMessage("user", text);
    conversationHistory.push({ role: "user", content: text });
    userInput.value = "";
    userInput.style.height = "auto";
    isLoading = true;
    addLoading();
    scrollToBottom();
    browser.runtime.sendMessage({ type: "chat-message", messages: conversationHistory });
  }

  // ---- UI ----
  function addMessage(type, content) {
    var div = document.createElement("div");
    div.className = "message " + type + "-message";

    var contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = type === "ai" ? LU.markdownToHtml(content) : LU.escapeHtml(content);
    div.appendChild(contentDiv);

    if (type === "ai") {
      var actionsDiv = document.createElement("div");
      actionsDiv.className = "message-actions";
      var copyBtn = document.createElement("button");
      copyBtn.className = "msg-action-btn";
      copyBtn.textContent = "\uD83D\uDCCB";
      copyBtn.addEventListener("click", function () {
        LU.copyWithFeedback(content, copyBtn);
      });
      actionsDiv.appendChild(copyBtn);
      div.appendChild(actionsDiv);
    }
    messagesContainer.appendChild(div);
    scrollToBottom();
  }

  function addLoading() {
    loadingEl = document.createElement("div");
    loadingEl.className = "message ai-message loading-message";
    loadingEl.innerHTML = '<div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
    messagesContainer.appendChild(loadingEl);
    scrollToBottom();
  }

  function removeLoading() {
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ---- Events ----
  sendBtn.addEventListener("click", function () { sendMessage(userInput.value); });
  userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(userInput.value); }
  });
  userInput.addEventListener("input", function () {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  });
  closeBtn.addEventListener("click", function () { window.close(); });
  document.querySelectorAll(".quick-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { sendMessage(btn.dataset.prompt); });
  });
  userInput.focus();
})();
