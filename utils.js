/* ============================================
   Lang Utils - Shared Utilities
   Used by all extension pages and content script
   ============================================ */
window.LangUtils = (function () {
  "use strict";

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function markdownToHtml(md) {
    if (!md) return "";
    var html = escapeHtml(md);
    // Headers
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
    // Lists
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
    // Numbered lists
    html = html.replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>");
    // Line breaks
    html = html.replace(/\n\n/g, "</p><p>");
    html = html.replace(/\n/g, "<br>");
    html = "<p>" + html + "</p>";
    return html;
  }

  function copyWithFeedback(text, btnEl, label) {
    navigator.clipboard.writeText(text).then(function () {
      if (btnEl) {
        var original = btnEl.textContent;
        var copiedMsg = (window.LUI18n && LUI18n.msg) ? LUI18n.msg("content_copied") : " Copied!";
        btnEl.textContent = (label || "\u2713") + copiedMsg;
        setTimeout(function () { btnEl.textContent = original; }, 1500);
      }
    });
  }

  return {
    escapeHtml: escapeHtml,
    markdownToHtml: markdownToHtml,
    copyWithFeedback: copyWithFeedback
  };
})();
