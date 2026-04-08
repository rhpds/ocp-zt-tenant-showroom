(function () {
  'use strict';

  // ── Send-to Terminal ──────────────────────────────────────────────────────

  function initSendTo() {
    document.querySelectorAll('pre.send-to, .send-to').forEach(function (block) {
      if (block.dataset.sendToButtonAdded) return;
      var listingBlock = block.closest('.listingblock');
      if (!listingBlock) return;

      var btn = document.createElement('button');
      btn.className = 'send-to-command-btn';
      btn.innerHTML = '▶';
      btn.onclick = function () {
        var cmd = (block.querySelector('code') || block).textContent.trim();
        sendToTerminal(cmd, btn);
      };
      listingBlock.appendChild(btn);
      block.dataset.sendToButtonAdded = 'true';
    });
  }

  function sendToTerminal(command, button) {
    var wettyFrame = null;
    try {
      if (window.parent && window.parent !== window) {
        var frames = window.parent.document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          var src = frames[i].src || '';
          if (src.indexOf('/wetty') !== -1 || src.indexOf('/tty') !== -1) {
            wettyFrame = frames[i];
            break;
          }
        }
      }
    } catch (e) { console.log('[Send-To] Cannot access parent:', e.message); }

    var original = button.innerHTML;
    if (wettyFrame) {
      wettyFrame.contentWindow.postMessage({ type: 'execute', data: command + '\r' }, '*');
      button.classList.add('success');
      button.innerHTML = '✓ Sent!';
      setTimeout(function () { button.classList.remove('success'); button.innerHTML = original; }, 2000);
    } else {
      navigator.clipboard.writeText(command).then(function () {
        button.classList.add('copied');
        button.innerHTML = '📋 Copied!';
        setTimeout(function () { button.classList.remove('copied'); button.innerHTML = original; }, 2000);
      }).catch(function () { button.innerHTML = '✗ Failed'; });
    }
  }

  // ── Solve / Validate buttons ──────────────────────────────────────────────

  function initSolve() {
    document.querySelectorAll('.solve-button-placeholder').forEach(function (p) {
      var m = p.getAttribute('data-module');
      var wrap = document.createElement('div');
      wrap.className = 'btn-section';
      wrap.innerHTML = '<button class="solve-btn" data-module="' + m + '">🚀 Solve Module</button>';
      p.replaceWith(wrap);
    });
    document.querySelectorAll('.solve-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { runStream('solve', this.getAttribute('data-module')); });
    });
  }

  function initValidate() {
    document.querySelectorAll('.validate-button-placeholder').forEach(function (p) {
      var m = p.getAttribute('data-module');
      var wrap = document.createElement('div');
      wrap.className = 'btn-section';
      wrap.innerHTML = '<button class="validate-btn" data-module="' + m + '">✓ Validate Module</button>';
      p.replaceWith(wrap);
    });
    document.querySelectorAll('.validate-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { runStream('validate', this.getAttribute('data-module')); });
    });
  }

  // ── SSE stream runner — collects output, shows popup on completion ─────────

  function runStream(stage, moduleName) {
    var btn = document.querySelector('.' + stage + '-btn[data-module="' + moduleName + '"]');
    var label = stage === 'solve' ? '🚀 Solve Module' : '✓ Validate Module';

    btn.disabled = true;
    btn.textContent = '⏳ Running...';

    var rawLines = [];
    var es = new EventSource('/stream/' + stage + '/' + moduleName);

    es.onmessage = function (event) {
      if (event.data === '__DONE__') {
        es.close();
        btn.disabled = false;
        btn.textContent = label;
        showResultPopup(stage, moduleName, rawLines);
        return;
      }
      try { rawLines.push(JSON.parse(event.data)); }
      catch (x) { rawLines.push(event.data); }
    };

    es.onerror = function () {
      es.close();
      btn.disabled = false;
      btn.textContent = label;
      rawLines.push('\n❌ Connection closed\n');
      showResultPopup(stage, moduleName, rawLines);
    };
  }

  // ── Result popup ──────────────────────────────────────────────────────────

  function parseResults(lines) {
    var tasks = [];
    var passed = null; // true = all pass, false = some fail, null = unknown

    lines.forEach(function (line) {
      // validation_check pass/fail lines
      if (/^✅/.test(line.trim())) tasks.push({ ok: true,  text: line.trim() });
      if (/^❌/.test(line.trim())) tasks.push({ ok: false, text: line.trim() });
      // summary line
      if (/Completed successfully|SUCCESS 0/i.test(line)) passed = true;
      if (/\bFailed\b|\bFAILED\b|\bfailed\b/.test(line) && !/fix:/i.test(line)) {
        if (passed !== true) passed = false;
      }
    });

    // fallback: derive from tasks list
    if (passed === null && tasks.length > 0) {
      passed = tasks.every(function (t) { return t.ok; });
    }

    return { tasks: tasks, passed: passed };
  }

  function showResultPopup(stage, moduleName, rawLines) {
    // Remove any existing popup
    var existing = document.getElementById('rhdp-result-popup');
    if (existing) existing.remove();

    var result = parseResults(rawLines);
    var isSolve = stage === 'solve';

    // Determine overall status
    var statusIcon, statusText, statusClass;
    if (isSolve) {
      // Solve: passed if no error lines
      var hasError = rawLines.some(function (l) { return /\bfailed\b|\bFATAL\b/i.test(l) && !/fix:/i.test(l); });
      statusIcon = hasError ? '❌' : '✅';
      statusText = hasError ? 'Solve failed' : 'Solve completed';
      statusClass = hasError ? 'popup-fail' : 'popup-pass';
    } else {
      statusIcon = result.passed === false ? '❌' : result.passed === true ? '✅' : '⚠️';
      statusText = result.passed === false ? 'Validation failed' : result.passed === true ? 'All checks passed' : 'Completed';
      statusClass = result.passed === false ? 'popup-fail' : result.passed === true ? 'popup-pass' : 'popup-warn';
    }

    var tasksHtml = '';
    if (result.tasks.length > 0) {
      tasksHtml = '<ul class="popup-tasks">' +
        result.tasks.map(function (t) {
          return '<li class="popup-task ' + (t.ok ? 'task-pass' : 'task-fail') + '">' + escHtml(t.text) + '</li>';
        }).join('') +
        '</ul>';
    }

    var rawHtml = '<details class="popup-logs"><summary>Show full logs</summary>' +
      '<pre class="popup-log-content">' + escHtml(rawLines.join('')) + '</pre></details>';

    var popup = document.createElement('div');
    popup.id = 'rhdp-result-popup';
    popup.className = 'popup-overlay';
    popup.innerHTML =
      '<div class="popup-card ' + statusClass + '">' +
        '<button class="popup-close" aria-label="Close">✕</button>' +
        '<div class="popup-status">' +
          '<span class="popup-icon">' + statusIcon + '</span>' +
          '<span class="popup-status-text">' + escHtml(statusText) + '</span>' +
        '</div>' +
        '<div class="popup-module">Module: ' + escHtml(moduleName) + '</div>' +
        tasksHtml +
        rawHtml +
      '</div>';

    document.body.appendChild(popup);

    // Close handlers
    popup.querySelector('.popup-close').addEventListener('click', function () { popup.remove(); });
    popup.addEventListener('click', function (e) { if (e.target === popup) popup.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { popup.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function init() {
    initSendTo();
    initSolve();
    initValidate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
