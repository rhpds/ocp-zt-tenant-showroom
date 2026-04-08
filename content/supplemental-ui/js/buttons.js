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
            wettyFrame = frames[i]; break;
          }
        }
      }
    } catch (e) { console.log('[Send-To] Cannot access parent:', e.message); }
    var original = button.innerHTML;
    if (wettyFrame) {
      wettyFrame.contentWindow.postMessage({ type: 'execute', data: command + '\r' }, '*');
      button.classList.add('success'); button.innerHTML = '✓ Sent!';
      setTimeout(function () { button.classList.remove('success'); button.innerHTML = original; }, 2000);
    } else {
      navigator.clipboard.writeText(command).then(function () {
        button.classList.add('copied'); button.innerHTML = '📋 Copied!';
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
      btn.addEventListener('click', function () { runStream('solve', this.getAttribute('data-module'), this.closest('.btn-section')); });
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
      btn.addEventListener('click', function () { runStream('validate', this.getAttribute('data-module'), this.closest('.btn-section')); });
    });
  }

  // ── Live panel ────────────────────────────────────────────────────────────

  function runStream(stage, moduleName, section) {
    var btn = section.querySelector('.' + stage + '-btn');
    var label = stage === 'solve' ? '🚀 Solve Module' : '✓ Validate Module';

    // Remove existing panel if re-running
    var old = section.querySelector('.stream-panel');
    if (old) old.remove();

    // Create two-column live panel
    var panel = document.createElement('div');
    panel.className = 'stream-panel';
    panel.innerHTML =
      '<div class="stream-status" id="sp-status-' + moduleName + '">' +
        '<span class="sp-spinner">⏳ Running</span>' +
      '</div>' +
      '<div class="stream-body">' +
        '<div class="stream-steps" id="sp-steps-' + moduleName + '">' +
          '<div class="sp-steps-label">Steps</div>' +
          '<ul class="sp-step-list" id="sp-list-' + moduleName + '"></ul>' +
        '</div>' +
        '<div class="stream-logs">' +
          '<div class="sp-logs-label">Full logs</div>' +
          '<pre class="sp-log-content" id="sp-log-' + moduleName + '"></pre>' +
        '</div>' +
      '</div>';
    section.appendChild(panel);

    btn.disabled = true;
    btn.textContent = '⏳ Running...';

    var stepList  = document.getElementById('sp-list-' + moduleName);
    var logEl     = document.getElementById('sp-log-' + moduleName);
    var statusEl  = document.getElementById('sp-status-' + moduleName);

    // State for solve step tracking
    var currentTask = null;
    var pendingLi   = null;

    var es = new EventSource('/stream/' + stage + '/' + moduleName);

    es.onmessage = function (event) {
      if (event.data === '__DONE__') {
        es.close();
        btn.disabled = false;
        btn.textContent = label;
        finalize(stage, statusEl, stepList, logEl);
        return;
      }

      var line = '';
      try { line = JSON.parse(event.data); } catch (x) { line = event.data; }

      // ── Append to full log ──
      logEl.textContent += line;
      logEl.scrollTop = logEl.scrollHeight;

      // ── Update steps live ──
      if (stage === 'solve') {
        parseSolveLine(line, stepList, { currentTask: currentTask, pendingLi: pendingLi },
          function (state) { currentTask = state.currentTask; pendingLi = state.pendingLi; });
      } else {
        parseValidateLine(line, stepList);
      }
    };

    es.onerror = function () {
      es.close();
      btn.disabled = false;
      btn.textContent = label;
      logEl.textContent += '\n❌ Connection closed\n';
      finalize(stage, statusEl, stepList, logEl);
    };
  }

  // ── Live solve parser ─────────────────────────────────────────────────────
  // Tracks TASK [name] → ok/changed/failed lines and updates step chips live.

  function parseSolveLine(line, stepList, state, setState) {
    var taskMatch = line.match(/^TASK \[([^\]]+)\]/);
    if (taskMatch) {
      var name = taskMatch[1].trim();
      if (/^Gathering Facts$/i.test(name)) { setState({ currentTask: null, pendingLi: null }); return; }
      // Add a pending step chip
      var li = document.createElement('li');
      li.className = 'sp-step sp-step-pending';
      li.textContent = '⏳ ' + name;
      stepList.appendChild(li);
      setState({ currentTask: name, pendingLi: li });
      return;
    }
    if (!state.pendingLi) return;

    if (/^ok:\s*\[/.test(line)) {
      state.pendingLi.className = 'sp-step sp-step-ok';
      state.pendingLi.textContent = '✓ ' + state.currentTask;
      setState({ currentTask: null, pendingLi: null });
    } else if (/^changed:\s*\[/.test(line)) {
      state.pendingLi.className = 'sp-step sp-step-changed';
      state.pendingLi.textContent = '🔄 ' + state.currentTask;
      setState({ currentTask: null, pendingLi: null });
    } else if (/^fatal:|^failed:\s*\[/i.test(line)) {
      state.pendingLi.className = 'sp-step sp-step-fail';
      state.pendingLi.textContent = '✗ ' + state.currentTask;
      setState({ currentTask: null, pendingLi: null });
    } else if (/^skipping:/i.test(line)) {
      state.pendingLi.remove();
      setState({ currentTask: null, pendingLi: null });
    }
  }

  // ── Live validate parser ──────────────────────────────────────────────────
  // Adds ✅/❌ chips as validation_check lines stream in.

  function parseValidateLine(line, stepList) {
    var t = line.trim();
    if (/^✅/.test(t)) {
      var li = document.createElement('li');
      li.className = 'sp-step sp-step-ok';
      li.textContent = t;
      stepList.appendChild(li);
    } else if (/^❌/.test(t)) {
      var li2 = document.createElement('li');
      li2.className = 'sp-step sp-step-fail';
      li2.textContent = t;
      stepList.appendChild(li2);
    }
  }

  // ── Finalize status banner ────────────────────────────────────────────────

  function finalize(stage, statusEl, stepList, logEl) {
    var steps = stepList.querySelectorAll('.sp-step');
    var hasFail = stepList.querySelector('.sp-step-fail');
    var hasPending = stepList.querySelector('.sp-step-pending');
    if (hasPending) { hasPending.className = 'sp-step sp-step-fail'; hasPending.textContent = '✗ ' + hasPending.textContent.replace('⏳ ', ''); }

    var passed = !hasFail;
    var icon   = passed ? '✅' : '❌';
    var text   = stage === 'solve'
      ? (passed ? 'Solve completed' : 'Solve failed')
      : (passed ? 'All checks passed' : 'Validation failed');
    var cls    = passed ? 'sp-status-pass' : 'sp-status-fail';

    statusEl.innerHTML = '<span class="' + cls + '">' + icon + ' ' + escHtml(text) + '</span>';
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function init() { initSendTo(); initSolve(); initValidate(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
