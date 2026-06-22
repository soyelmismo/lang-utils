/* ============================================
   Lang Utils - Options Page
   Settings + CRUD for modes + groups + sub-modes
   Uses shared utils.js and i18n.js (loaded via <script>)
   ============================================ */

var LU = window.LangUtils;
var currentSettings = {};
var currentModes = [];
var translatingModes = {};

// ---- Init ----
document.addEventListener("DOMContentLoaded", async function () {
  await LUI18n.init();
  LUI18n.translatePage();
  await loadSettings();
  await loadModes();
  await loadTWSettings();
  setupSettingsForm();
  setupModeForm();
  setupSubModeForm();
  setupPresets();
  setupTWSettingsForm();
  setupLanguageSwitcher();
});

// ---- Load Settings ----
async function loadSettings() {
  var resp = await browser.runtime.sendMessage({ type: "get-settings" });
  currentSettings = resp.settings;
  document.getElementById("api-url").value = currentSettings.apiUrl || "";
  document.getElementById("api-key").value = currentSettings.apiKey || "";
  document.getElementById("model").value = currentSettings.model || "";
  document.getElementById("temperature").value = currentSettings.temperature || 0.7;
  // Use stored uiLocale for the dropdown, fallback to settings.language
  var stored = await browser.storage.local.get(["uiLocale"]);
  var locale = stored.uiLocale || currentSettings.language || "es";
  document.getElementById("main-language").value = locale;
}

// ---- Load Modes ----
async function loadModes() {
  var resp = await browser.runtime.sendMessage({ type: "get-modes" });
  currentModes = resp.modes;
  renderModesList();
}

function readSettingsForm() {
  return {
    apiUrl: document.getElementById("api-url").value.trim(),
    apiKey: document.getElementById("api-key").value.trim(),
    model: document.getElementById("model").value.trim(),
    temperature: parseFloat(document.getElementById("temperature").value) || 0.7,
    language: document.getElementById("main-language").value
  };
}

// ---- Settings Form ----
function setupSettingsForm() {
  var form = document.getElementById("settings-form");
  var testBtn = document.getElementById("test-api-btn");
  var saveStatus = document.getElementById("save-status");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    currentSettings = readSettingsForm();
    await browser.runtime.sendMessage({ type: "save-settings", settings: currentSettings });
    saveStatus.textContent = LUI18n.msg("options_saved");
    saveStatus.style.color = "#4ade80";
    setTimeout(function () { saveStatus.textContent = ""; }, 3000);
  });

  testBtn.addEventListener("click", async function () {
    var statusEl = document.getElementById("api-test-status");
    statusEl.textContent = LUI18n.msg("options_testing");
    statusEl.style.color = "#facc15";
    currentSettings = readSettingsForm();
    await browser.runtime.sendMessage({ type: "save-settings", settings: currentSettings });
    var result = await browser.runtime.sendMessage({ type: "test-api" });
    if (result.ok) {
      statusEl.textContent = "OK: " + (result.data || "");
      statusEl.style.color = "#4ade80";
    } else {
      statusEl.textContent = result.error;
      statusEl.style.color = "#f87171";
    }
  });

  document.getElementById("toggle-key").addEventListener("click", function () {
    var input = document.getElementById("api-key");
    var btn = document.getElementById("toggle-key");
    if (input.type === "password") { input.type = "text"; btn.textContent = "\uD83D\uDE48"; }
    else { input.type = "password"; btn.textContent = "\uD83D\uDC41\uFE0F"; }
  });
}

// ---- Modes CRUD ----
function setupModeForm() {
  document.getElementById("add-mode-btn").addEventListener("click", function () { openModal(null, "single"); });
  document.getElementById("add-group-btn").addEventListener("click", function () { openModal(null, "group"); });

  document.getElementById("reset-modes-btn").addEventListener("click", async function () {
    if (confirm(LUI18n.msg("confirm_reset"))) {
      var resp = await browser.runtime.sendMessage({ type: "reset-modes" });
      currentModes = resp.modes;
      renderModesList();
    }
  });

  document.getElementById("modal-cancel").addEventListener("click", closeModal);

  document.getElementById("mode-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = document.getElementById("mode-id").value;
    var type = document.getElementById("mode-type").value;
    var name = document.getElementById("mode-name").value.trim();
    if (!name) return;

    if (type === "group") {
      var model = document.getElementById("mode-model").value.trim();
      if (id) {
        var existing = currentModes.find(function (m) { return m.id === id; });
        if (existing) {
          existing.name = name;
          existing.model = model;
          await browser.runtime.sendMessage({ type: "update-mode", mode: existing });
        }
      } else {
        var newId = "group-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
        await browser.runtime.sendMessage({
          type: "add-mode",
          mode: { id: newId, name: name, type: "group", model: model, favorite: false, subModes: [] }
        });
      }
    } else {
      var prompt = document.getElementById("mode-prompt").value.trim();
      var model = document.getElementById("mode-model").value.trim();
      if (!prompt) return;
      if (id) {
        await browser.runtime.sendMessage({
          type: "update-mode",
          mode: { id: id, name: name, prompt: prompt, model: model, isDefault: false, type: "single", favorite: getModeFavorite(id) }
        });
      } else {
        var newId = "custom-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
        await browser.runtime.sendMessage({
          type: "add-mode",
          mode: { id: newId, name: name, prompt: prompt, model: model, isDefault: false, type: "single", favorite: false }
        });
      }
    }
    await loadModes();
    closeModal();
  });
}

function setupSubModeForm() {
  document.getElementById("sub-modal-cancel").addEventListener("click", closeSubModal);

  document.getElementById("sub-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var groupId = document.getElementById("sub-group-id").value;
    var subId = document.getElementById("sub-id").value;
    var name = document.getElementById("sub-name").value.trim();
    var prompt = document.getElementById("sub-prompt").value.trim();
    var model = document.getElementById("sub-model").value.trim();
    if (!name || !prompt) return;

    if (subId) {
      await browser.runtime.sendMessage({
        type: "update-sub-mode",
        groupId: groupId,
        subMode: { id: subId, name: name, prompt: prompt, model: model }
      });
    } else {
      var newSubId = "sub-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
      await browser.runtime.sendMessage({
        type: "add-sub-mode",
        groupId: groupId,
        subMode: { id: newSubId, name: name, prompt: prompt, model: model }
      });
    }
    await loadModes();
    closeSubModal();
  });
}

function getModeFavorite(id) {
  var m = currentModes.find(function (x) { return x.id === id; });
  return m ? m.favorite : false;
}

function setupPresets() {
  document.querySelectorAll(".preset-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var promptField = document.getElementById("mode-prompt");
      if (promptField) promptField.value = btn.dataset.prompt;
    });
  });
}

// ---- Render Modes List ----
function renderModesList() {
  var container = document.getElementById("modes-list");
  container.innerHTML = "";

  if (currentModes.length === 0) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">' + LUI18n.msg("no_modes") + '</p>';
    return;
  }

  var lang = currentSettings.language || "es";
  var langName = LUI18n.langName(lang);

  currentModes.forEach(function (mode) {
    if (mode.type === "group") {
      renderGroupCard(container, mode, langName);
    } else {
      renderModeCard(container, mode, langName);
    }
  });

  attachEventListeners(container);
}

function renderGroupCard(container, group, langName) {
  var card = document.createElement("div");
  card.className = "mode-card mode-card-group";

  var subCount = (group.subModes || []).length;
  var subListHTML = "";
  (group.subModes || []).forEach(function (sub) {
    subListHTML +=
      '<div class="sub-mode-card">' +
        '<div class="sub-mode-header">' +
          '<span class="sub-mode-name">\u2514\u2500 ' + LU.escapeHtml(sub.name) + '</span>' +
          '<div class="sub-mode-actions">' +
            '<button class="sub-edit-btn" data-group="' + group.id + '" data-sub="' + sub.id + '" title="' + LUI18n.msg("modal_edit_mode") + '">\u270F\uFE0F</button>' +
            '<button class="sub-delete-btn" data-group="' + group.id + '" data-sub="' + sub.id + '" title="' + LUI18n.msg("confirm_delete") + '">\uD83D\uDDD1\uFE0F</button>' +
          '</div>' +
        '</div>' +
        '<div class="sub-mode-prompt">' + LU.escapeHtml((sub.prompt || "").substring(0, 80)) + '...</div>' +
        (sub.model ? '<span class="mode-badge-model">' + LU.escapeHtml(sub.model) + '</span>' : '') +
      '</div>';
  });

  card.innerHTML =
    '<div class="mode-card-header">' +
      '<span class="mode-card-name">\uD83D\uDCC1 ' + LU.escapeHtml(group.name) + ' <span class="mode-count">(' + subCount + ' ' + LUI18n.msg("sub_modes_count") + ')</span></span>' +
      '<div class="mode-card-actions">' +
        '<button class="mode-fav-btn' + (group.favorite ? ' mode-fav-active' : '') + '" data-id="' + group.id + '" title="' + (group.favorite ? LUI18n.msg("confirm_delete") : LUI18n.msg("popup_favorites")) + '">' +
          (group.favorite ? '\u2B50' : '\u2606') +
        '</button>' +
        '<button class="add-sub-btn" data-group="' + group.id + '" title="' + LUI18n.msg("options_add_mode") + '">+ Sub</button>' +
        '<button class="mode-edit-btn" data-id="' + group.id + '" title="' + LUI18n.msg("modal_edit_mode") + '">\u270F\uFE0F</button>' +
        '<button class="mode-delete-btn" data-id="' + group.id + '" title="' + LUI18n.msg("confirm_delete") + '">\uD83D\uDDD1\uFE0F</button>' +
      '</div>' +
    '</div>' +
    (group.model ? '<span class="mode-badge-model">' + LUI18n.msg("options_model") + ': ' + LU.escapeHtml(group.model) + '</span>' : '') +
    '<div class="sub-modes-list">' + subListHTML + '</div>';

  container.appendChild(card);
}

function renderModeCard(container, mode, langName) {
  var isTranslated = !!mode._translatedTo;
  var isTranslating = !!translatingModes[mode.id];
  var promptPreview = (mode.prompt || "").length > 120 ? (mode.prompt || "").substring(0, 120) + "..." : (mode.prompt || "");

  var card = document.createElement("div");
  card.className = "mode-card" + (isTranslated ? " mode-card-translated" : "");

  card.innerHTML =
    '<div class="mode-card-header">' +
      '<span class="mode-card-name">' + LU.escapeHtml(mode.name) + '</span>' +
      '<div class="mode-card-actions">' +
        '<button class="mode-fav-btn' + (mode.favorite ? ' mode-fav-active' : '') + '" data-id="' + mode.id + '" title="' + (mode.favorite ? LUI18n.msg("confirm_delete") : LUI18n.msg("popup_favorites")) + '">' +
          (mode.favorite ? '\u2B50' : '\u2606') +
        '</button>' +
        '<button class="mode-translate-btn" data-id="' + mode.id + '" title="' + LUI18n.msg("options_tw_target_lang") + ': ' + langName + '">' +
          (isTranslating ? '...' : (isTranslated ? '\uD83D\uDD04' : '\uD83C\uDF0D')) +
        '</button>' +
        (isTranslated ? '<button class="mode-undo-btn" data-id="' + mode.id + '" title="' + LUI18n.msg("content_undo") + '">' + LUI18n.msg("content_undo") + '</button>' : '') +
        '<button class="mode-edit-btn" data-id="' + mode.id + '" title="' + LUI18n.msg("modal_edit_mode") + '">\u270F\uFE0F</button>' +
        '<button class="mode-delete-btn" data-id="' + mode.id + '" title="' + LUI18n.msg("confirm_delete") + '">\uD83D\uDDD1\uFE0F</button>' +
      '</div>' +
    '</div>' +
    '<div class="mode-card-prompt">' + LU.escapeHtml(promptPreview) + '</div>' +
    '<div class="mode-card-badges">' +
      (mode.isDefault ? '<span class="mode-badge">' + LUI18n.msg("options_reset_defaults") + '</span>' : '') +
      (mode.model ? '<span class="mode-badge-model">' + LU.escapeHtml(mode.model) + '</span>' : '') +
      (isTranslated ? '<span class="mode-badge-translated">' + LUI18n.langName(mode._translatedTo) + '</span>' : '') +
    '</div>';

  container.appendChild(card);
}

function attachEventListeners(container) {
  container.querySelectorAll(".mode-fav-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      await browser.runtime.sendMessage({ type: "toggle-favorite", id: btn.dataset.id });
      await loadModes();
    });
  });

  container.querySelectorAll(".mode-edit-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = currentModes.find(function (m) { return m.id === btn.dataset.id; });
      if (mode) openModal(mode, mode.type || "single");
    });
  });

  container.querySelectorAll(".mode-delete-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var mode = currentModes.find(function (m) { return m.id === btn.dataset.id; });
      if (!mode) return;
      if (mode.isDefault) { alert(LUI18n.msg("error_cannot_delete")); return; }
      if (confirm(LUI18n.msg("confirm_delete"))) {
        await browser.runtime.sendMessage({ type: "delete-mode", id: mode.id });
        await loadModes();
      }
    });
  });

  container.querySelectorAll(".mode-translate-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var mode = currentModes.find(function (m) { return m.id === btn.dataset.id; });
      if (!mode || translatingModes[mode.id]) return;
      await translateMode(mode);
    });
  });

  container.querySelectorAll(".mode-undo-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var mode = currentModes.find(function (m) { return m.id === btn.dataset.id; });
      if (!mode || !mode._originalName) return;
      await undoTranslateMode(mode);
    });
  });

  container.querySelectorAll(".add-sub-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openSubModal(btn.dataset.group, null);
    });
  });

  container.querySelectorAll(".sub-edit-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var group = currentModes.find(function (m) { return m.id === btn.dataset.group; });
      if (group && group.subModes) {
        var sub = group.subModes.find(function (s) { return s.id === btn.dataset.sub; });
        if (sub) openSubModal(btn.dataset.group, sub);
      }
    });
  });

  container.querySelectorAll(".sub-delete-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      if (confirm(LUI18n.msg("confirm_delete_sub"))) {
        await browser.runtime.sendMessage({
          type: "delete-sub-mode",
          groupId: btn.dataset.group,
          subId: btn.dataset.sub
        });
        await loadModes();
      }
    });
  });
}

// ---- Translate a mode ----
async function translateMode(mode) {
  var lang = currentSettings.language || "es";
  var langName = LUI18n.langName(lang);
  translatingModes[mode.id] = true;
  renderModesList();
  try {
    var resp = await browser.runtime.sendMessage({ type: "translate-mode", modeId: mode.id, targetLang: langName });
    if (resp.ok) currentModes = resp.modes;
    else alert("Error: " + (resp.error || "Unknown"));
  } catch (err) {
    alert("Error: " + err.message);
  }
  delete translatingModes[mode.id];
  renderModesList();
}

async function undoTranslateMode(mode) {
  var resp = await browser.runtime.sendMessage({ type: "undo-translate-mode", modeId: mode.id });
  if (resp.ok) { currentModes = resp.modes; renderModesList(); }
}

// ---- Modal: Mode ----
function openModal(mode, type) {
  var modal = document.getElementById("mode-modal");
  var isGroup = type === "group";
  document.getElementById("modal-title").textContent = mode
    ? LUI18n.msg(isGroup ? "modal_edit_group" : "modal_edit_mode")
    : LUI18n.msg(isGroup ? "modal_new_group" : "modal_new_mode");
  document.getElementById("mode-id").value = mode ? mode.id : "";
  document.getElementById("mode-type").value = type || "single";
  document.getElementById("mode-name").value = mode ? mode.name : "";
  document.getElementById("mode-model").value = (mode && mode.model) ? mode.model : "";

  var singleFields = document.getElementById("single-mode-fields");
  var groupFields = document.getElementById("group-mode-fields");
  var presetsGrid = document.querySelector(".presets-grid");
  var promptField = document.getElementById("mode-prompt");

  if (isGroup) {
    singleFields.style.display = "none";
    groupFields.style.display = "block";
    if (presetsGrid) presetsGrid.parentElement.style.display = "none";
    promptField.removeAttribute("required");
  } else {
    singleFields.style.display = "block";
    groupFields.style.display = "none";
    if (presetsGrid) presetsGrid.parentElement.style.display = "block";
    promptField.setAttribute("required", "");
    promptField.value = mode ? mode.prompt : "";
  }
  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("mode-modal").style.display = "none";
}

// ---- Modal: Sub-Mode ----
function openSubModal(groupId, sub) {
  var modal = document.getElementById("sub-modal");
  document.getElementById("sub-modal-title").textContent = sub ? LUI18n.msg("modal_edit_sub") : LUI18n.msg("modal_new_sub");
  document.getElementById("sub-group-id").value = groupId;
  document.getElementById("sub-id").value = sub ? sub.id : "";
  document.getElementById("sub-name").value = sub ? sub.name : "";
  document.getElementById("sub-prompt").value = sub ? sub.prompt : "";
  document.getElementById("sub-model").value = (sub && sub.model) ? sub.model : "";
  modal.style.display = "flex";
}

function closeSubModal() {
  document.getElementById("sub-modal").style.display = "none";
}

// ---- Translate Write Settings ----
async function loadTWSettings() {
  try {
    var resp = await browser.runtime.sendMessage({ type: "get-translate-write-settings" });
    if (resp && resp.settings) {
      document.getElementById("tw-target-lang").value = resp.settings.targetLang || "en";
      document.getElementById("tw-debounce").value = resp.settings.debounceMs || 1500;
    }
  } catch (e) {}
}

function setupTWSettingsForm() {
  var form = document.getElementById("tw-settings-form");
  var saveStatus = document.getElementById("tw-save-status");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var settings = {
      targetLang: document.getElementById("tw-target-lang").value,
      debounceMs: parseInt(document.getElementById("tw-debounce").value) || 1500
    };

    if (settings.debounceMs < 500) settings.debounceMs = 500;
    if (settings.debounceMs > 5000) settings.debounceMs = 5000;

    await browser.runtime.sendMessage({
      type: "save-translate-write-settings",
      settings: settings
    });
    saveStatus.textContent = LUI18n.msg("options_saved");
    saveStatus.style.color = "#4ade80";
    setTimeout(function () { saveStatus.textContent = ""; }, 3000);
  });
}

// ---- Language Switcher ----
function setupLanguageSwitcher() {
  var langSelect = document.getElementById("main-language");
  langSelect.addEventListener("change", async function () {
    var newLocale = langSelect.value;
    // Save uiLocale for extension UI language
    await browser.storage.local.set({ uiLocale: newLocale });
    // Also save to settings for translate-write and mode translation
    currentSettings.language = newLocale;
    await browser.runtime.sendMessage({ type: "save-settings", settings: currentSettings });
    // Reload the page to apply the new locale
    window.location.reload();
  });
}
