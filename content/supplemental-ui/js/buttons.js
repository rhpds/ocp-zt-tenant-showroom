(function () {
  'use strict';

  // ── Send-to Terminal ──────────────────────────────────────────────────────
  // Adds a ▶ button to any code block with role="send-to".
  // Sends the command to the wetty iframe via postMessage.
  // Falls back to clipboard copy if wetty is not found.

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
    } catch (e) {
      console.log('[Send-To] Cannot access parent:', e.message);
    }

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

  // ── Solve Button ──────────────────────────────────────────────────────────
  // Finds all .solve-button-placeholder divs and replaces them with a
  // Solve button + terminal-style output panel.
  // The placeholder must have a data-module attribute.

  function initSolve() {
    document.querySelectorAll('.solve-button-placeholder').forEach(function (p) {
      var moduleName = p.getAttribute('data-module');
      var section = document.createElement('div');
      section.className = 'btn-section';
      section.innerHTML =
        '<div class="btn-controls">' +
          '<button class="solve-btn" data-module="' + moduleName + '">🚀 Solve Module</button>' +
        '</div>' +
        '<div class="btn-output" id="solve-output-' + moduleName + '" style="display:none;">' +
          '<pre class="btn-output-content" id="solve-output-content-' + moduleName + '"></pre>' +
        '</div>';
      p.replaceWith(section);
    });

    document.querySelectorAll('.solve-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { runStream('solve', this.getAttribute('data-module')); });
    });
  }

  // ── Validate Button ───────────────────────────────────────────────────────
  // Same pattern as Solve but calls /stream/validate/{module}.

  function initValidate() {
    document.querySelectorAll('.validate-button-placeholder').forEach(function (p) {
      var moduleName = p.getAttribute('data-module');
      var section = document.createElement('div');
      section.className = 'btn-section';
      section.innerHTML =
        '<div class="btn-controls">' +
          '<button class="validate-btn" data-module="' + moduleName + '">✓ Validate Module</button>' +
        '</div>' +
        '<div class="btn-output" id="validate-output-' + moduleName + '" style="display:none;">' +
          '<pre class="btn-output-content" id="validate-output-content-' + moduleName + '"></pre>' +
        '</div>';
      p.replaceWith(section);
    });

    document.querySelectorAll('.validate-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { runStream('validate', this.getAttribute('data-module')); });
    });
  }

  // ── Shared SSE stream runner ──────────────────────────────────────────────

  function runStream(stage, moduleName) {
    var outputEl = document.getElementById(stage + '-output-' + moduleName);
    var contentEl = document.getElementById(stage + '-output-content-' + moduleName);
    var btn = document.querySelector('.' + stage + '-btn[data-module="' + moduleName + '"]');

    outputEl.style.display = 'block';
    contentEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '⏳ Running...';

    var es = new EventSource('/stream/' + stage + '/' + moduleName);

    es.onmessage = function (event) {
      if (event.data === '__DONE__') {
        es.close();
        btn.disabled = false;
        btn.textContent = stage === 'solve' ? '🚀 Solve Module' : '✓ Validate Module';
        return;
      }
      try { contentEl.textContent += JSON.parse(event.data); }
      catch (x) { contentEl.textContent += event.data + '\n'; }
      outputEl.scrollTop = outputEl.scrollHeight;
    };

    es.onerror = function () {
      es.close();
      btn.disabled = false;
      btn.textContent = stage === 'solve' ? '🚀 Solve Module' : '✓ Validate Module';
      contentEl.textContent += '\n❌ Connection closed\n';
    };
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
