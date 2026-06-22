/* ============================================
   Lang Utils - Content Script
   Features: result panel, floating toolbar with groups,
   form injection, auto-detect confirm, translate-write mode
   Uses shared utils.js (loaded via manifest)
   ============================================ */

(function () {
  "use strict";

  if (window.__langUtilsLoaded) return;
  window.__langUtilsLoaded = true;

  var LU = window.LangUtils || {
    escapeHtml: function (s) { return s || ""; },
    markdownToHtml: function (s) { return s || ""; },
    copyWithFeedback: function (text, btn, lbl) { navigator.clipboard.writeText(text); }
  };

  // ---- Styles ----
  var style = document.createElement("style");
  style.textContent =
    /* Result panel */
    "#lang-utils-panel{position:fixed;top:20px;right:20px;width:420px;max-height:70vh;background:#1a1a2e;color:#eee;border:1px solid #16213e;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;overflow:hidden;animation:luSlideIn .3s ease-out;resize:both}" +
    "@keyframes luSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}" +
    "#lang-utils-panel .lu-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#16213e;border-bottom:1px solid #0f3460;cursor:move;user-select:none}" +
    "#lang-utils-panel .lu-header-title{font-weight:600;font-size:15px;color:#e94560}" +
    "#lang-utils-panel .lu-header-actions{display:flex;gap:8px}" +
    "#lang-utils-panel .lu-btn{background:none;border:none;color:#aaa;cursor:pointer;font-size:18px;padding:2px 6px;border-radius:4px;transition:all .2s}" +
    "#lang-utils-panel .lu-btn:hover{color:#fff;background:rgba(255,255,255,.1)}" +
    "#lang-utils-panel .lu-body{padding:16px;max-height:calc(70vh - 56px);overflow-y:auto;line-height:1.6;white-space:pre-wrap;word-wrap:break-word}" +
    "#lang-utils-panel .lu-body::-webkit-scrollbar{width:6px}" +
    "#lang-utils-panel .lu-body::-webkit-scrollbar-track{background:#1a1a2e}" +
    "#lang-utils-panel .lu-body::-webkit-scrollbar-thumb{background:#0f3460;border-radius:3px}" +
    "#lang-utils-panel .lu-actions-bar{padding:8px 16px;border-top:1px solid #16213e;display:flex;gap:8px}" +
    "#lang-utils-panel .lu-action-btn{background:#0f3460;color:#eee;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;transition:background .2s}" +
    "#lang-utils-panel .lu-action-btn:hover{background:#e94560}" +
    "#lang-utils-panel .lu-loading{display:flex;align-items:center;gap:12px;padding:20px}" +
    "#lang-utils-panel .lu-spinner{width:24px;height:24px;border:3px solid #0f3460;border-top-color:#e94560;border-radius:50%;animation:luSpin .8s linear infinite}" +
    "@keyframes luSpin{to{transform:rotate(360deg)}}" +
    "#lang-utils-panel .lu-error{color:#e94560;padding:12px;background:rgba(233,69,96,.1);border-radius:8px;border:1px solid rgba(233,69,96,.3)}" +
    "#lang-utils-panel .lu-info{color:#4ade80;padding:12px;background:rgba(74,222,128,.1);border-radius:8px;border:1px solid rgba(74,222,128,.3)}" +
    "#lang-utils-panel .lu-confirm-btns{display:flex;gap:8px;margin-top:12px}" +
    "#lang-utils-panel .lu-confirm-yes{background:#4ade80;color:#1a1a2e;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600}" +
    "#lang-utils-panel .lu-confirm-yes:hover{background:#22c55e}" +
    "#lang-utils-panel .lu-confirm-no{background:#0f3460;color:#eee;border:none;padding:8px 20px;border-radius:6px;cursor:pointer}" +
    "#lang-utils-panel .lu-confirm-no:hover{background:#e94560}" +
    /* Floating toolbar */
    "#lu-toolbar{position:absolute;background:#1a1a2e;border:1px solid #0f3460;border-radius:10px;padding:6px;box-shadow:0 4px 20px rgba(0,0,0,.5);z-index:2147483646;display:flex;gap:4px;flex-wrap:wrap;max-width:420px;font-family:-apple-system,sans-serif;animation:luFadeIn .2s ease}" +
    "@keyframes luFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}" +
    "#lu-toolbar .lu-tb-btn{background:#0f3460;color:#eee;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;transition:all .15s}" +
    "#lu-toolbar .lu-tb-btn:hover{background:#e94560;color:#fff}" +
    "#lu-toolbar .lu-tb-btn:disabled{opacity:.5;cursor:wait}" +
    "#lu-toolbar .lu-tb-fav{background:#1a1a2e;color:#facc15;border:1px solid #333;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;transition:all .15s}" +
    "#lu-toolbar .lu-tb-fav:hover{background:#facc15;color:#1a1a2e}" +
    /* Toolbar group (with sub-modes) */
    "#lu-toolbar .lu-tb-group{position:relative}" +
    "#lu-toolbar .lu-tb-group-btn{background:#16213e;color:#e94560;border:1px solid #0f3460;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;transition:all .15s;font-weight:600}" +
    "#lu-toolbar .lu-tb-group-btn:hover{background:#0f3460}" +
    "#lu-toolbar .lu-tb-group-btn .lu-tb-arrow{margin-left:4px;font-size:10px}" +
    ".lu-tb-group-menu{position:absolute;top:100%;left:0;margin-top:4px;background:#1a1a2e;border:1px solid #0f3460;border-radius:8px;padding:4px;box-shadow:0 4px 20px rgba(0,0,0,.5);min-width:160px;z-index:2147483647;display:none}" +
    ".lu-tb-group-menu.lu-show{display:block}" +
    ".lu-tb-group-menu .lu-tb-sub{display:block;width:100%;background:none;border:none;color:#eee;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;text-align:left;white-space:nowrap;transition:background .15s}" +
    ".lu-tb-group-menu .lu-tb-sub:hover{background:#0f3460}" +
    /* Form injection button */
    "#lu-form-btn{position:absolute;background:#1a1a2e;color:#e94560;border:1px solid #0f3460;border-radius:6px;padding:3px 8px;font:11px -apple-system,sans-serif;cursor:pointer;z-index:2147483645;box-shadow:0 2px 8px rgba(0,0,0,.4);transition:all .15s}" +
    "#lu-form-btn:hover{background:#e94560;color:#fff}" +
    "#lu-form-btn.lu-tw-active{background:#e94560;color:#fff;border-color:#e94560;animation:luPulse 1.5s ease-in-out infinite}" +
    "@keyframes luPulse{0%,100%{box-shadow:0 2px 8px rgba(233,69,96,.4)}50%{box-shadow:0 2px 16px rgba(233,69,96,.8)}}" +
    "#lu-form-menu{position:absolute;background:#1a1a2e;border:1px solid #0f3460;border-radius:8px;padding:4px;box-shadow:0 4px 20px rgba(0,0,0,.5);z-index:2147483645;min-width:200px;max-height:300px;overflow-y:auto;font-family:-apple-system,sans-serif}" +
    "#lu-form-menu .lu-fm-item{color:#eee;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;transition:background .15s}" +
    "#lu-form-menu .lu-fm-item:hover{background:#0f3460}" +
    "#lu-form-menu .lu-fm-group{color:#e94560;font-weight:600;padding:6px 12px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center}" +
    "#lu-form-menu .lu-fm-group:hover{background:rgba(233,69,96,.1)}" +
    "#lu-form-menu .lu-fm-group .lu-fm-arrow{font-size:10px;color:#888}" +
    "#lu-form-menu .lu-fm-subs{padding-left:12px;display:none}" +
    "#lu-form-menu .lu-fm-subs.lu-show{display:block}" +
    "#lu-form-menu .lu-fm-sub{color:#ccc;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;transition:background .15s}" +
    "#lu-form-menu .lu-fm-sub:hover{background:#0f3460}" +
    /* Translate-write divider and items */
    "#lu-form-menu .lu-fm-divider{border-top:1px solid #0f3460;margin:4px 0}" +
    "#lu-form-menu .lu-fm-tw-header{color:#e94560;font-weight:600;padding:6px 12px;font-size:12px;display:flex;align-items:center;gap:6px}" +
    "#lu-form-menu .lu-fm-tw-header .lu-fm-tw-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:luPulse 1.5s ease-in-out infinite}" +
    "#lu-form-menu .lu-fm-tw-lang{color:#eee;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;transition:background .15s;display:flex;align-items:center;gap:6px}" +
    "#lu-form-menu .lu-fm-tw-lang:hover{background:#0f3460}" +
    "#lu-form-menu .lu-fm-tw-lang.lu-tw-selected{color:#4ade80}" +
    "#lu-form-menu .lu-fm-tw-lang.lu-tw-selected::before{content:'\\2713';font-size:10px}" +
    "#lu-form-menu .lu-fm-tw-stop{color:#f87171;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;transition:background .15s}" +
    "#lu-form-menu .lu-fm-tw-stop:hover{background:rgba(248,113,113,.1)}" +
    "#lu-form-loading{position:absolute;top:8px;right:8px;width:18px;height:18px;border:2px solid #0f3460;border-top-color:#e94560;border-radius:50%;animation:luSpin .8s linear infinite;z-index:2147483645}" +
    ".lu-form-undo{position:absolute;top:4px;right:4px;background:#facc15;color:#1a1a2e;border:none;border-radius:4px;padding:2px 8px;font:10px -apple-system,sans-serif;cursor:pointer;z-index:2147483645}" +
    ".lu-form-undo:hover{background:#fde047}" +
    /* Translate-write indicator on field */
    ".lu-tw-field-active{outline:2px solid #e94560 !important;outline-offset:-1px}" +
    ".lu-tw-field-active::placeholder{color:#e94560 !important}";
  document.head.appendChild(style);

  console.log("[Lang Utils Content] Script loaded in", window.location.href);

  // ============================================================
  //  PANEL MANAGEMENT
  // ============================================================

  var currentPanel = null;

  function removePanel() {
    if (currentPanel) { currentPanel.remove(); currentPanel = null; }
  }

  function createPanel(title, contentHTML, options) {
    removePanel();
    options = options || {};
    var panel = document.createElement("div");
    panel.id = "lang-utils-panel";
    panel.innerHTML =
      '<div class="lu-header">' +
        '<span class="lu-header-title">' + LU.escapeHtml(title) + '</span>' +
        '<div class="lu-header-actions">' +
          '<button class="lu-btn" id="lu-copy-btn" title="' + LUI18n.msg("content_copy") + '">\uD83D\uDCCB</button>' +
          '<button class="lu-btn" id="lu-close-btn" title="' + LUI18n.msg("content_close") + '">\u2715</button>' +
        '</div>' +
      '</div>' +
      '<div class="lu-body" id="lu-body">' + contentHTML + '</div>' +
      (options.actions || "");
    document.body.appendChild(panel);
    currentPanel = panel;
    panel.querySelector("#lu-close-btn").addEventListener("click", removePanel);
    panel.querySelector("#lu-copy-btn").addEventListener("click", function () {
      LU.copyWithFeedback(panel.querySelector("#lu-body").textContent, panel.querySelector("#lu-copy-btn"));
    });
    makeDraggable(panel, panel.querySelector(".lu-header"));
    return panel;
  }

  function makeDraggable(element, handle) {
    var isDragging = false, offsetX, offsetY;
    handle.addEventListener("mousedown", function (e) {
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!isDragging) return;
      element.style.left = (e.clientX - offsetX) + "px";
      element.style.top = (e.clientY - offsetY) + "px";
      element.style.right = "auto";
    });
    document.addEventListener("mouseup", function () { isDragging = false; });
  }

  // ============================================================
  //  FLOATING TOOLBAR (with group support)
  // ============================================================

  var toolbarEl = null;
  var toolbarModes = []; // flat list of single modes
  var toolbarGroups = []; // list of group modes
  var activeGroupMenu = null;

  function removeToolbar() {
    if (toolbarEl) { toolbarEl.remove(); toolbarEl = null; }
    activeGroupMenu = null;
  }

  function sendModeToAPI(modeId, subModeId, selectedText, btn) {
    if (btn) { btn.disabled = true; btn.textContent = "..."; }
    browser.runtime.sendMessage({
      type: "process-mode-from-tab",
      modeId: modeId,
      subModeId: subModeId || "",
      text: selectedText
    }).then(function (resp) {
      removeToolbar();
      if (resp && resp.ok) {
        createPanel(LUI18n.msg("content_result"), LU.markdownToHtml(resp.content));
      } else {
        createPanel(LUI18n.msg("content_error"), '<div class="lu-error">' + LU.escapeHtml(resp ? resp.error : "Unknown error") + '</div>');
      }
    }).catch(function (err) {
      removeToolbar();
      createPanel(LUI18n.msg("content_error"), '<div class="lu-error">' + LU.escapeHtml(err.message) + '</div>');
    });
  }

  function showToolbar(x, y, selectedText) {
    removeToolbar();
    if (toolbarModes.length === 0 && toolbarGroups.length === 0) return;

    toolbarEl = document.createElement("div");
    toolbarEl.id = "lu-toolbar";
    toolbarEl.style.left = x + "px";
    toolbarEl.style.top = (y + 10) + "px";

    // Render single modes
    toolbarModes.forEach(function (mode) {
      var btn = document.createElement("button");
      btn.className = mode.favorite ? "lu-tb-fav" : "lu-tb-btn";
      btn.textContent = mode.name;
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        sendModeToAPI(mode.id, "", selectedText, btn);
      });
      toolbarEl.appendChild(btn);
    });

    // Render groups
    toolbarGroups.forEach(function (group) {
      var wrapper = document.createElement("div");
      wrapper.className = "lu-tb-group";

      var btn = document.createElement("button");
      btn.className = "lu-tb-group-btn";
      btn.innerHTML = LU.escapeHtml(group.name) + '<span class="lu-tb-arrow">\u25BC</span>';

      var menu = document.createElement("div");
      menu.className = "lu-tb-group-menu";

      (group.subModes || []).forEach(function (sub) {
        var subBtn = document.createElement("button");
        subBtn.className = "lu-tb-sub";
        subBtn.textContent = sub.name;
        subBtn.addEventListener("mousedown", function (e) {
          e.preventDefault();
          e.stopPropagation();
          sendModeToAPI(group.id, sub.id, selectedText, subBtn);
        });
        menu.appendChild(subBtn);
      });

      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        // Toggle menu
        var wasOpen = menu.classList.contains("lu-show");
        // Close all other menus
        document.querySelectorAll(".lu-tb-group-menu.lu-show").forEach(function (m) { m.classList.remove("lu-show"); });
        if (!wasOpen) menu.classList.add("lu-show");
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(menu);
      toolbarEl.appendChild(wrapper);
    });

    document.body.appendChild(toolbarEl);
  }

  // Load modes for toolbar
  browser.runtime.sendMessage({ type: "get-modes" }).then(function (resp) {
    if (resp && resp.modes) {
      var favs = [];
      var groups = [];
      resp.modes.forEach(function (m) {
        if (m.type === "group") {
          groups.push(m);
        } else if (m.favorite && m.prompt !== "__CHATBOT__") {
          favs.push(m);
        }
      });
      toolbarGroups = groups;
      if (favs.length > 0) {
        toolbarModes = favs;
      } else {
        toolbarModes = resp.modes.filter(function (m) { return m.type !== "group" && m.prompt !== "__CHATBOT__"; }).slice(0, 4);
      }
    }
  }).catch(function () {});

  // Listen for selection changes
  document.addEventListener("mouseup", function (e) {
    if (e.target.closest("#lu-toolbar") || e.target.closest("#lang-utils-panel") ||
        e.target.closest("#lu-form-btn") || e.target.closest("#lu-form-menu")) return;

    setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : "";
      if (text.length < 3) {
        removeToolbar();
        return;
      }
      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      showToolbar(rect.left + window.scrollX, rect.bottom + window.scrollY, text);
    }, 10);
  });

  document.addEventListener("mousedown", function (e) {
    if (toolbarEl && !e.target.closest("#lu-toolbar")) {
      removeToolbar();
    }
  });

  // ============================================================
  //  FORM INJECTION (with group + translate-write support)
  // ============================================================

  var formBtn = null;
  var formMenu = null;
  var formLoadingEl = null;
  var activeField = null;
  var fieldOriginal = null;

  // ---- Translate-Write state (per-field) ----
  var twActive = false;
  var twTargetField = null;
  var twDebounceTimer = null;
  var twDebounceMs = 1500;
  var twTargetLang = "en";
  var twTranslating = false;
  var twLastTranslatedText = "";

  var TW_LANGUAGES = [
    { code: "es" },
    { code: "en" },
    { code: "pt" },
    { code: "fr" },
    { code: "de" },
    { code: "it" },
    { code: "zh" },
    { code: "ja" },
    { code: "ko" },
    { code: "ru" },
    { code: "nl" },
    { code: "pl" },
    { code: "tr" }
  ];

  function removeFormUI() {
    if (formBtn) { formBtn.remove(); formBtn = null; }
    if (formMenu) { formMenu.remove(); formMenu = null; }
    if (formLoadingEl) { formLoadingEl.remove(); formLoadingEl = null; }
  }

  function isFormElement(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT" && (el.type === "text" || el.type === "search" || el.type === "" || el.type === "url" || el.type === "email")) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function getFieldValue(el) {
    if (el.isContentEditable) return el.textContent || el.innerText || "";
    return el.value || "";
  }

  function setFieldValue(el, text) {
    el.focus();
    if (el.isContentEditable) {
      // For Slate.js editors (Discord):
      // Use keyboard events that Slate actually intercepts
      // Step 1: Ctrl+A to select all (Slate handles this)
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true, bubbles: true }));
      // Step 2: Insert replacement text via execCommand
      document.execCommand("insertText", false, text);
      // Step 3: Reset cursor to end after Slate processes
      setTimeout(function () {
        el.focus();
        var r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }, 0);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Use execCommand to properly simulate user typing —
      // this triggers React/Angular/virtual state updates correctly
      el.select();
      document.execCommand("insertText", false, text);
      // Fallback: also dispatch input event in case execCommand didn't work
      if (el.value !== text) {
        el.value = text;
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function showFormButton(el) {
    removeFormUI();
    activeField = el;
    var rect = el.getBoundingClientRect();

    formBtn = document.createElement("button");
    formBtn.id = "lu-form-btn";
    formBtn.textContent = "LU";
    formBtn.style.cssText = "position:fixed;z-index:2147483645;";
    document.body.appendChild(formBtn);

    // LU button is ~28px wide, ~18px tall. Position above-right of field.
    var btnW = 28, btnH = 18;
    var top = rect.top - btnH - 4;
    var left = rect.right - btnW - 4;
    // Clamp within viewport
    var vw = window.innerWidth, vh = window.innerHeight;
    if (left < 4) left = 4;
    if (left + btnW > vw - 4) left = vw - btnW - 4;
    if (top < 4) top = rect.bottom + 4;
    if (top + btnH > vh - 4) top = vh - btnH - 4;
    formBtn.style.top = top + "px";
    formBtn.style.left = left + "px";

    // If this field is the active translate-write target, show indicator
    if (twActive && twTargetField === el) {
      formBtn.classList.add("lu-tw-active");
    }

    formBtn.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (formMenu) {
        removeFormUI();
        return;
      }
      showFormMenu(el);
    });
  }

  function showFormMenu(el) {
    if (formMenu) { formMenu.remove(); formMenu = null; }
    var rect = el.getBoundingClientRect();

    formMenu = document.createElement("div");
    formMenu.id = "lu-form-menu";
    formMenu.style.position = "fixed";
    formMenu.style.visibility = "hidden";
    document.body.appendChild(formMenu);

    // Render single modes
    toolbarModes.forEach(function (mode) {
      var item = document.createElement("div");
      item.className = "lu-fm-item";
      item.textContent = mode.name;
      item.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        processFormMode(el, mode.id, "");
      });
      formMenu.appendChild(item);
    });

    // Render groups
    toolbarGroups.forEach(function (group) {
      var groupItem = document.createElement("div");
      groupItem.className = "lu-fm-group";
      groupItem.innerHTML = LU.escapeHtml(group.name) + ' <span class="lu-fm-arrow">\u25B6</span>';

      var subsContainer = document.createElement("div");
      subsContainer.className = "lu-fm-subs";

      (group.subModes || []).forEach(function (sub) {
        var subItem = document.createElement("div");
        subItem.className = "lu-fm-sub";
        subItem.textContent = sub.name;
        subItem.addEventListener("mousedown", function (e) {
          e.preventDefault();
          e.stopPropagation();
          processFormMode(el, group.id, sub.id);
        });
        subsContainer.appendChild(subItem);
      });

      groupItem.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var wasOpen = subsContainer.classList.contains("lu-show");
        formMenu.querySelectorAll(".lu-fm-subs.lu-show").forEach(function (s) { s.classList.remove("lu-show"); });
        if (!wasOpen) subsContainer.classList.add("lu-show");
      });

      formMenu.appendChild(groupItem);
      formMenu.appendChild(subsContainer);
    });

    // ---- Translate-Write section ----
    var divider = document.createElement("div");
    divider.className = "lu-fm-divider";
    formMenu.appendChild(divider);

    if (twActive && twTargetField === el) {
      // Show active state with stop option
      var header = document.createElement("div");
      header.className = "lu-fm-tw-header";
      header.innerHTML = '<span class="lu-fm-tw-dot"></span> ' + LUI18n.msg("content_tw_active");
      formMenu.appendChild(header);

      TW_LANGUAGES.forEach(function (lang) {
        var langItem = document.createElement("div");
        langItem.className = "lu-fm-tw-lang" + (lang.code === twTargetLang ? " lu-tw-selected" : "");
        langItem.textContent = LUI18n.langName(lang.code);
        langItem.addEventListener("mousedown", function (e) {
          e.preventDefault();
          e.stopPropagation();
          twTargetLang = lang.code;
          saveTWSettings();
          // Re-translate if there's text
          if (twTargetField && getFieldValue(twTargetField).trim()) {
            triggerTranslate(twTargetField);
          }
          // Re-render menu to update checkmark
          removeFormUI();
          showFormButton(el);
          showFormMenu(el);
        });
        formMenu.appendChild(langItem);
      });

      var stopItem = document.createElement("div");
      stopItem.className = "lu-fm-tw-stop";
      stopItem.textContent = "\u25A0 " + LUI18n.msg("content_tw_stop");
      stopItem.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        deactivateTW(el);
        removeFormUI();
        showFormButton(el);
      });
      formMenu.appendChild(stopItem);
    } else {
      // Show activate option
      var activateItem = document.createElement("div");
      activateItem.className = "lu-fm-item";
      activateItem.style.color = "#e94560";
      activateItem.style.fontWeight = "600";
      activateItem.textContent = "\uD83C\uDF10 " + LUI18n.msg("content_tw_activate");
      activateItem.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        activateTW(el);
        removeFormUI();
        showFormButton(el);
        showFormMenu(el);
      });
      formMenu.appendChild(activateItem);
    }

    // Position menu: try above field, flip below if needed. Align right edge.
    var menuW = 210, menuH = formMenu.children.length * 28 + 16;
    var vw = window.innerWidth, vh = window.innerHeight;
    var top = rect.top - menuH - 4;
    if (top < 4) top = rect.bottom + 4;
    if (top + menuH > vh - 4) top = vh - menuH - 4;
    var left = rect.right - menuW;
    if (left < 4) left = 4;
    if (left + menuW > vw - 4) left = vw - menuW - 4;
    formMenu.style.top = top + "px";
    formMenu.style.left = left + "px";
    formMenu.style.visibility = "";
  }

  // ---- Translate-Write core ----
  function activateTW(el) {
    twActive = true;
    twTargetField = el;
    twTargetLang = twTargetLang || "en";
    el.classList.add("lu-tw-field-active");

    // Add input listener
    el.addEventListener("input", twInputHandler);
    loadTWSettings();
  }

  function deactivateTW(el) {
    twActive = false;
    if (twDebounceTimer) {
      clearTimeout(twDebounceTimer);
      twDebounceTimer = null;
    }
    if (el) {
      el.classList.remove("lu-tw-field-active");
      el.removeEventListener("input", twInputHandler);
    }
    twTargetField = null;
    twTranslating = false;
  }

  function twInputHandler(e) {
    // e.target might be a child element of contentEditable (e.g. <span> in Discord)
    var el = e.target;
    if (twTargetField && twTargetField.isContentEditable && twTargetField.contains(el)) {
      el = twTargetField; // normalize to the contentEditable parent
    }
    if (!twActive || twTargetField !== el) return;
    if (twTranslating) return;

    var text = getFieldValue(el);

    // If text is the same as last translation, skip
    if (text === twLastTranslatedText) return;

    // Clear existing timer
    if (twDebounceTimer) {
      clearTimeout(twDebounceTimer);
      twDebounceTimer = null;
    }

    // If empty or too short, skip
    if (!text.trim() || text.trim().length < 3) return;

    // Start debounce timer
    twDebounceTimer = setTimeout(function () {
      triggerTranslate(el);
    }, twDebounceMs);
  }

  async function triggerTranslate(el) {
    if (twTranslating) return;
    var text = getFieldValue(el);
    if (!text.trim()) return;

    twTranslating = true;
    el.style.opacity = "0.6";

    try {
      var resp = await browser.runtime.sendMessage({
        type: "translate-write",
        text: text.trim(),
        targetLang: twTargetLang,
        sourceLang: ""
      });

      if (resp && resp.ok && resp.content) {
        twLastTranslatedText = resp.content;
        setFieldValue(el, resp.content);

        // Place cursor at end
        var end = el.value ? el.value.length : resp.content.length;
        try {
          el.setSelectionRange(end, end);
        } catch (_) {}
      }
    } catch (err) {
      console.error("[Lang Utils] Translate-write error:", err.message);
    }

    twTranslating = false;
    el.style.opacity = "";
  }

  function saveTWSettings() {
    browser.runtime.sendMessage({
      type: "save-translate-write-settings",
      settings: { targetLang: twTargetLang, debounceMs: twDebounceMs }
    }).catch(function () {});
  }

  async function loadTWSettings() {
    try {
      var resp = await browser.runtime.sendMessage({ type: "get-translate-write-settings" });
      if (resp && resp.settings) {
        twTargetLang = resp.settings.targetLang || "en";
        twDebounceMs = resp.settings.debounceMs || 1500;
      }
    } catch (e) {}
  }

  async function processFormMode(el, modeId, subModeId) {
    removeFormUI();
    var text = getFieldValue(el);
    if (!text.trim()) return;

    fieldOriginal = text;
    var parent = el.parentElement;
    if (!parent) return;
    parent.style.position = parent.style.position || "relative";

    formLoadingEl = document.createElement("div");
    formLoadingEl.id = "lu-form-loading";
    parent.appendChild(formLoadingEl);

    try {
      var resp = await browser.runtime.sendMessage({
        type: "process-mode-from-tab",
        modeId: modeId,
        subModeId: subModeId || "",
        text: text
      });
      if (formLoadingEl) { formLoadingEl.remove(); formLoadingEl = null; }

      if (resp && resp.ok) {
        setFieldValue(el, resp.content);
        showFormUndo(el, fieldOriginal);
      } else {
        alert("Lang Utils error: " + (resp ? resp.error : "Unknown error"));
      }
    } catch (err) {
      if (formLoadingEl) { formLoadingEl.remove(); formLoadingEl = null; }
      alert("Lang Utils error: " + err.message);
    }
  }

  function showFormUndo(el, original) {
    var existing = el.parentElement.querySelector(".lu-form-undo");
    if (existing) existing.remove();

    var undoBtn = document.createElement("button");
    undoBtn.className = "lu-form-undo";
    undoBtn.textContent = "\uD83D\uDD04 " + LUI18n.msg("content_undo");
    el.parentElement.appendChild(undoBtn);

    undoBtn.addEventListener("click", function () {
      setFieldValue(el, original);
      undoBtn.remove();
    });
  }

  // Track focused form elements
  document.addEventListener("focusin", function (e) {
    if (e.target.closest("#lang-utils-panel") || e.target.closest("#lu-toolbar") ||
        e.target.closest("#lu-form-menu") || e.target.closest("#lu-form-btn")) return;
    // Walk up to find a form element (handles contentEditable with child elements)
    var el = e.target;
    while (el && el !== document.body) {
      if (isFormElement(el)) {
        showFormButton(el);
        return;
      }
      el = el.parentElement;
    }
    removeFormUI();
  });

  document.addEventListener("focusout", function (e) {
    setTimeout(function () {
      if (document.activeElement === formBtn || (formMenu && document.activeElement && formMenu.contains(document.activeElement))) return;
      // Keep button if focus moved to another form element (e.g. Discord React re-render)
      if (isFormElement(document.activeElement)) {
        if (activeField !== document.activeElement) {
          showFormButton(document.activeElement);
        }
        return;
      }
      if (!e.target.closest("#lu-form-btn") && !e.target.closest("#lu-form-menu")) {
        removeFormUI();
      }
    }, 200);
  });

  // ============================================================
  //  MESSAGE HANDLER
  // ============================================================

  browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log("[Lang Utils Content] Received:", message.type);
    try {
      switch (message.type) {
        case "ping":
          sendResponse({ pong: true });
          return false;

        case "show-loading":
          createPanel(message.title,
            '<div class="lu-loading"><div class="lu-spinner"></div><span>' + LUI18n.msg("content_processing") + '</span></div>');
          break;

        case "show-result":
          createPanel(message.title, LU.markdownToHtml(message.content), {
            actions: '<div class="lu-actions-bar"><button class="lu-action-btn" id="lu-copy-full">' + LUI18n.msg("content_copy_all") + '</button></div>'
          });
          var copyFull = document.getElementById("lu-copy-full");
          if (copyFull) {
            copyFull.addEventListener("click", function () {
              LU.copyWithFeedback(message.content, copyFull, LUI18n.msg("content_copy_all"));
            });
          }
          break;

        case "show-error":
          createPanel(message.title,
            '<div class="lu-error">' + LU.escapeHtml(message.content) + '</div>');
          break;

        case "show-confirm":
          var confirmPanel = createPanel(message.title,
            '<div class="lu-info">' + LU.escapeHtml(message.content) + '</div>' +
            '<div class="lu-confirm-btns">' +
              '<button class="lu-confirm-yes" id="lu-confirm-yes">' + LUI18n.msg("content_confirm_yes") + '</button>' +
              '<button class="lu-confirm-no" id="lu-confirm-no">' + LUI18n.msg("content_confirm_no") + '</button>' +
            '</div>'
          );
          confirmPanel.querySelector("#lu-confirm-yes").addEventListener("click", function () {
            removePanel();
            browser.runtime.sendMessage({
              type: "confirm-proceed",
              proceed: true,
              originalPrompt: message.originalPrompt,
              modeName: message.modeName,
              model: message.model || ""
            });
          });
          confirmPanel.querySelector("#lu-confirm-no").addEventListener("click", function () {
            removePanel();
          });
          break;

        case "toggle-translate-write":
          // Toggle on current focused field
          if (activeField && isFormElement(activeField)) {
            if (twActive && twTargetField === activeField) {
              deactivateTW(activeField);
            } else {
              activateTW(activeField);
            }
            removeFormUI();
            showFormButton(activeField);
            showFormMenu(activeField);
          }
          return false;
      }
    } catch (e) {
      console.error("[Lang Utils Content] Error handling:", message.type, e);
    }
    return false;
  });
})();
