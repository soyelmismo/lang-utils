// ============================================
// Lang Utils - Content script styles
// All CSS used by the injected UI (panel, toolbar,
// form button, form menu). Uses CSS variables so
// themes apply consistently across the extension.
// ============================================

export const CONTENT_STYLES = `
/* ---- Result panel ---- */
#lang-utils-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 420px;
  max-height: 70vh;
  background: var(--lu-bg-panel, #1a1a2e);
  color: var(--lu-text, #eee);
  border: 1px solid var(--lu-border, #16213e);
  border-radius: var(--lu-radius-lg, 12px);
  box-shadow: var(--lu-shadow-lg, 0 8px 32px rgba(0,0,0,.5));
  z-index: 2147483647;
  font-family: var(--lu-font, -apple-system, sans-serif);
  font-size: 14px;
  overflow: hidden;
  animation: luSlideIn .3s ease-out;
  resize: both;
}
@keyframes luSlideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
#lang-utils-panel .lu-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--lu-border, #16213e);
  border-bottom: 1px solid var(--lu-border-strong, #0f3460);
  cursor: move; user-select: none;
}
#lang-utils-panel .lu-header-title {
  font-weight: 600; font-size: 15px;
  color: var(--lu-accent, #e94560);
}
#lang-utils-panel .lu-header-actions { display: flex; gap: 8px; }
#lang-utils-panel .lu-btn {
  background: none; border: none;
  color: var(--lu-text-muted, #aaa);
  cursor: pointer; font-size: 18px;
  padding: 2px 6px; border-radius: 4px;
  transition: var(--lu-transition, all .2s);
}
#lang-utils-panel .lu-btn:hover {
  color: var(--lu-text, #fff);
  background: rgba(255,255,255,.1);
}
#lang-utils-panel .lu-body {
  padding: 16px;
  max-height: calc(70vh - 56px);
  overflow-y: auto;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}
#lang-utils-panel .lu-body::-webkit-scrollbar { width: 6px; }
#lang-utils-panel .lu-body::-webkit-scrollbar-track { background: var(--lu-bg-panel, #1a1a2e); }
#lang-utils-panel .lu-body::-webkit-scrollbar-thumb {
  background: var(--lu-border-strong, #0f3460);
  border-radius: 3px;
}
#lang-utils-panel .lu-actions-bar {
  padding: 8px 16px;
  border-top: 1px solid var(--lu-border, #16213e);
  display: flex; gap: 8px;
}
#lang-utils-panel .lu-action-btn {
  background: var(--lu-border-strong, #0f3460);
  color: var(--lu-text, #eee);
  border: none; padding: 6px 14px;
  border-radius: 6px; cursor: pointer;
  font-size: 13px; transition: background .2s;
}
#lang-utils-panel .lu-action-btn:hover { background: var(--lu-accent, #e94560); }
#lang-utils-panel .lu-loading {
  display: flex; align-items: center; gap: 12px; padding: 20px;
}
#lang-utils-panel .lu-spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--lu-border-strong, #0f3460);
  border-top-color: var(--lu-accent, #e94560);
  border-radius: 50%;
  animation: luSpin .8s linear infinite;
}
@keyframes luSpin { to { transform: rotate(360deg); } }
#lang-utils-panel .lu-error {
  color: var(--lu-accent, #e94560);
  padding: 12px;
  background: rgba(233,69,96,.1);
  border-radius: 8px;
  border: 1px solid rgba(233,69,96,.3);
}
#lang-utils-panel .lu-info {
  color: var(--lu-success, #4ade80);
  padding: 12px;
  background: rgba(74,222,128,.1);
  border-radius: 8px;
  border: 1px solid rgba(74,222,128,.3);
}
#lang-utils-panel .lu-confirm-btns { display: flex; gap: 8px; margin-top: 12px; }
#lang-utils-panel .lu-confirm-yes {
  background: var(--lu-success, #4ade80);
  color: var(--lu-bg-panel, #1a1a2e);
  border: none; padding: 8px 20px;
  border-radius: 6px; cursor: pointer; font-weight: 600;
}
#lang-utils-panel .lu-confirm-yes:hover { filter: brightness(0.9); }
#lang-utils-panel .lu-confirm-no {
  background: var(--lu-border-strong, #0f3460);
  color: var(--lu-text, #eee);
  border: none; padding: 8px 20px;
  border-radius: 6px; cursor: pointer;
}
#lang-utils-panel .lu-confirm-no:hover { background: var(--lu-accent, #e94560); }

/* ---- Floating toolbar ---- */
#lu-toolbar {
  position: absolute;
  background: var(--lu-bg-panel, #1a1a2e);
  border: 1px solid var(--lu-border-strong, #0f3460);
  border-radius: 10px; padding: 6px;
  box-shadow: var(--lu-shadow, 0 4px 20px rgba(0,0,0,.5));
  z-index: 2147483646;
  display: flex; gap: 4px; flex-wrap: wrap; max-width: 420px;
  font-family: var(--lu-font, -apple-system, sans-serif);
  animation: luFadeIn .2s ease;
}
@keyframes luFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
#lu-toolbar .lu-tb-btn {
  background: var(--lu-border-strong, #0f3460);
  color: var(--lu-text, #eee);
  border: none; padding: 5px 12px;
  border-radius: 6px; cursor: pointer;
  font-size: 12px; white-space: nowrap;
  transition: all .15s;
}
#lu-toolbar .lu-tb-btn:hover {
  background: var(--lu-accent, #e94560); color: #fff;
}
#lu-toolbar .lu-tb-btn:disabled { opacity: .5; cursor: wait; }
#lu-toolbar .lu-tb-fav {
  background: var(--lu-bg-panel, #1a1a2e);
  color: var(--lu-favorite, #facc15);
  border: 1px solid var(--lu-border, #333);
  padding: 5px 10px; border-radius: 6px;
  cursor: pointer; font-size: 12px; white-space: nowrap;
  transition: all .15s;
}
#lu-toolbar .lu-tb-fav:hover {
  background: var(--lu-favorite, #facc15);
  color: var(--lu-bg-panel, #1a1a2e);
}
#lu-toolbar .lu-tb-group { position: relative; }
#lu-toolbar .lu-tb-group-btn {
  background: var(--lu-border, #16213e);
  color: var(--lu-accent, #e94560);
  border: 1px solid var(--lu-border-strong, #0f3460);
  padding: 5px 12px; border-radius: 6px;
  cursor: pointer; font-size: 12px; white-space: nowrap;
  transition: all .15s; font-weight: 600;
}
#lu-toolbar .lu-tb-group-btn:hover { background: var(--lu-border-strong, #0f3460); }
#lu-toolbar .lu-tb-group-btn .lu-tb-arrow { margin-left: 4px; font-size: 10px; }
.lu-tb-group-menu {
  position: absolute; top: 100%; left: 0; margin-top: 4px;
  background: var(--lu-bg-panel, #1a1a2e);
  border: 1px solid var(--lu-border-strong, #0f3460);
  border-radius: 8px; padding: 4px;
  box-shadow: var(--lu-shadow, 0 4px 20px rgba(0,0,0,.5));
  min-width: 160px; z-index: 2147483647; display: none;
}
.lu-tb-group-menu.lu-show { display: block; }
.lu-tb-group-menu .lu-tb-sub {
  display: block; width: 100%; background: none;
  border: none; color: var(--lu-text, #eee);
  padding: 6px 12px; border-radius: 4px;
  cursor: pointer; font-size: 12px; text-align: left;
  white-space: nowrap; transition: background .15s;
}
.lu-tb-group-menu .lu-tb-sub:hover { background: var(--lu-border-strong, #0f3460); }

/* Language sub-menu: JS hover (see content/index.ts), current lang highlight */
.lu-tb-lang-menu {
  position: fixed;
  z-index: 2147483647;
}
.lu-tb-lang-menu .lu-tb-sub { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lu-tb-lang-menu .lu-tb-sub-current { color: var(--lu-accent, #e94560); font-weight: 600; }
.lu-tb-lang-menu .lu-tb-check { color: var(--lu-accent, #e94560); font-weight: 700; }
.lu-tb-lang-btn {
  cursor: pointer;
  position: relative;
  padding-right: 24px;
}
.lu-tb-lang-btn .lu-tb-arrow {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  opacity: .7;
  pointer-events: none;
}
.lu-tb-lang-btn:hover .lu-tb-arrow,
.lu-tb-lang-btn:focus .lu-tb-arrow { opacity: 1; }

/* Loading state for language menu items */
.lu-sub-loading {
  pointer-events: none;
  opacity: .85;
  position: relative;
}
.lu-sub-loading::after {
  content: "";
  position: absolute;
  right: 28px;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: luSpin .7s linear infinite;
}
@keyframes luSpin {
  to { transform: rotate(360deg); }
}

/* ---- Form injection ---- */
#lu-form-btn {
  position: absolute;
  background: var(--lu-bg-panel, #1a1a2e);
  color: var(--lu-accent, #e94560);
  border: 1px solid var(--lu-border-strong, #0f3460);
  border-radius: 6px; padding: 3px 18px 3px 8px;
  font: 11px var(--lu-font, -apple-system, sans-serif);
  cursor: pointer; z-index: 2147483645;
  box-shadow: 0 2px 8px rgba(0,0,0,.4);
  transition: all .15s;
  position: fixed;
  min-width: 28px;
  text-align: left;
}
#lu-form-btn .lu-form-arrow {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 9px;
  opacity: .65;
  pointer-events: none;
}
#lu-form-btn:hover { background: var(--lu-accent, #e94560); color: #fff; }
#lu-form-btn.lu-tw-active {
  background: var(--lu-accent, #e94560); color: #fff;
  border-color: var(--lu-accent, #e94560);
  animation: luPulse 1.5s ease-in-out infinite;
}
@keyframes luPulse {
  0%,100% { box-shadow: 0 2px 8px rgba(233,69,96,.4); }
  50% { box-shadow: 0 2px 16px rgba(233,69,96,.8); }
}
#lu-form-menu {
  position: absolute;
  background: var(--lu-bg-panel, #1a1a2e);
  border: 1px solid var(--lu-border-strong, #0f3460);
  border-radius: 8px; padding: 4px;
  box-shadow: var(--lu-shadow, 0 4px 20px rgba(0,0,0,.5));
  z-index: 2147483645;
  min-width: 200px; max-height: 300px; overflow-y: auto;
  font-family: var(--lu-font, -apple-system, sans-serif);
}
#lu-form-menu .lu-fm-item {
  color: var(--lu-text, #eee);
  padding: 6px 12px; border-radius: 4px;
  cursor: pointer; font-size: 13px; transition: background .15s;
}
#lu-form-menu .lu-fm-item:hover { background: var(--lu-border-strong, #0f3460); }
#lu-form-menu .lu-fm-group {
  color: var(--lu-accent, #e94560);
  font-weight: 600; padding: 6px 12px;
  cursor: pointer; font-size: 13px;
  display: flex; justify-content: space-between; align-items: center;
}
#lu-form-menu .lu-fm-group:hover { background: rgba(233,69,96,.1); }
#lu-form-menu .lu-fm-group .lu-fm-arrow { font-size: 10px; color: var(--lu-text-muted, #888); }
#lu-form-menu .lu-fm-subs { padding-left: 12px; display: none; }
#lu-form-menu .lu-fm-subs.lu-show { display: block; }
#lu-form-menu .lu-fm-sub {
  color: var(--lu-text-muted, #ccc);
  padding: 5px 12px; border-radius: 4px;
  cursor: pointer; font-size: 12px; transition: background .15s;
}
#lu-form-menu .lu-fm-sub:hover { background: var(--lu-border-strong, #0f3460); }
#lu-form-menu .lu-fm-divider {
  border-top: 1px solid var(--lu-border-strong, #0f3460);
  margin: 4px 0;
}
#lu-form-menu .lu-fm-tw-header {
  color: var(--lu-accent, #e94560);
  font-weight: 600; padding: 6px 12px;
  font-size: 12px; display: flex; align-items: center; gap: 6px;
}
#lu-form-menu .lu-fm-tw-header .lu-fm-tw-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--lu-success, #4ade80);
  animation: luPulse 1.5s ease-in-out infinite;
}
#lu-form-menu .lu-fm-tw-lang {
  color: var(--lu-text, #eee);
  padding: 4px 12px; border-radius: 4px;
  cursor: pointer; font-size: 12px;
  transition: background .15s;
  display: flex; align-items: center; gap: 6px;
}
#lu-form-menu .lu-fm-tw-lang:hover { background: var(--lu-border-strong, #0f3460); }
#lu-form-menu .lu-fm-tw-lang.lu-tw-selected { color: var(--lu-success, #4ade80); }
#lu-form-menu .lu-fm-tw-lang.lu-tw-selected::before {
  content: '\\2713'; font-size: 10px;
}
#lu-form-menu .lu-fm-tw-stop {
  color: var(--lu-danger, #f87171);
  padding: 6px 12px; border-radius: 4px;
  cursor: pointer; font-size: 12px; transition: background .15s;
}
#lu-form-menu .lu-fm-tw-stop:hover { background: rgba(248,113,113,.1); }
#lu-form-loading {
  position: absolute; top: 8px; right: 8px;
  width: 18px; height: 18px;
  border: 2px solid var(--lu-border-strong, #0f3460);
  border-top-color: var(--lu-accent, #e94560);
  border-radius: 50%;
  animation: luSpin .8s linear infinite;
  z-index: 2147483645;
}
.lu-form-undo {
  position: absolute; top: 4px; right: 4px;
  background: var(--lu-favorite, #facc15);
  color: var(--lu-bg-panel, #1a1a2e);
  border: none; border-radius: 4px;
  padding: 2px 8px;
  font: 10px var(--lu-font, -apple-system, sans-serif);
  cursor: pointer; z-index: 2147483645;
}
.lu-form-undo:hover { filter: brightness(1.1); }

/* ---- Result popup (transient, near selection) ---- */
#lang-utils-popup {
  position: absolute;
  background: var(--lu-bg-panel, #1a1a2e);
  color: var(--lu-text, #eee);
  border: 1px solid var(--lu-border, #16213e);
  border-radius: var(--lu-radius-lg, 12px);
  box-shadow: var(--lu-shadow-lg, 0 8px 32px rgba(0,0,0,.5));
  z-index: 2147483647;
  font-family: var(--lu-font, -apple-system, sans-serif);
  font-size: 14px;
  overflow: hidden;
  animation: luPopupIn .18s ease-out;
  display: flex; flex-direction: column;
}
@keyframes luPopupIn {
  from { opacity: 0; transform: scale(0.96) translateY(-2px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
#lang-utils-popup .lu-popup-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: var(--lu-border, #16213e);
  border-bottom: 1px solid var(--lu-border-strong, #0f3460);
  flex: 0 0 auto;
}
#lang-utils-popup .lu-popup-title {
  font-weight: 600; font-size: 13px;
  color: var(--lu-accent, #e94560);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#lang-utils-popup .lu-popup-copy {
  background: none; border: none;
  color: var(--lu-text-muted, #aaa);
  cursor: pointer; font-size: 14px;
  padding: 2px 6px; border-radius: 4px;
  position: absolute; top: 4px; right: 4px;
}
#lang-utils-popup .lu-popup-copy:hover {
  color: var(--lu-text, #fff);
  background: var(--lu-border-strong, #0f3460);
}
#lang-utils-popup .lu-popup-body {
  padding: 12px 14px;
  overflow-y: auto;
  flex: 1 1 auto;
  word-wrap: break-word;
  position: relative;
}
#lang-utils-popup .lu-popup-body::-webkit-scrollbar { width: 6px; }
#lang-utils-popup .lu-popup-body::-webkit-scrollbar-track { background: transparent; }
#lang-utils-popup .lu-popup-body::-webkit-scrollbar-thumb {
  background: var(--lu-border-strong, #0f3460);
  border-radius: 3px;
}
#lang-utils-popup .lu-error {
  color: var(--lu-accent, #e94560);
  font-size: 13px;
}
#lang-utils-popup .lu-loading {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--lu-text-muted, #aaa);
}

/* ---- Translate-write indicator on field ---- */
.lu-tw-field-active {
  outline: 2px solid var(--lu-accent, #e94560) !important;
  outline-offset: -1px;
}
.lu-tw-field-active::placeholder {
  color: var(--lu-accent, #e94560) !important;
}
`;
