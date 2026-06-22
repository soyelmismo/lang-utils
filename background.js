/* ============================================
   Lang Utils - Background Script
   Features: multi-model, auto-detect, favorites,
   toolbar, form injection, mode groups
   ============================================ */

// ---- Default Modes ----
var DEFAULT_MODES = [
  {
    id: "redact",
    name: "Redactar",
    type: "group",
    favorite: true,
    model: "",
    subModes: [
      {
        id: "redact-informal",
        name: "Informal",
        prompt: "Reescribe el siguiente texto en un estilo informal y cercano, como si se lo contaras a un amigo:\n\n{{selection}}",
        model: ""
      },
      {
        id: "redact-formal",
        name: "Formal",
        prompt: "Reescribe el siguiente texto en un estilo formal, profesional y respetuoso, adecuado para documentos oficiales o comunicacion empresarial:\n\n{{selection}}",
        model: ""
      },
      {
        id: "redact-street",
        name: "Street / Calle",
        prompt: "Reescribe el siguiente texto con un estilo callejero, urbano y desenfadado, usando jerga moderna y expresiones coloquiales:\n\n{{selection}}",
        model: ""
      },
      {
        id: "redact-academic",
        name: "Academico",
        prompt: "Reescribe el siguiente texto en estilo academico formal, con vocabulario preciso, estructura clara y tono objetivo:\n\n{{selection}}",
        model: ""
      },
      {
        id: "redact-creative",
        name: "Creativo / Literario",
        prompt: "Reescribe el siguiente texto con un estilo creativo y literario, usando metaforas, lenguaje figurado y un tono expresivo:\n\n{{selection}}",
        model: ""
      },
      {
        id: "redact-concise",
        name: "Conciso / Directo",
        prompt: "Reescribe el siguiente texto de forma extremadamente concisa y directa, eliminando todo lo redundante sin perder el significado esencial:\n\n{{selection}}",
        model: ""
      },
      {
        id: "redact-persuasive",
        name: "Persuasivo",
        prompt: "Reescribe el siguiente texto con un tono persuasivo y convincente, usando argumentos fuertes y lenguaje impactante:\n\n{{selection}}",
        model: ""
      }
    ]
  },
  {
    id: "translate-es",
    name: "Traducir al espanol",
    prompt: "Traduce el siguiente texto al espanol. Responde SOLO con la traduccion:\n\n{{selection}}",
    isDefault: true, favorite: true, model: "", type: "single"
  },
  {
    id: "translate-en",
    name: "Translate to English",
    prompt: "Translate the following text to English. Reply ONLY with the translation:\n\n{{selection}}",
    isDefault: true, favorite: true, model: "", type: "single"
  },
  {
    id: "summarize",
    name: "Resumir texto",
    prompt: "Resume el siguiente texto de forma clara y concisa:\n\n{{selection}}",
    isDefault: true, favorite: false, model: "", type: "single"
  },
  {
    id: "explain-simple",
    name: "Explicar en terminos simples",
    prompt: "Explica este texto de forma simple, como a alguien sin conocimiento previo:\n\n{{selection}}",
    isDefault: true, favorite: false, model: "", type: "single"
  },
  {
    id: "explain-style",
    name: "Explicar a mi manera",
    prompt: "Reescribe este texto en estilo casual y directo, como si lo explicaras a un amigo:\n\n{{selection}}",
    isDefault: true, favorite: false, model: "", type: "single"
  },
  {
    id: "ask-ai",
    name: "Preguntar sobre el texto...",
    prompt: "__CHATBOT__",
    isDefault: true, favorite: false, model: "", type: "single"
  }
];

// ---- Translation target languages ----
var LANG_MAP = {
  es: "espanol", en: "english", pt: "portugues", fr: "francais",
  de: "deutsch", it: "italiano", zh: "chino", ja: "japones",
  ko: "coreano", ar: "arabe", hi: "hindi", ru: "ruso",
  nl: "holandes", pl: "polaco", tr: "turco"
};

// ---- State ----
var currentModes = [];
var settings = {
  apiUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.7,
  language: "es"
};
var popupWindowId = null;

function log() {
  var args = ["[Lang Utils]"];
  for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
  console.log.apply(console, args);
}

// ---- Init ----
async function init() {
  log("Starting init...");
  var stored = await browser.storage.local.get(["modes", "settings"]);
  if (!stored.modes || stored.modes.length === 0) {
    currentModes = DEFAULT_MODES.map(function (m) { return JSON.parse(JSON.stringify(m)); });
    await browser.storage.local.set({ modes: currentModes });
    log("Created default modes:", currentModes.length);
  } else {
    currentModes = stored.modes;
    // Ensure all modes have required fields
    var changed = false;
    currentModes.forEach(function (m) {
      if (m.favorite === undefined) { m.favorite = false; changed = true; }
      if (m.model === undefined) { m.model = ""; changed = true; }
      if (m.type === undefined) { m.type = "single"; changed = true; }
      if (m.type === "group" && !m.subModes) { m.subModes = []; changed = true; }
    });
    if (changed) await browser.storage.local.set({ modes: currentModes });
    log("Loaded stored modes:", currentModes.length);
  }
  if (stored.settings) {
    settings = Object.assign({}, settings, stored.settings);
  }
  await browser.storage.local.set({ settings: settings });
  buildContextMenus();
  log("Init complete. API key present:", !!settings.apiKey);
}

// ---- Context Menus ----
function buildContextMenus() {
  browser.contextMenus.removeAll().then(function () {
    browser.contextMenus.create({
      id: "lang-utils-root",
      title: "Lang Utils",
      contexts: ["selection"]
    });
    browser.contextMenus.create({
      id: "lang-utils-chatbot",
      title: LUI18n.msg("bg_chatbot_menu"),
      parentId: "lang-utils-root",
      contexts: ["selection"]
    });
    browser.contextMenus.create({
      id: "lang-utils-sep1",
      type: "separator",
      parentId: "lang-utils-root",
      contexts: ["selection"]
    });

    for (var i = 0; i < currentModes.length; i++) {
      var mode = currentModes[i];

      if (mode.type === "group" && mode.subModes && mode.subModes.length > 0) {
        // Create parent menu for group
        browser.contextMenus.create({
          id: "group-" + mode.id,
          title: mode.name + (mode.favorite ? " \u2B50" : ""),
          parentId: "lang-utils-root",
          contexts: ["selection"]
        });
        // Create sub-items
        for (var j = 0; j < mode.subModes.length; j++) {
          var sub = mode.subModes[j];
          browser.contextMenus.create({
            id: "sub-" + mode.id + ":" + sub.id,
            title: sub.name,
            parentId: "group-" + mode.id,
            contexts: ["selection"]
          });
        }
      } else if (mode.prompt === "__CHATBOT__") {
        continue; // Skip chatbot, already added
      } else {
        browser.contextMenus.create({
          id: "mode-" + mode.id,
          title: mode.name + (mode.favorite ? " \u2B50" : ""),
          parentId: "lang-utils-root",
          contexts: ["selection"]
        });
      }
    }
    log("Context menus built");
  });
}

// ---- Get active tab ----
async function getTab(tab) {
  if (tab && tab.id) return tab;
  var tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

// ---- Inject content scripts ----
async function ensureContentScript(tabId) {
  try {
    var response = await browser.tabs.sendMessage(tabId, { type: "ping" });
    if (response && response.pong) return true;
  } catch (e) {}
  try {
    await browser.tabs.executeScript(tabId, { file: "utils.js", allFrames: false });
    await browser.tabs.executeScript(tabId, { file: "content.js", allFrames: false });
    log("Injected content scripts into tab", tabId);
    return true;
  } catch (e) {
    log("Cannot inject into tab", tabId, e.message);
    return false;
  }
}

// ---- Send message to tab safely ----
async function sendToTab(tabId, message) {
  try {
    await browser.tabs.sendMessage(tabId, message);
    return true;
  } catch (e) {
    log("sendMessage failed, trying injection...", e.message);
    var ok = await ensureContentScript(tabId);
    if (!ok) return false;
    try {
      await browser.tabs.sendMessage(tabId, message);
      return true;
    } catch (e2) {
      log("sendMessage still failed after injection:", e2.message);
      return false;
    }
  }
}

// ---- Find mode or sub-mode by ID ----
function findModeById(modeId) {
  for (var i = 0; i < currentModes.length; i++) {
    var m = currentModes[i];
    if (m.id === modeId) return { mode: m, subMode: null };
    if (m.type === "group" && m.subModes) {
      for (var j = 0; j < m.subModes.length; j++) {
        if (m.subModes[j].id === modeId) return { mode: m, subMode: m.subModes[j] };
      }
    }
  }
  return null;
}

// ---- Get effective prompt for a mode/sub-mode ----
function getEffectivePrompt(modeOrSub, selectionText) {
  var prompt = modeOrSub.prompt || "";
  return prompt.replace(/\{\{selection\}\}/g, selectionText);
}

// ---- Get effective model for a sub-mode (inherits from parent group) ----
function getEffectiveModel(subMode, parentMode) {
  if (subMode && subMode.model && subMode.model.trim()) return subMode.model;
  if (parentMode && parentMode.model && parentMode.model.trim()) return parentMode.model;
  return "";
}

// ---- Context Menu Click Handler ----
browser.contextMenus.onClicked.addListener(function (info, tab) {
  log("Context menu clicked:", info.menuItemId);

  (async function () {
    var resolvedTab = await getTab(tab);
    if (!resolvedTab) {
      log("ERROR: No tab available");
      return;
    }

    // Chatbot
    if (info.menuItemId === "lang-utils-chatbot") {
      openChatbot(info.selectionText, resolvedTab);
      return;
    }

    var menuItemId = info.menuItemId;
    var selectionText = info.selectionText;
    var mode, subMode, prompt, model, displayName;

    if (menuItemId.startsWith("sub-")) {
      // Sub-mode click: "sub-{groupId}:{subModeId}"
      var ids = menuItemId.replace("sub-", "").split(":");
      var groupId = ids[0];
      var subModeId = ids[1];
      var found = findModeById(subModeId);
      if (!found) { log("ERROR: Sub-mode not found:", subModeId); return; }
      mode = found.mode;
      subMode = found.subMode;
      prompt = getEffectivePrompt(subMode, selectionText);
      model = getEffectiveModel(subMode, mode);
      displayName = mode.name + " > " + subMode.name;
      log("Processing sub-mode:", displayName, "model:", model || "(default)");
      await processWithAI(prompt, resolvedTab, displayName, { model: model, name: displayName });
    } else if (menuItemId.startsWith("mode-")) {
      // Regular mode click
      var modeId = menuItemId.replace("mode-", "");
      var found2 = findModeById(modeId);
      if (!found2) { log("ERROR: Mode not found:", modeId); return; }
      mode = found2.mode;
      prompt = getEffectivePrompt(mode, selectionText);
      model = getEffectiveModel(null, mode);
      displayName = mode.name;
      log("Processing mode:", displayName);
      await processWithAI(prompt, resolvedTab, displayName, { model: model, name: displayName });
    }
  })().catch(function (err) {
    log("CLICK HANDLER ERROR:", err.message, err.stack);
  });
});

// ---- Detect language of text ----
async function detectLanguage(text) {
  if (!settings.apiKey) return null;
  try {
    var prompt = "What language is this text written in? Reply with ONLY the 2-letter ISO 639-1 code (e.g., es, en, fr, de, pt, it, zh, ja, ko, ar, hi, ru, nl, pl, tr). Nothing else.\n\n" + text.substring(0, 500);
    var result = await doAPIFetch(buildBody([{ role: "user", content: prompt }], ""));
    var code = (result || "").trim().toLowerCase().replace(/[^a-z]/g, "").substring(0, 2);
    return code || null;
  } catch (e) {
    log("Language detection failed:", e.message);
    return null;
  }
}

// ---- Check if a mode is a translation mode ----
function isTranslationMode(mode) {
  var p = ((mode.prompt || "") + " " + (mode.name || "")).toLowerCase();
  return p.indexOf("traduc") !== -1 || p.indexOf("translat") !== -1;
}

// ---- Extract target language from a translation mode ----
function getTargetLangFromMode(mode) {
  var name = (mode.name || "").toLowerCase();
  for (var code in LANG_MAP) {
    if (name.indexOf(LANG_MAP[code]) !== -1) return code;
  }
  if (name.indexOf("english") !== -1) return "en";
  if (name.indexOf("french") !== -1 || name.indexOf("francais") !== -1) return "fr";
  if (name.indexOf("german") !== -1 || name.indexOf("deutsch") !== -1) return "de";
  if (name.indexOf("italian") !== -1 || name.indexOf("italiano") !== -1) return "it";
  if (name.indexOf("portuguese") !== -1 || name.indexOf("portugues") !== -1) return "pt";
  if (name.indexOf("chinese") !== -1 || name.indexOf("chino") !== -1) return "zh";
  if (name.indexOf("japanese") !== -1 || name.indexOf("japones") !== -1) return "ja";
  if (name.indexOf("korean") !== -1 || name.indexOf("coreano") !== -1) return "ko";
  return null;
}

// ---- Process with AI ----
async function processWithAI(prompt, tab, modeName, modeOpts) {
  log("processWithAI:", modeName, "tab:", tab.id);
  modeOpts = modeOpts || {};

  // Auto-detect for translation modes
  if (modeOpts && isTranslationMode(modeOpts)) {
    var parts = prompt.split("\n\n");
    var actualText = parts[parts.length - 1] || "";
    if (actualText.length > 10) {
      var detected = await detectLanguage(actualText);
      var targetCode = getTargetLangFromMode(modeOpts);
      if (detected && targetCode && detected === targetCode) {
        var langName = LANG_MAP[detected] || detected;
        var sent = await sendToTab(tab.id, {
          type: "show-confirm",
          title: modeName,
          content: LUI18n.msg("bg_same_lang_confirm") + langName + LUI18n.msg("bg_same_lang_confirm_suffix"),
          originalPrompt: prompt,
          modeName: modeName,
          model: modeOpts.model || ""
        });
        if (!sent) log("Could not send confirm to tab");
        return;
      }
    }
  }

  var sent = await sendToTab(tab.id, { type: "show-loading", title: modeName });
  if (!sent) { log("ERROR: Could not send to tab, aborting"); return; }

  if (!settings.apiKey) {
    sendToTab(tab.id, { type: "show-error", title: LUI18n.msg("content_error"), content: LUI18n.msg("bg_api_not_configured") });
    return;
  }

  try {
    var result = await callAPI(prompt, modeOpts.model || "");
    sendToTab(tab.id, { type: "show-result", title: modeName, content: result });
  } catch (err) {
    log("API error:", err.message);
    sendToTab(tab.id, { type: "show-error", title: LUI18n.msg("content_error"), content: err.message });
  }
}

// ---- Build request body ----
function buildBody(messages, modelOverride) {
  var body = {
    model: (modelOverride && modelOverride.trim()) || settings.model,
    messages: messages,
    stream: false
  };
  if (settings.temperature !== undefined && settings.temperature !== null) {
    body.temperature = Number(settings.temperature);
  }
  return body;
}

// ---- Parse SSE or plain JSON ----
function parseResponseText(text) {
  if (!text || text.trim().length === 0) {
    throw new Error("API returned an empty response");
  }
  try {
    var data = JSON.parse(text);
    if (data.error) {
      var msg = data.error.message || data.error.msg || JSON.stringify(data.error);
      throw new Error("API error: " + msg);
    }
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content || "";
    }
    throw new Error("Unexpected JSON: " + (text || "").substring(0, 200));
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
  }
  var lines = text.split("\n");
  var result = "";
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (!trimmed || trimmed === "data: [DONE]") continue;
    if (trimmed.indexOf("data: ") === 0) {
      try {
        var chunk = JSON.parse(trimmed.slice(6));
        if (chunk.choices && chunk.choices[0]) {
          var c = chunk.choices[0];
          if (c.delta && c.delta.content) result += c.delta.content;
          if (c.message && c.message.content) result += c.message.content;
        }
      } catch (_) {}
    }
  }
  if (result.length > 0) return result;
  throw new Error("Could not parse API response: " + (text || "").substring(0, 300));
}

// ---- Centralized fetch ----
async function doAPIFetch(body) {
  var endpoint = settings.apiUrl.replace(/\/+$/, "") + "/chat/completions";
  log("Fetching:", endpoint, "model:", body.model);
  var response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.apiKey
    },
    body: JSON.stringify(body)
  });
  log("Fetch status:", response.status);
  if (!response.ok) {
    var errText = "";
    try { errText = await response.text(); } catch (_) {}
    throw new Error("API Error " + response.status + ": " + (errText || "no details"));
  }
  var respText = await response.text();
  return parseResponseText(respText);
}

// ---- Single-turn ----
async function callAPI(prompt, modelOverride) {
  return doAPIFetch(buildBody([
    { role: "system", content: LUI18n.msg("bg_system_prompt") },
    { role: "user", content: prompt }
  ], modelOverride));
}

// ---- Multi-turn ----
async function callChatAPI(messages) {
  return doAPIFetch(buildBody(messages, ""));
}

// ---- Test connection ----
async function testAPIConnection() {
  if (!settings.apiKey) return { ok: false, error: LUI18n.msg("bg_api_not_configured") };
  try {
    var text = await doAPIFetch(buildBody([
      { role: "user", content: LUI18n.msg("bg_test_prompt") }
    ], ""));
    return { ok: true, data: (text || "").substring(0, 60) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---- Open popup as persistent window ----
function openPopupWindow() {
  if (popupWindowId !== null) {
    browser.windows.get(popupWindowId).then(function () {
      browser.windows.update(popupWindowId, { focused: true });
    }).catch(function () {
      popupWindowId = null;
      openPopupWindow();
    });
    return;
  }
  browser.windows.create({
    url: "popup/popup.html",
    type: "popup",
    width: 380,
    height: 520
  }).then(function (win) {
    popupWindowId = win.id;
    browser.windows.onRemoved.addListener(function onRemoved(winId) {
      if (winId === popupWindowId) {
        popupWindowId = null;
        browser.windows.onRemoved.removeListener(onRemoved);
      }
    });
  });
}

browser.browserAction.onClicked.addListener(function () {
  openPopupWindow();
});

// ---- Chatbot ----
function openChatbot(selectionText, tab) {
  browser.windows.create({
    url: "chatbot/chatbot.html?text=" + encodeURIComponent(selectionText) + "&tabId=" + tab.id,
    type: "popup",
    width: 500,
    height: 650
  });
}

// ---- Process mode from tab (toolbar / form injection) ----
async function processModeFromTab(modeId, subModeId, text) {
  if (!settings.apiKey) return { ok: false, error: LUI18n.msg("bg_api_not_configured") };

  var found = findModeById(subModeId || modeId);
  if (!found) return { ok: false, error: "Mode not found" };

  var effectiveMode = found.subMode || found.mode;
  var model = getEffectiveModel(found.subMode, found.mode);
  var prompt = getEffectivePrompt(effectiveMode, text);

  try {
    var result = await callAPI(prompt, model);
    return { ok: true, content: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---- Message Router ----
browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  switch (message.type) {
    case "ping":
      sendResponse({ pong: true });
      return false;

    case "test-api":
      testAPIConnection().then(sendResponse);
      return true;

    case "get-modes":
      sendResponse({ modes: currentModes });
      return false;

    case "get-settings":
      sendResponse({ settings: settings });
      return false;

    case "save-settings":
      settings = Object.assign({}, settings, message.settings);
      browser.storage.local.set({ settings: settings });
      sendResponse({ ok: true });
      return false;

    case "save-modes":
      currentModes = message.modes;
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true });
      return false;

    case "add-mode":
      currentModes.push(message.mode);
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "update-mode":
      currentModes = currentModes.map(function (m) {
        if (m.id === message.mode.id) return message.mode;
        return m;
      });
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "delete-mode":
      currentModes = currentModes.filter(function (m) { return m.id !== message.id; });
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "toggle-favorite":
      currentModes = currentModes.map(function (m) {
        if (m.id === message.id) m.favorite = !m.favorite;
        return m;
      });
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "add-sub-mode":
      currentModes = currentModes.map(function (m) {
        if (m.id === message.groupId && m.type === "group") {
          if (!m.subModes) m.subModes = [];
          m.subModes.push(message.subMode);
        }
        return m;
      });
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "update-sub-mode":
      currentModes = currentModes.map(function (m) {
        if (m.id === message.groupId && m.type === "group" && m.subModes) {
          m.subModes = m.subModes.map(function (s) {
            return s.id === message.subMode.id ? message.subMode : s;
          });
        }
        return m;
      });
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "delete-sub-mode":
      currentModes = currentModes.map(function (m) {
        if (m.id === message.groupId && m.type === "group" && m.subModes) {
          m.subModes = m.subModes.filter(function (s) { return s.id !== message.subId; });
        }
        return m;
      });
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "chat-message":
      handleChatMessage(sender.tab, message.messages);
      return true;

    case "process-mode-from-tab":
      processModeFromTab(message.modeId, message.subModeId, message.text).then(sendResponse);
      return true;

    case "confirm-proceed":
      if (message.proceed) {
        processWithAI(message.originalPrompt, sender.tab || { id: message.tabId }, message.modeName, { model: message.model || "" });
      }
      return false;

    case "reset-modes":
      currentModes = DEFAULT_MODES.map(function (m) { return JSON.parse(JSON.stringify(m)); });
      browser.storage.local.set({ modes: currentModes });
      buildContextMenus();
      sendResponse({ ok: true, modes: currentModes });
      return false;

    case "close-popup":
      if (sender.tab) browser.tabs.remove(sender.tab.id);
      return false;

    case "translate-mode":
      handleTranslateMode(message.modeId, message.targetLang).then(sendResponse);
      return true;

    case "undo-translate-mode":
      sendResponse(handleUndoTranslate(message.modeId));
      return false;

    case "get-favorites":
      var favs = currentModes.filter(function (m) { return m.favorite; });
      sendResponse({ favorites: favs });
      return false;

    case "get-translate-write-settings":
      browser.storage.local.get(["translateWriteSettings"]).then(function (stored) {
        sendResponse({
          settings: stored.translateWriteSettings || {
            targetLang: "en",
            debounceMs: 1500
          }
        });
      });
      return true;

    case "save-translate-write-settings":
      browser.storage.local.set({ translateWriteSettings: message.settings });
      sendResponse({ ok: true });
      return false;

    case "translate-write":
      handleTranslateWrite(message.text, message.targetLang, message.sourceLang).then(sendResponse);
      return true;

    default:
      return false;
  }
});

// ---- Chat message handler ----
async function handleChatMessage(tab, messages) {
  try {
    var result = await callChatAPI(messages);
    browser.tabs.sendMessage(tab.id, { type: "chat-response", content: result }).catch(function () {});
  } catch (err) {
    browser.tabs.sendMessage(tab.id, { type: "chat-error", content: err.message }).catch(function () {});
  }
}

// ---- Translate a mode's name + prompt ----
async function handleTranslateMode(modeId, targetLang) {
  var found = findModeById(modeId);
  if (!found) return { ok: false, error: "Mode not found" };
  if (!settings.apiKey) return { ok: false, error: LUI18n.msg("bg_api_not_configured") };

  var mode = found.subMode || found.mode;
  if (mode._originalName) {
    mode.name = mode._originalName;
    mode.prompt = mode._originalPrompt;
    delete mode._originalName;
    delete mode._originalPrompt;
    delete mode._translatedTo;
  }

  var origName = mode.name;
  var origPrompt = mode.prompt;

  var namePrompt = 'Translate the following mode name to ' + targetLang + '. Reply ONLY with the translated name, nothing else:\n\n"' + origName + '"';
  var translatedName;
  try {
    translatedName = await doAPIFetch(buildBody([{ role: "user", content: namePrompt }], ""));
  } catch (e) {
    return { ok: false, error: "Name translation failed: " + e.message };
  }

  var translatedPrompt = origPrompt;
  if (origPrompt && origPrompt !== "__CHATBOT__") {
    var promptPrompt = 'Translate the following instruction/prompt to ' + targetLang + '. Keep the {{selection}} placeholder exactly as-is. Reply ONLY with the translated prompt:\n\n' + origPrompt;
    try {
      translatedPrompt = await doAPIFetch(buildBody([{ role: "user", content: promptPrompt }], ""));
    } catch (e) {
      return { ok: false, error: "Prompt translation failed: " + e.message };
    }
  }

  mode._originalName = origName;
  mode._originalPrompt = origPrompt;
  mode._translatedTo = targetLang;
  mode.name = (translatedName || origName).replace(/^["']|["']$/g, "").trim();
  mode.prompt = translatedPrompt || origPrompt;

  await browser.storage.local.set({ modes: currentModes });
  buildContextMenus();
  return { ok: true, modes: currentModes };
}

// ---- Undo translation ----
function handleUndoTranslate(modeId) {
  var found = findModeById(modeId);
  if (!found) return { ok: false, error: "Mode not found" };
  var mode = found.subMode || found.mode;
  if (!mode._originalName) return { ok: false, error: "No translation to undo" };
  mode.name = mode._originalName;
  mode.prompt = mode._originalPrompt;
  delete mode._originalName;
  delete mode._originalPrompt;
  delete mode._translatedTo;
  browser.storage.local.set({ modes: currentModes });
  buildContextMenus();
  return { ok: true, modes: currentModes };
}

// ---- Translate Write Mode ----
async function handleTranslateWrite(text, targetLang, sourceLang) {
  if (!settings.apiKey) return { ok: false, error: LUI18n.msg("bg_api_not_configured") };
  if (!text || !text.trim()) return { ok: true, content: "" };

  var langNames = {
    es: "espanol", en: "english", pt: "portugues", fr: "francais",
    de: "deutsch", it: "italiano", zh: "chino", ja: "japones",
    ko: "coreano", ar: "arabe", hi: "hindi", ru: "ruso",
    nl: "holandes", pl: "polaco", tr: "turco"
  };

  var targetName = langNames[targetLang] || targetLang;
  var sourceHint = sourceLang ? (langNames[sourceLang] || sourceLang) + " or " : "";
  var prompt = "Translate the following text to " + targetName + ". " +
    "The text may be in " + sourceHint + "any language. " +
    "Reply ONLY with the translation, no explanations:\n\n" + text;

  try {
    var result = await callAPI(prompt, "");
    return { ok: true, content: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---- Start ----
init();
