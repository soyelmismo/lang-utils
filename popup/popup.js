/* ============================================
   Lang Utils - Popup Script
   Persistent window with favorites + all modes
   Uses shared utils.js and i18n.js (loaded via <script>)
   ============================================ */

document.addEventListener("DOMContentLoaded", async function () {
  await LUI18n.init();
  LUI18n.translatePage();
  await checkAPIStatus();
  await loadModes();
  setupButtons();
});

async function checkAPIStatus() {
  var dot = document.getElementById("status-dot");
  var text = document.getElementById("status-text");
  var modelInfo = document.getElementById("model-info");
  try {
    var resp = await browser.runtime.sendMessage({ type: "get-settings" });
    var s = resp.settings;
    if (!s.apiKey) {
      dot.className = "status-dot offline";
      text.textContent = LUI18n.msg("popup_status_not_configured");
      modelInfo.textContent = LUI18n.msg("popup_status_configure_hint");
      return;
    }
    dot.className = "status-dot online";
    text.textContent = LUI18n.msg("popup_status_configured");
    modelInfo.textContent = LUI18n.msg("popup_status_model") + s.model;
  } catch (err) {
    dot.className = "status-dot offline";
    text.textContent = LUI18n.msg("popup_status_error");
    modelInfo.textContent = err.message;
  }
}

async function loadModes() {
  var container = document.getElementById("popup-modes-list");
  var favContainer = document.getElementById("favorites-list");
  var favSection = document.getElementById("favorites-section");
  var resp = await browser.runtime.sendMessage({ type: "get-modes" });
  var modes = resp.modes;

  if (!modes || modes.length === 0) {
    container.innerHTML = '<p style="color:#888;text-align:center;">' + LUI18n.msg("popup_no_modes") + '</p>';
    return;
  }

  // Split favorites and all modes
  var favs = modes.filter(function (m) { return m.favorite; });
  var nonChatbot = modes.filter(function (m) { return m.prompt !== "__CHATBOT__"; });

  // Render favorites
  if (favs.length > 0) {
    favSection.style.display = "block";
    favContainer.innerHTML = "";
    favs.forEach(function (mode) {
      var item = document.createElement("div");
      item.className = "mode-item fav-item";
      item.innerHTML =
        '<span class="mode-icon">\u2B50</span>' +
        '<span class="mode-name">' + LangUtils.escapeHtml(mode.name) + '</span>' +
        (mode.model ? '<span class="mode-model-badge">' + LangUtils.escapeHtml(mode.model) + '</span>' : '');
      item.addEventListener("click", function () {
        browser.runtime.openOptionsPage();
      });
      favContainer.appendChild(item);
    });
  } else {
    favSection.style.display = "none";
  }

  // Render all modes
  container.innerHTML = "";
  nonChatbot.forEach(function (mode) {
    var item = document.createElement("div");
    item.className = "mode-item" + (mode.favorite ? " mode-item-fav" : "");
    item.innerHTML =
      '<span class="mode-icon">' + (mode.favorite ? '\u2B50' : '\u26A1') + '</span>' +
      '<span class="mode-name">' + LangUtils.escapeHtml(mode.name) + '</span>' +
      (mode.model ? '<span class="mode-model-badge">' + LangUtils.escapeHtml(mode.model) + '</span>' : '');
    item.addEventListener("click", function () {
      browser.runtime.openOptionsPage();
    });
    container.appendChild(item);
  });
}

function setupButtons() {
  document.getElementById("close-popup-btn").addEventListener("click", function () {
    browser.runtime.sendMessage({ type: "close-popup" });
  });
  document.getElementById("settings-btn").addEventListener("click", function () {
    browser.runtime.openOptionsPage();
  });
  document.getElementById("open-chatbot-btn").addEventListener("click", async function () {
    var tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;
    var results = await browser.tabs.executeScript(tabs[0].id, { code: "window.getSelection().toString()" });
    var selectedText = (results && results[0]) || "";
    browser.windows.create({
      url: "chatbot/chatbot.html?text=" + encodeURIComponent(selectedText) + "&tabId=" + tabs[0].id,
      type: "popup",
      width: 500,
      height: 650
    });
  });
}
