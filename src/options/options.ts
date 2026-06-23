// ============================================
// Lang Utils - Options page
// Settings + CRUD for modes + groups + sub-modes
// + theme customization UI.
// ============================================

import browser from "../lib/browser-compat";
import { i18n, msg, nativeLangName, langCodes } from "../lib/i18n";
import { escapeHtml } from "../lib/utils";
import {
  loadAndApplyTheme,
  PRESET_THEMES,
  saveAndApplyTheme,
  THEME_COLOR_KEYS,
  exportTheme,
  importTheme,
} from "../lib/themes";
import {
  $,
  $btn,
  $div,
  $form,
  $heading,
  $input,
  $select,
  $span,
  $textarea,
  getValue,
  setValue,
} from "../lib/dom";
import type {
  AnyMode,
  Mode,
  ModeGroup,
  Result,
  Settings,
  SubMode,
  ThemeId,
  ThemeSettings,
  TranslateWriteSettings,
} from "../types";
import { DEFAULT_SETTINGS } from "../types";

// ============================================
// UI tunables
// ============================================

/** Default LLM temperature when the user has no saved value (OpenAI's recommended default for chat). */
const DEFAULT_TEMPERATURE = 0.7;

/** Time (ms) the "Saved" status text stays visible before clearing. */
const SAVE_STATUS_CLEAR_MS = 3000;

/** Random-id suffix length for newly created modes/groups (avoids collisions; small enough to be human-readable). */
const RANDOM_ID_SUFFIX_LEN = 7;

/** Base for the random-id suffix (alphanumeric lowercase, 36 = 0-9a-z). */
const RANDOM_ID_BASE = 36;

/** Max characters of a sub-mode prompt shown in the modes list (rest is "..."). */
const SUB_MODE_PROMPT_PREVIEW_CHARS = 80;

/** Max characters of a mode prompt shown in the modes list (rest is "..."). */
const MODE_PROMPT_PREVIEW_CHARS = 120;

/** Defaults + clamps for translate-while-write debounce (ms). */
const TW_DEFAULT_DEBOUNCE_MS = 1500;
const TW_MIN_DEBOUNCE_MS = 500;
const TW_MAX_DEBOUNCE_MS = 5000;

let currentSettings: Settings = { ...DEFAULT_SETTINGS };
let currentModes: AnyMode[] = [];
const translatingModes: Record<string, boolean> = {};

document.addEventListener("DOMContentLoaded", () => {
  void optionsMain();
});

async function optionsMain(): Promise<void> {
  await loadAndApplyTheme();
  await i18n.init();
  i18n.translatePage();
  await loadSettings();
  await loadModes();
  await loadTWSettings();
  await loadThemeUI();
  setupSettingsForm();
  setupModeForm();
  setupSubModeForm();
  setupPresets();
  setupTWSettingsForm();
  setupLanguageSwitcher();
  setupThemeUI();
}

// ============================================================
//  LOAD SETTINGS
// ============================================================

async function loadSettings(): Promise<void> {
  const resp = (await browser.runtime.sendMessage({
    type: "get-settings",
  })) as { settings: Settings };
  currentSettings = resp.settings;
  setValue("api-url", currentSettings.apiUrl || "");
  setValue("api-key", currentSettings.apiKey || "");
  setValue("model", currentSettings.model || "");
  setValue("temperature", String(currentSettings.temperature ?? DEFAULT_TEMPERATURE));
  const popupCb = document.getElementById(
    "result-popup"
  ) as HTMLInputElement | null;
  if (popupCb) popupCb.checked = currentSettings.resultPopup !== false;

  const favSel = document.getElementById(
    "favorite-target-lang"
  ) as HTMLSelectElement | null;
  if (favSel) {
    favSel.innerHTML = "";
    for (const code of langCodes()) {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = nativeLangName(code);
      if (code === currentSettings.favoriteTargetLang) opt.selected = true;
      favSel.appendChild(opt);
    }
  }
  const autoCb = document.getElementById(
    "auto-set-favorite"
  ) as HTMLInputElement | null;
  if (autoCb) autoCb.checked = currentSettings.autoSetFavorite === true;

  const stored = await browser.storage.local.get(["uiLocale"]);
  const locale = (stored.uiLocale as string) || currentSettings.language || "es";
  setValue("main-language", locale);
}

async function loadModes(): Promise<void> {
  const resp = (await browser.runtime.sendMessage({
    type: "get-modes",
  })) as { modes: AnyMode[] };
  currentModes = resp.modes;
  renderModesList();
}

function readSettingsForm(): Settings {
  const popupCb = document.getElementById(
    "result-popup"
  ) as HTMLInputElement | null;
  const favSel = document.getElementById(
    "favorite-target-lang"
  ) as HTMLSelectElement | null;
  const autoCb = document.getElementById(
    "auto-set-favorite"
  ) as HTMLInputElement | null;
  return {
    apiUrl: getValue("api-url").trim(),
    apiKey: getValue("api-key").trim(),
    model: getValue("model").trim(),
    temperature: parseFloat(getValue("temperature")) || DEFAULT_TEMPERATURE,
    language: getValue("main-language"),
    resultPopup: popupCb ? popupCb.checked : true,
    favoriteTargetLang: favSel ? favSel.value : "es",
    autoSetFavorite: autoCb ? autoCb.checked : false,
  };
}

// ============================================================
//  SETTINGS FORM
// ============================================================

function setupSettingsForm(): void {
  const form = $form("settings-form");
  const testBtn = $btn("test-api-btn");
  const saveStatus = $span("save-status");

  form?.addEventListener("submit", async (e: SubmitEvent) => {
    e.preventDefault();
    currentSettings = readSettingsForm();
    await browser.runtime.sendMessage({
      type: "save-settings",
      settings: currentSettings,
    });
    if (saveStatus) {
      saveStatus.textContent = msg("options_saved");
      saveStatus.style.color = "var(--lu-success)";
      setTimeout(() => {
        if (saveStatus) saveStatus.textContent = "";
      }, SAVE_STATUS_CLEAR_MS);
    }
  });

  testBtn?.addEventListener("click", async () => {
    const statusEl = $span("api-test-status");
    if (!statusEl) return;
    statusEl.textContent = msg("options_testing");
    statusEl.style.color = "var(--lu-warning)";
    currentSettings = readSettingsForm();
    await browser.runtime.sendMessage({
      type: "save-settings",
      settings: currentSettings,
    });
    const result = (await browser.runtime.sendMessage({
      type: "test-api",
    })) as Result & { data?: string };
    if (result.ok) {
      statusEl.textContent = "OK: " + (result.data || "");
      statusEl.style.color = "var(--lu-success)";
    } else {
      statusEl.textContent = result.error;
      statusEl.style.color = "var(--lu-danger)";
    }
  });

  $btn("toggle-key")?.addEventListener("click", () => {
    const input = $input("api-key");
    const btn = $btn("toggle-key");
    if (!input || !btn) return;
    if (input.type === "password") {
      input.type = "text";
      btn.textContent = "\uD83D\uDE48";
    } else {
      input.type = "password";
      btn.textContent = "\uD83D\uDC41\uFE0F";
    }
  });
}

// ============================================================
//  MODES CRUD
// ============================================================

function setupModeForm(): void {
  $btn("add-mode-btn")?.addEventListener("click", () => openModal(null, "single"));
  $btn("add-group-btn")?.addEventListener("click", () => openModal(null, "group"));

  $btn("reset-modes-btn")?.addEventListener("click", async () => {
    if (confirm(msg("confirm_reset"))) {
      const resp = (await browser.runtime.sendMessage({
        type: "reset-modes",
      })) as { modes: AnyMode[] };
      currentModes = resp.modes;
      renderModesList();
    }
  });

  $btn("modal-cancel")?.addEventListener("click", closeModal);

  $form("mode-form")?.addEventListener("submit", async (e: SubmitEvent) => {
    e.preventDefault();
    const id = getValue("mode-id");
    const type = (getValue("mode-type") as "single" | "group") || "single";
    const name = getValue("mode-name").trim();
    if (!name) return;

    if (type === "group") {
      const model = getValue("mode-model").trim();
      if (id) {
        const existing = currentModes.find((m) => m.id === id);
        if (existing && existing.type === "group") {
          const updated: ModeGroup = { ...existing, name, model };
          await browser.runtime.sendMessage({ type: "update-mode", mode: updated });
        }
      } else {
        const newId =
          "group-" + Date.now() + "-" + Math.random().toString(RANDOM_ID_BASE).slice(2, 2 + RANDOM_ID_SUFFIX_LEN);
        const newGroup: ModeGroup = {
          id: newId,
          name,
          type: "group",
          model,
          favorite: false,
          subModes: [],
        };
        await browser.runtime.sendMessage({ type: "add-mode", mode: newGroup });
      }
    } else {
      const prompt = getValue("mode-prompt").trim();
      const model = getValue("mode-model").trim();
      if (!prompt) return;
      if (id) {
        const updated: Mode = {
          id,
          name,
          prompt,
          model,
          isDefault: false,
          type: "single",
          favorite: getModeFavorite(id),
        };
        await browser.runtime.sendMessage({ type: "update-mode", mode: updated });
      } else {
        const newId = "custom-" + Date.now() + "-" + Math.random().toString(RANDOM_ID_BASE).slice(2, 2 + RANDOM_ID_SUFFIX_LEN);
        const newMode: Mode = {
          id: newId,
          name,
          prompt,
          model,
          isDefault: false,
          type: "single",
          favorite: false,
        };
        await browser.runtime.sendMessage({ type: "add-mode", mode: newMode });
      }
    }
    await loadModes();
    closeModal();
  });
}

function setupSubModeForm(): void {
  $btn("sub-modal-cancel")?.addEventListener("click", closeSubModal);

  $form("sub-form")?.addEventListener("submit", async (e: SubmitEvent) => {
    e.preventDefault();
    const groupId = getValue("sub-group-id");
    const subId = getValue("sub-id");
    const name = getValue("sub-name").trim();
    const prompt = getValue("sub-prompt").trim();
    const model = getValue("sub-model").trim();
    if (!name || !prompt) return;

    if (subId) {
      const updated: SubMode = { id: subId, name, prompt, model };
      await browser.runtime.sendMessage({
        type: "update-sub-mode",
        groupId,
        subMode: updated,
      });
    } else {
      const newSubId = "sub-" + Date.now() + "-" + Math.random().toString(RANDOM_ID_BASE).slice(2, 2 + RANDOM_ID_SUFFIX_LEN);
      const newSub: SubMode = { id: newSubId, name, prompt, model };
      await browser.runtime.sendMessage({
        type: "add-sub-mode",
        groupId,
        subMode: newSub,
      });
    }
    await loadModes();
    closeSubModal();
  });
}

function getModeFavorite(id: string): boolean {
  const m = currentModes.find((x) => x.id === id);
  return m ? m.favorite : false;
}

function setupPresets(): void {
  document.querySelectorAll<HTMLButtonElement>(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const promptField = $textarea("mode-prompt");
      if (promptField) promptField.value = btn.dataset.prompt || "";
    });
  });
}

// ============================================================
//  RENDER MODES LIST
// ============================================================

function renderModesList(): void {
  const container = $div("modes-list");
  if (!container) return;
  container.innerHTML = "";

  if (currentModes.length === 0) {
    container.innerHTML =
      '<p style="color:var(--lu-text-muted);text-align:center;padding:20px;">' +
      msg("no_modes") +
      "</p>";
    return;
  }

  const lang = currentSettings.language || "es";
  const langNameStr = i18n.langName(lang);

  for (const mode of currentModes) {
    if (mode.type === "group") {
      renderGroupCard(container, mode);
    } else {
      renderModeCard(container, mode, langNameStr);
    }
  }

  attachEventListeners(container);
}

function renderGroupCard(container: HTMLElement, group: ModeGroup): void {
  const card = document.createElement("div");
  card.className = "mode-card mode-card-group";

  const subCount = (group.subModes || []).length;
  let subListHTML = "";
  for (const sub of group.subModes || []) {
    subListHTML +=
      '<div class="sub-mode-card">' +
      '<div class="sub-mode-header">' +
      '<span class="sub-mode-name">\u2514\u2500 ' +
      escapeHtml(sub.name) +
      "</span>" +
      '<div class="sub-mode-actions">' +
      '<button class="sub-edit-btn" data-group="' +
      group.id +
      '" data-sub="' +
      sub.id +
      '" title="' +
      msg("modal_edit_mode") +
      '">\u270F\uFE0F</button>' +
      '<button class="sub-delete-btn" data-group="' +
      group.id +
      '" data-sub="' +
      sub.id +
      '" title="' +
      msg("confirm_delete") +
      '">\uD83D\uDDD1\uFE0F</button>' +
      "</div>" +
      "</div>" +
      '<div class="sub-mode-prompt">' +
      escapeHtml((sub.prompt || "").substring(0, SUB_MODE_PROMPT_PREVIEW_CHARS)) +
      "...</div>" +
      (sub.model
        ? '<span class="mode-badge-model">' + escapeHtml(sub.model) + "</span>"
        : "") +
      "</div>";
  }

  card.innerHTML =
    '<div class="mode-card-header">' +
    '<span class="mode-card-name">\uD83D\uDCC1 ' +
    escapeHtml(group.name) +
    ' <span class="mode-count">(' +
    subCount +
    " " +
    msg("sub_modes_count") +
    ")</span></span>" +
    '<div class="mode-card-actions">' +
    '<button class="mode-fav-btn' +
    (group.favorite ? " mode-fav-active" : "") +
    '" data-id="' +
    group.id +
    '" title="' +
    (group.favorite ? msg("confirm_delete") : msg("popup_favorites")) +
    '">' +
    (group.favorite ? "\u2B50" : "\u2606") +
    "</button>" +
    '<button class="add-sub-btn" data-group="' +
    group.id +
    '" title="' +
    msg("options_add_mode") +
    '">+ Sub</button>' +
    '<button class="mode-edit-btn" data-id="' +
    group.id +
    '" title="' +
    msg("modal_edit_mode") +
    '">\u270F\uFE0F</button>' +
    '<button class="mode-delete-btn" data-id="' +
    group.id +
    '" title="' +
    msg("confirm_delete") +
    '">\uD83D\uDDD1\uFE0F</button>' +
    "</div>" +
    "</div>" +
    (group.model
      ? '<span class="mode-badge-model">' +
        msg("options_model") +
        ": " +
        escapeHtml(group.model) +
        "</span>"
      : "") +
    '<div class="sub-modes-list">' +
    subListHTML +
    "</div>";

  container.appendChild(card);
}

function renderModeCard(
  container: HTMLElement,
  mode: Mode,
  langNameStr: string
): void {
  const isTranslated = !!mode._translatedTo;
  const isTranslating = !!translatingModes[mode.id];
  const promptPreview =
    (mode.prompt || "").length > MODE_PROMPT_PREVIEW_CHARS
      ? (mode.prompt || "").substring(0, MODE_PROMPT_PREVIEW_CHARS) + "..."
      : mode.prompt || "";

  const card = document.createElement("div");
  card.className = "mode-card" + (isTranslated ? " mode-card-translated" : "");

  card.innerHTML =
    '<div class="mode-card-header">' +
    '<span class="mode-card-name">' +
    escapeHtml(mode.name) +
    "</span>" +
    '<div class="mode-card-actions">' +
    '<button class="mode-fav-btn' +
    (mode.favorite ? " mode-fav-active" : "") +
    '" data-id="' +
    mode.id +
    '" title="' +
    (mode.favorite ? msg("confirm_delete") : msg("popup_favorites")) +
    '">' +
    (mode.favorite ? "\u2B50" : "\u2606") +
    "</button>" +
    '<button class="mode-translate-btn" data-id="' +
    mode.id +
    '" title="' +
    msg("options_tw_target_lang") +
    ": " +
    langNameStr +
    '">' +
    (isTranslating ? "..." : isTranslated ? "\uD83D\uDD04" : "\uD83C\uDF0D") +
    "</button>" +
    (isTranslated
      ? '<button class="mode-undo-btn" data-id="' +
        mode.id +
        '" title="' +
        msg("content_undo") +
        '">' +
        msg("content_undo") +
        "</button>"
      : "") +
    '<button class="mode-edit-btn" data-id="' +
    mode.id +
    '" title="' +
    msg("modal_edit_mode") +
    '">\u270F\uFE0F</button>' +
    (mode.protected
      ? ""
      : '<button class="mode-delete-btn" data-id="' +
        mode.id +
        '" title="' +
        msg("confirm_delete") +
        '">\uD83D\uDDD1\uFE0F</button>') +
    "</div>" +
    "</div>" +
    '<div class="mode-card-prompt">' +
    escapeHtml(promptPreview) +
    "</div>" +
    '<div class="mode-card-badges">' +
    (mode.isDefault
      ? '<span class="mode-badge">' + msg("options_reset_defaults") + "</span>"
      : "") +
    (mode.model
      ? '<span class="mode-badge-model">' + escapeHtml(mode.model) + "</span>"
      : "") +
    (isTranslated
      ? '<span class="mode-badge-translated">' +
        i18n.langName(mode._translatedTo || "") +
        "</span>"
      : "") +
    "</div>";

  container.appendChild(card);
}

function attachEventListeners(container: HTMLElement): void {
  container
    .querySelectorAll<HTMLButtonElement>(".mode-fav-btn")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!btn.dataset.id) return;
        await browser.runtime.sendMessage({ type: "toggle-favorite", id: btn.dataset.id });
        await loadModes();
      });
    });

  container
    .querySelectorAll<HTMLButtonElement>(".mode-edit-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!btn.dataset.id) return;
        const mode = currentModes.find((m) => m.id === btn.dataset.id);
        if (mode) openModal(mode, mode.type || "single");
      });
    });

  container
    .querySelectorAll<HTMLButtonElement>(".mode-delete-btn")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!btn.dataset.id) return;
        const mode = currentModes.find((m) => m.id === btn.dataset.id);
        if (!mode) return;
        if (mode.type === "single" && mode.isDefault) {
          alert(msg("error_cannot_delete"));
          return;
        }
        if (mode.type === "single" && mode.protected) {
          return;
        }
        if (confirm(msg("confirm_delete"))) {
          await browser.runtime.sendMessage({ type: "delete-mode", id: mode.id });
          await loadModes();
        }
      });
    });

  container
    .querySelectorAll<HTMLButtonElement>(".mode-translate-btn")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!btn.dataset.id) return;
        const mode = currentModes.find((m) => m.id === btn.dataset.id);
        if (!mode || translatingModes[mode.id]) return;
        await translateMode(mode);
      });
    });

  container
    .querySelectorAll<HTMLButtonElement>(".mode-undo-btn")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!btn.dataset.id) return;
        const mode = currentModes.find((m) => m.id === btn.dataset.id);
        if (!mode || mode.type !== "single" || !mode._originalName) return;
        await undoTranslateMode(mode);
      });
    });

  container
    .querySelectorAll<HTMLButtonElement>(".add-sub-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!btn.dataset.group) return;
        openSubModal(btn.dataset.group, null);
      });
    });

  container
    .querySelectorAll<HTMLButtonElement>(".sub-edit-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!btn.dataset.group || !btn.dataset.sub) return;
        const group = currentModes.find((m) => m.id === btn.dataset.group);
        if (group && group.type === "group" && group.subModes) {
          const sub = group.subModes.find((s) => s.id === btn.dataset.sub);
          if (sub) openSubModal(btn.dataset.group!, sub);
        }
      });
    });

  container
    .querySelectorAll<HTMLButtonElement>(".sub-delete-btn")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!btn.dataset.group || !btn.dataset.sub) return;
        if (confirm(msg("confirm_delete_sub"))) {
          await browser.runtime.sendMessage({
            type: "delete-sub-mode",
            groupId: btn.dataset.group,
            subId: btn.dataset.sub,
          });
          await loadModes();
        }
      });
    });
}

// ============================================================
//  TRANSLATE A MODE
// ============================================================

async function translateMode(mode: AnyMode): Promise<void> {
  const lang = currentSettings.language || "es";
  const langNameStr = i18n.langName(lang);
  translatingModes[mode.id] = true;
  renderModesList();
  try {
    const resp = (await browser.runtime.sendMessage({
      type: "translate-mode",
      modeId: mode.id,
      targetLang: langNameStr,
    })) as Result & { modes?: AnyMode[]; error?: string };
    if (resp.ok && resp.modes) {
      currentModes = resp.modes;
    } else {
      alert("Error: " + (resp.error || "Unknown"));
    }
  } catch (err) {
    alert("Error: " + (err as Error).message);
  }
  delete translatingModes[mode.id];
  renderModesList();
}

async function undoTranslateMode(mode: AnyMode): Promise<void> {
  const resp = (await browser.runtime.sendMessage({
    type: "undo-translate-mode",
    modeId: mode.id,
  })) as Result & { modes?: AnyMode[] };
  if (resp.ok && resp.modes) {
    currentModes = resp.modes;
    renderModesList();
  }
}

// ============================================================
//  MODALS
// ============================================================

function openModal(mode: AnyMode | null, type: "single" | "group"): void {
  const modal = $div("mode-modal");
  if (!modal) return;
  const isGroup = type === "group";

  const titleEl = $heading("modal-title");
  if (titleEl) {
    titleEl.textContent = mode
      ? msg(isGroup ? "modal_edit_group" : "modal_edit_mode")
      : msg(isGroup ? "modal_new_group" : "modal_new_mode");
  }
  setValue("mode-id", mode ? mode.id : "");
  setValue("mode-type", type);
  setValue("mode-name", mode ? mode.name : "");
  setValue("mode-model", mode && mode.model ? mode.model : "");

  const singleFields = $div("single-mode-fields");
  const groupFields = $div("group-mode-fields");
  const presetsGrid = document.querySelector<HTMLDivElement>(".presets-grid");
  const promptField = $textarea("mode-prompt");

  if (isGroup) {
    if (singleFields) singleFields.style.display = "none";
    if (groupFields) groupFields.style.display = "block";
    if (presetsGrid?.parentElement) presetsGrid.parentElement.style.display = "none";
    promptField?.removeAttribute("required");
  } else {
    if (singleFields) singleFields.style.display = "block";
    if (groupFields) groupFields.style.display = "none";
    if (presetsGrid?.parentElement) presetsGrid.parentElement.style.display = "block";
    promptField?.setAttribute("required", "");
    if (promptField && mode && mode.type === "single") {
      promptField.value = mode.prompt;
    } else if (promptField) {
      promptField.value = "";
    }
  }
  modal.style.display = "flex";
}

function closeModal(): void {
  const modal = $div("mode-modal");
  if (modal) modal.style.display = "none";
}

function openSubModal(groupId: string, sub: SubMode | null): void {
  const modal = $div("sub-modal");
  if (!modal) return;
  const titleEl = $heading("sub-modal-title");
  if (titleEl) {
    titleEl.textContent = sub ? msg("modal_edit_sub") : msg("modal_new_sub");
  }
  setValue("sub-group-id", groupId);
  setValue("sub-id", sub ? sub.id : "");
  setValue("sub-name", sub ? sub.name : "");
  setValue("sub-prompt", sub ? sub.prompt : "");
  setValue("sub-model", sub && sub.model ? sub.model : "");
  modal.style.display = "flex";
}

function closeSubModal(): void {
  const modal = $div("sub-modal");
  if (modal) modal.style.display = "none";
}

// ============================================================
//  TRANSLATE-WRITE SETTINGS
// ============================================================

async function loadTWSettings(): Promise<void> {
  try {
    const resp = (await browser.runtime.sendMessage({
      type: "get-translate-write-settings",
    })) as { settings?: TranslateWriteSettings };
    if (resp && resp.settings) {
      setValue("tw-target-lang", resp.settings.targetLang || "en");
      setValue("tw-debounce", String(resp.settings.debounceMs || TW_DEFAULT_DEBOUNCE_MS));
    }
  } catch {
    // ignore
  }
}

function setupTWSettingsForm(): void {
  const form = $form("tw-settings-form");
  const saveStatus = $span("tw-save-status");

  form?.addEventListener("submit", async (e: SubmitEvent) => {
    e.preventDefault();
    const settings: TranslateWriteSettings = {
      targetLang: getValue("tw-target-lang"),
      debounceMs: parseInt(getValue("tw-debounce")) || TW_DEFAULT_DEBOUNCE_MS,
    };
    settings.debounceMs = Math.max(
      TW_MIN_DEBOUNCE_MS,
      Math.min(TW_MAX_DEBOUNCE_MS, settings.debounceMs)
    );

    await browser.runtime.sendMessage({
      type: "save-translate-write-settings",
      settings,
    });
    if (saveStatus) {
      saveStatus.textContent = msg("options_saved");
      saveStatus.style.color = "var(--lu-success)";
      setTimeout(() => {
        if (saveStatus) saveStatus.textContent = "";
      }, SAVE_STATUS_CLEAR_MS);
    }
  });
}

// ============================================================
//  LANGUAGE SWITCHER
// ============================================================

function setupLanguageSwitcher(): void {
  const langSelect = $select("main-language");
  langSelect?.addEventListener("change", async () => {
    if (!langSelect) return;
    const newLocale = langSelect.value;
    await browser.storage.local.set({ uiLocale: newLocale });
    currentSettings.language = newLocale;
    await browser.runtime.sendMessage({
      type: "save-settings",
      settings: currentSettings,
    });
    window.location.reload();
  });
}

// ============================================================
//  THEME UI
// ============================================================

let currentThemeSettings: ThemeSettings | null = null;

async function loadThemeUI(): Promise<void> {
  currentThemeSettings = await loadAndApplyTheme();
  const select = $select("theme-select");
  if (select) {
    select.value = currentThemeSettings.current;
  }
  if (currentThemeSettings.current === "custom") {
    populateCustomColorInputs(currentThemeSettings.custom);
  }
  updateCustomSectionVisibility();
}

function setupThemeUI(): void {
  const select = $select("theme-select");
  select?.addEventListener("change", async () => {
    if (!currentThemeSettings || !select) return;
    currentThemeSettings.current = select.value as ThemeId;
    await saveAndApplyTheme(currentThemeSettings);
    updateCustomSectionVisibility();
    if (currentThemeSettings.current === "custom") {
      populateCustomColorInputs(currentThemeSettings.custom);
    }
  });

  for (const key of THEME_COLOR_KEYS) {
    const input = $input("theme-color-" + key);
    if (!input) continue;
    input.addEventListener("change", async () => {
      if (!currentThemeSettings) return;
      if (currentThemeSettings.current !== "custom") {
        currentThemeSettings.current = "custom";
        if (select) select.value = "custom";
        updateCustomSectionVisibility();
      }
      currentThemeSettings.custom[key] = input.value;
      await saveAndApplyTheme(currentThemeSettings);
    });
  }

  $btn("theme-export-btn")?.addEventListener("click", () => {
    if (!currentThemeSettings) return;
    const theme =
      currentThemeSettings.current === "custom"
        ? currentThemeSettings.custom
        : PRESET_THEMES[currentThemeSettings.current as Exclude<ThemeId, "custom">];
    const json = exportTheme(theme);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lang-utils-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  $btn("theme-import-btn")?.addEventListener("click", () => {
    $input("theme-import-file")?.click();
  });

  $input("theme-import-file")?.addEventListener("change", async (e: Event) => {
    if (!currentThemeSettings) return;
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = importTheme(text);
    if (!imported) {
      alert("Invalid theme file");
      return;
    }
    currentThemeSettings.current = "custom";
    currentThemeSettings.custom = imported;
    await saveAndApplyTheme(currentThemeSettings);
    if (select) select.value = "custom";
    populateCustomColorInputs(imported);
    updateCustomSectionVisibility();
  });
}

function updateCustomSectionVisibility(): void {
  const section = $div("theme-custom-section");
  if (!section || !currentThemeSettings) return;
  section.style.display = currentThemeSettings.current === "custom" ? "block" : "none";
}

function populateCustomColorInputs(theme: ThemeSettings["custom"]): void {
  for (const key of THEME_COLOR_KEYS) {
    const input = $input("theme-color-" + key);
    if (input) input.value = theme[key];
  }
}

// Suppress unused import warning
void $;
