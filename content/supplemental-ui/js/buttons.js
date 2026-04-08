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

  // Parse validate output — extracts ✅/❌ lines from validation_check
  function parseValidateResults(lines) {
    var tasks = [];
    var passed = null;

    lines.forEach(function (line) {
      var t = line.trim();
      if (/^✅/.test(t)) tasks.push({ ok: true,  text: t });
      if (/^❌/.test(t)) tasks.push({ ok: false, text: t });
      if (/Completed successfully|SUCCESS 0/i.test(line)) passed = true;
      if (/\bFailed\b|\bFAILED\b/.test(line) && !/fix:/i.test(line)) {
        if (passed !== true) passed = false;
      }
    });

    if (passed === null && tasks.length > 0) {
      passed = tasks.every(function (t) { return t.ok; });
    }

    return { tasks: tasks, passed: passed };
  }

  // Parse solve output — extracts TASK names + ok/changed/failed status
  function parseSolveResults(lines) {
    var steps = [];
    var passed = true;
    var currentTask = null;

    lines.forEach(function (line) {
      var taskMatch = line.match(/^TASK \[([^\]]+)\]/);
      if (taskMatch) {
        currentTask = taskMatch[1].trim();
        // Skip internal Ansible housekeeping tasks
        if (/^Gathering Facts$/i.test(currentTask)) currentTask = null;
        return;
      }

      if (!currentTask) return;

      if (/^ok:\s*\[/.test(line)) {
        steps.push({ ok: true, changed: false, text: currentTask });
        currentTask = null;
      } else if (/^changed:\s*\[/.test(line)) {
        steps.push({ ok: true, changed: true, text: currentTask });
        currentTask = null;
      } else if (/^fatal:|^failed:\s*\[/i.test(line)) {
        steps.push({ ok: false, changed: false, text: currentTask });
        passed = false;
        currentTask = null;
      } else if (/^skipping:/i.test(line)) {
        currentTask = null;
      }
    });

    return { steps: steps, passed: passed };
  }

  function showResultPopup(stage, moduleName, rawLines) {
    var existing = document.getElementById('rhdp-result-popup');
    if (existing) existing.remove();

    var isSolve = stage === 'solve';
    var statusIcon, statusText, statusClass, tasksHtml;

    if (isSolve) {
      var sr = parseSolveResults(rawLines);
      statusIcon  = sr.passed ? '✅' : '❌';
      statusText  = sr.passed ? 'Solve completed' : 'Solve failed';
      statusClass = sr.passed ? 'popup-pass' : 'popup-fail';

      if (sr.steps.length > 0) {
        tasksHtml = '<ul class="popup-tasks">' +
          sr.steps.map(function (s) {
            var icon = s.ok ? (s.changed ? '🔄' : '✓') : '✗';
            var cls  = s.ok ? (s.changed ? 'task-changed' : 'task-pass') : 'task-fail';
            var note = s.ok ? (s.changed ? ' (applied)' : ' (already set)') : ' (failed)';
            return '<li class="popup-task ' + cls + '">' + icon + ' ' + escHtml(s.text) + '<span class="task-note">' + note + '</span></li>';
          }).join('') +
          '</ul>';
      } else {
        tasksHtml = '';
      }
    } else {
      var vr = parseValidateResults(rawLines);
      statusIcon  = vr.passed === false ? '❌' : vr.passed === true ? '✅' : '⚠️';
      statusText  = vr.passed === false ? 'Validation failed' : vr.passed === true ? 'All checks passed' : 'Completed';
      statusClass = vr.passed === false ? 'popup-fail' : vr.passed === true ? 'popup-pass' : 'popup-warn';

      tasksHtml = vr.tasks.length > 0
        ? '<ul class="popup-tasks">' +
            vr.tasks.map(function (t) {
              return '<li class="popup-task ' + (t.ok ? 'task-pass' : 'task-fail') + '">' + escHtml(t.text) + '</li>';
            }).join('') +
          '</ul>'
        : '';
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
