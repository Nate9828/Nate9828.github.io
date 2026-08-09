/* ==========================================================================
   DEBUG MODE CONTROLS (Escape Mode & Assault Mode)
   ========================================================================== */

/**
 * Initializes Escape Mode Debug Controls dropdown and HUD trigger.
 */
function initEscapeDebugControls() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('escape-debug-dropdown')) return;

    // 1. Inject debug styles
    const debugStyle = document.createElement('style');
    debugStyle.id = 'escape-debug-styles';
    debugStyle.textContent = `
    .mode-tag { position: relative; }
    .debug-invisible-btn {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      border: none;
      background: transparent;
      z-index: 30;
      padding: 0;
      margin: 0;
    }
    #escape-debug-dropdown {
      position: fixed;
      top: 58px;
      right: 18px;
      width: 260px;
      background: rgba(8, 12, 26, 0.96);
      border: 1px solid var(--energy);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(255, 176, 32, 0.3);
      backdrop-filter: blur(12px);
      z-index: 9999;
      font-family: var(--font-display);
      color: #eef1fa;
      display: flex;
      flex-direction: column;
      gap: 12px;
      user-select: none;
    }
    #escape-debug-dropdown.hidden {
      display: none !important;
    }
    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 8px;
    }
    .debug-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--energy);
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .debug-close-btn {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 16px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .debug-close-btn:hover { color: #ffffff; }
    .debug-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .debug-section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-dim);
      font-weight: 600;
    }
    .debug-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
    }
    .debug-label b {
      color: var(--energy);
    }
    .debug-btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .debug-btn {
      background: rgba(255, 176, 32, 0.18);
      border: 1px solid var(--energy);
      color: #ffffff;
      border-radius: 6px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
      font-family: var(--font-display);
      padding: 0;
      line-height: 1;
    }
    .debug-btn:hover { background: rgba(255, 176, 32, 0.38); transform: translateY(-1px); }
    .debug-btn:active { transform: translateY(1px); }
    .debug-zone-group {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .debug-wave-btn {
      background: rgba(124, 92, 255, 0.18);
      border: 1px solid var(--hazard-2);
      color: #ffffff;
      border-radius: 8px;
      padding: 8px 4px;
      font-family: var(--font-display);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s ease, transform 0.1s ease;
    }
    .debug-wave-btn:hover { background: rgba(124, 92, 255, 0.38); transform: translateY(-1px); }
    .debug-wave-btn:active { transform: translateY(1px); }
  `;
    document.head.appendChild(debugStyle);

    // 2. Create Debug Dropdown DOM
    const dropdown = document.createElement('div');
    dropdown.id = 'escape-debug-dropdown';
    dropdown.className = 'debug-dropdown hidden';
    dropdown.innerHTML = `
    <div class="debug-header">
      <span class="debug-title">🛠️ Debug Controls</span>
      <button id="escape-debug-close-btn" class="debug-close-btn" type="button">✕</button>
    </div>
    
    <div class="debug-section">
      <div class="debug-section-title">ZONE CONTROL</div>
      
      <div class="debug-row">
        <span class="debug-label">🌐 Current Zone: <b id="escape-debug-val-zone">1</b></span>
        <div class="debug-btn-group">
          <button type="button" class="debug-btn" id="escape-debug-zone-dec">-</button>
          <button type="button" class="debug-btn" id="escape-debug-zone-inc">+</button>
        </div>
      </div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">ZONE JUMP</div>
      <div class="debug-zone-group">
        <button type="button" class="debug-wave-btn" id="escape-debug-zone-3">Zone 3</button>
        <button type="button" class="debug-wave-btn" id="escape-debug-zone-5">Zone 5</button>
        <button type="button" class="debug-wave-btn" id="escape-debug-zone-6">Zone 6</button>
      </div>
    </div>
  `;
    document.body.appendChild(dropdown);

    // Prevent input bubbling to game controls
    const stopProp = (e) => { e.stopPropagation(); };
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup', 'click'].forEach(evt => {
        dropdown.addEventListener(evt, stopProp);
    });

    // Helper to update debug UI values
    function updateDebugUI() {
        const zEl = document.getElementById('escape-debug-val-zone');
        if (zEl && typeof escapeGame !== 'undefined') {
            zEl.textContent = (escapeGame.currentZoneIdx || 0) + 1;
        }
    }

    // Event handlers
    document.getElementById('escape-debug-close-btn').addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });

    document.getElementById('escape-debug-zone-dec').addEventListener('click', () => {
        if (typeof escapeGame === 'undefined') return;
        const currentZoneNum = (escapeGame.currentZoneIdx || 0) + 1;
        const targetZone = Math.max(1, currentZoneNum - 1);
        if (typeof escapeGame.jumpToZone === 'function') escapeGame.jumpToZone(targetZone);
        updateDebugUI();
    });

    document.getElementById('escape-debug-zone-inc').addEventListener('click', () => {
        if (typeof escapeGame === 'undefined') return;
        const currentZoneNum = (escapeGame.currentZoneIdx || 0) + 1;
        const targetZone = currentZoneNum + 1;
        if (typeof escapeGame.jumpToZone === 'function') escapeGame.jumpToZone(targetZone);
        updateDebugUI();
    });

    document.getElementById('escape-debug-zone-3').addEventListener('click', () => {
        if (typeof escapeGame !== 'undefined' && typeof escapeGame.jumpToZone === 'function') {
            escapeGame.jumpToZone(3);
        }
        updateDebugUI();
    });

    document.getElementById('escape-debug-zone-5').addEventListener('click', () => {
        if (typeof escapeGame !== 'undefined' && typeof escapeGame.jumpToZone === 'function') {
            escapeGame.jumpToZone(5);
        }
        updateDebugUI();
    });

    document.getElementById('escape-debug-zone-6').addEventListener('click', () => {
        if (typeof escapeGame !== 'undefined' && typeof escapeGame.jumpToZone === 'function') {
            escapeGame.jumpToZone(6);
        }
        updateDebugUI();
    });

    // Attach direct click handler to mode tag badge (ZONE #: NAME)
    function attachDebugTrigger() {
        const modeTag = document.getElementById('escape-zone-tag') || document.getElementById('mode-tag') || document.querySelector('.mode-tag');
        if (!modeTag) return;

        modeTag.style.cursor = 'pointer';
        modeTag.style.pointerEvents = 'auto';

        if (!modeTag.dataset.escapeDebugBound) {
            modeTag.dataset.escapeDebugBound = 'true';
            modeTag.addEventListener('click', (e) => {
                if (typeof mode !== 'undefined' && mode !== 'escape') return;
                e.stopPropagation();
                e.preventDefault();
                dropdown.classList.toggle('hidden');
                updateDebugUI();
            });
            ['pointerdown', 'mousedown', 'touchstart'].forEach(evt => {
                modeTag.addEventListener(evt, stopProp);
            });
        }
    }

    // Hook renderHUD
    const originalRenderHUD = window.renderHUD;
    if (typeof originalRenderHUD === 'function') {
        window.renderHUD = function () {
            originalRenderHUD.apply(this, arguments);
            if (typeof mode !== 'undefined' && mode === 'escape') {
                attachDebugTrigger();
            }
        };
    }

    // Poller backup
    setInterval(() => {
        if (typeof mode !== 'undefined' && mode === 'escape') {
            attachDebugTrigger();
        }
    }, 500);
}

/**
 * Initializes Assault Mode Debug Controls dropdown and HUD trigger.
 */
function initAssaultDebugControls() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('debug-dropdown')) return;

    // 1. Inject debug styles
    const debugStyle = document.createElement('style');
    debugStyle.id = 'assault-debug-styles';
    debugStyle.textContent = `
    #hud-wave-chip { position: relative; cursor: pointer; }
    .debug-wave-trigger-btn {
      position: absolute;
      top: -18px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(8, 12, 26, 0.92);
      border: 1px solid var(--energy);
      color: var(--energy);
      font-size: 9.5px;
      font-weight: 700;
      font-family: var(--font-display);
      letter-spacing: 0.08em;
      padding: 1px 6px;
      border-radius: 4px;
      cursor: pointer;
      z-index: 35;
      white-space: nowrap;
      box-shadow: 0 0 8px rgba(255, 176, 32, 0.35);
      transition: all 0.15s ease;
      line-height: 1.2;
    }
    .debug-wave-trigger-btn:hover {
      background: rgba(255, 176, 32, 0.35);
      color: #ffffff;
      box-shadow: 0 0 14px rgba(255, 176, 32, 0.6);
    }
    #debug-dropdown {
      position: fixed;
      top: 68px;
      left: 14px;
      width: 260px;
      background: rgba(8, 12, 26, 0.96);
      border: 1px solid var(--energy);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(255, 176, 32, 0.3);
      backdrop-filter: blur(12px);
      z-index: 9999;
      font-family: var(--font-display);
      color: #eef1fa;
      display: flex;
      flex-direction: column;
      gap: 12px;
      user-select: none;
    }
    #debug-dropdown.hidden {
      display: none !important;
    }
    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 8px;
    }
    .debug-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--energy);
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .debug-close-btn {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 16px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .debug-close-btn:hover { color: #ffffff; }
    .debug-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .debug-section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-dim);
      font-weight: 600;
    }
    .debug-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
    }
    .debug-label b {
      color: var(--energy);
    }
    .debug-btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .debug-btn {
      background: rgba(255, 176, 32, 0.18);
      border: 1px solid var(--energy);
      color: #ffffff;
      border-radius: 6px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
      font-family: var(--font-display);
      padding: 0;
      line-height: 1;
    }
    .debug-btn:hover { background: rgba(255, 176, 32, 0.38); transform: translateY(-1px); }
    .debug-btn:active { transform: translateY(1px); }
    .debug-wave-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .debug-wave-btn {
      background: rgba(124, 92, 255, 0.18);
      border: 1px solid var(--hazard-2);
      color: #ffffff;
      border-radius: 8px;
      padding: 8px 4px;
      font-family: var(--font-display);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: background 0.15s ease, transform 0.1s ease;
    }
    .debug-wave-btn:hover { background: rgba(124, 92, 255, 0.38); transform: translateY(-1px); }
    .debug-wave-btn:active { transform: translateY(1px); }
  `;
    document.head.appendChild(debugStyle);

    // 2. Create Debug Dropdown DOM
    const dropdown = document.createElement('div');
    dropdown.id = 'debug-dropdown';
    dropdown.className = 'debug-dropdown hidden';
    dropdown.innerHTML = `
    <div class="debug-header">
      <span class="debug-title">🛠️ Debug Controls</span>
      <button id="debug-close-btn" class="debug-close-btn" type="button">✕</button>
    </div>
    
    <div class="debug-section">
      <div class="debug-section-title">WAVE CONTROL</div>
      
      <div class="debug-row">
        <span class="debug-label">🌊 Current Wave: <b id="debug-val-wave">1</b></span>
        <div class="debug-btn-group">
          <button type="button" class="debug-btn" id="debug-wave-dec">-</button>
          <button type="button" class="debug-btn" id="debug-wave-inc">+</button>
        </div>
      </div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">FREE UPGRADES</div>
      
      <div class="debug-row">
        <span class="debug-label">⚡ Rate Lvl: <b id="debug-val-rate">1</b></span>
        <div class="debug-btn-group">
          <button type="button" class="debug-btn" id="debug-rate-dec">-</button>
          <button type="button" class="debug-btn" id="debug-rate-inc">+</button>
        </div>
      </div>
      
      <div class="debug-row">
        <span class="debug-label">💥 Spread Lvl: <b id="debug-val-spread">1</b></span>
        <div class="debug-btn-group">
          <button type="button" class="debug-btn" id="debug-spread-dec">-</button>
          <button type="button" class="debug-btn" id="debug-spread-inc">+</button>
        </div>
      </div>
      
      <div class="debug-row">
        <span class="debug-label">🛡️ Fortify Lvl: <b id="debug-val-laser">1</b></span>
        <div class="debug-btn-group">
          <button type="button" class="debug-btn" id="debug-laser-dec">-</button>
          <button type="button" class="debug-btn" id="debug-laser-inc">+</button>
        </div>
      </div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">WAVE JUMP</div>
      <div class="debug-wave-group">
        <button type="button" class="debug-wave-btn" id="debug-wave-3">Wave 3</button>
        <button type="button" class="debug-wave-btn" id="debug-wave-boss">Boss (W4)</button>
        <button type="button" class="debug-wave-btn" id="debug-wave-10">Wave 10</button>
        <button type="button" class="debug-wave-btn" id="debug-wave-20">Wave 20</button>
      </div>
    </div>
  `;
    document.body.appendChild(dropdown);

    // Prevent input bubbling to game controls
    const stopProp = (e) => { e.stopPropagation(); };
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup', 'click'].forEach(evt => {
        dropdown.addEventListener(evt, stopProp);
    });

    // Helper to update debug UI values
    function updateDebugUI() {
        const r = document.getElementById('debug-val-rate');
        const s = document.getElementById('debug-val-spread');
        const l = document.getElementById('debug-val-laser');
        const w = document.getElementById('debug-val-wave');
        if (typeof assault !== 'undefined') {
            if (r) r.textContent = assault.fireRateLevel || 1;
            if (s) s.textContent = assault.multishotLevel || 1;
            if (l) l.textContent = assault.fortifyLevel || 1;
            if (w) w.textContent = assault.wave || 1;
        }
    }

    // Event handlers
    document.getElementById('debug-close-btn').addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });

    document.getElementById('debug-wave-dec').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        ensureAssaultJumpToWave();
        const currentWave = assault.wave || 1;
        const targetWave = Math.max(1, currentWave - 1);
        if (typeof assault.jumpToWave === 'function') {
            assault.jumpToWave(targetWave);
        }
        updateDebugUI();
    });

    document.getElementById('debug-wave-inc').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        ensureAssaultJumpToWave();
        const currentWave = assault.wave || 1;
        const maxWave = assault.selectedDifficulty === 'endless' ? 999 : 4;
        const targetWave = Math.min(maxWave, currentWave + 1);
        if (typeof assault.jumpToWave === 'function') {
            assault.jumpToWave(targetWave);
        }
        updateDebugUI();
    });

    document.getElementById('debug-rate-dec').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        assault.fireRateLevel = Math.max(1, Math.min(3, (assault.fireRateLevel || 1) - 1));
        if (typeof renderAssaultHUDNumbers === 'function') renderAssaultHUDNumbers();
        updateDebugUI();
    });
    document.getElementById('debug-rate-inc').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        assault.fireRateLevel = Math.max(1, Math.min(3, (assault.fireRateLevel || 1) + 1));
        if (typeof renderAssaultHUDNumbers === 'function') renderAssaultHUDNumbers();
        updateDebugUI();
    });

    document.getElementById('debug-spread-dec').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        assault.multishotLevel = Math.max(1, Math.min(3, (assault.multishotLevel || 1) - 1));
        if (typeof renderAssaultHUDNumbers === 'function') renderAssaultHUDNumbers();
        updateDebugUI();
    });
    document.getElementById('debug-spread-inc').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        assault.multishotLevel = Math.max(1, Math.min(3, (assault.multishotLevel || 1) + 1));
        if (typeof renderAssaultHUDNumbers === 'function') renderAssaultHUDNumbers();
        updateDebugUI();
    });

    document.getElementById('debug-laser-dec').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        assault.fortifyLevel = Math.max(1, Math.min(3, (assault.fortifyLevel || 1) - 1));
        assault.maxHealth = assault.fortifyLevel === 1 ? 100 : (assault.fortifyLevel === 2 ? 150 : 200);
        assault.health = Math.min(assault.maxHealth, assault.health);
        if (typeof renderAssaultHUDNumbers === 'function') renderAssaultHUDNumbers();
        updateDebugUI();
    });
    document.getElementById('debug-laser-inc').addEventListener('click', () => {
        if (typeof assault === 'undefined') return;
        assault.fortifyLevel = Math.max(1, Math.min(3, (assault.fortifyLevel || 1) + 1));
        assault.maxHealth = assault.fortifyLevel === 1 ? 100 : (assault.fortifyLevel === 2 ? 150 : 200);
        assault.health = Math.min(assault.maxHealth, assault.health + 50);
        if (typeof renderAssaultHUDNumbers === 'function') renderAssaultHUDNumbers();
        updateDebugUI();
    });

    // Wave Jump helper logic
    function ensureAssaultJumpToWave() {
        if (typeof assault !== 'undefined' && !assault.jumpToWave) {
            assault.jumpToWave = function (w) {
                if (this.state !== 'playing') this.state = 'playing';
                if (typeof overlay !== 'undefined' && overlay) overlay.classList.add('hidden');
                this.wave = w;
                if (typeof this.checkHighestWave === 'function') this.checkHighestWave();
                this.enemies = [];
                this.missiles = [];
                this.enemyBolts = [];
                this.bolts = [];
                this.drops = [];
                this.particles = [];
                if (typeof removeBossHUD === 'function') removeBossHUD();
                if (typeof this.beginWave === 'function') this.beginWave();
                if (typeof renderHUD === 'function') renderHUD();
                if (typeof renderAssaultHUDNumbers === 'function') renderAssaultHUDNumbers();
            };
        }
    }

    document.getElementById('debug-wave-3').addEventListener('click', () => {
        ensureAssaultJumpToWave();
        if (typeof assault !== 'undefined' && typeof assault.jumpToWave === 'function') {
            assault.jumpToWave(3);
        }
        updateDebugUI();
    });

    document.getElementById('debug-wave-boss').addEventListener('click', () => {
        ensureAssaultJumpToWave();
        if (typeof assault !== 'undefined' && typeof assault.jumpToWave === 'function') {
            assault.jumpToWave(4);
        }
        updateDebugUI();
    });

    const w10Btn = document.getElementById('debug-wave-10');
    if (w10Btn) {
        w10Btn.addEventListener('click', () => {
            ensureAssaultJumpToWave();
            if (typeof assault !== 'undefined' && typeof assault.jumpToWave === 'function') {
                assault.jumpToWave(10);
            }
            updateDebugUI();
        });
    }

    const w20Btn = document.getElementById('debug-wave-20');
    if (w20Btn) {
        w20Btn.addEventListener('click', () => {
            ensureAssaultJumpToWave();
            if (typeof assault !== 'undefined' && typeof assault.jumpToWave === 'function') {
                assault.jumpToWave(20);
            }
            updateDebugUI();
        });
    }

    // Attach debug trigger button directly above Wave HUD button
    function attachDebugToWaveChip() {
        const waveChip = document.getElementById('hud-wave-chip') || (document.getElementById('hv-wave') ? document.getElementById('hv-wave').closest('.hud-chip') : null);
        if (!waveChip) return;

        waveChip.style.position = 'relative';
        waveChip.style.cursor = 'pointer';

        if (!waveChip.dataset.assaultDebugBound) {
            waveChip.dataset.assaultDebugBound = 'true';
            waveChip.addEventListener('click', (e) => {
                if (typeof mode !== 'undefined' && mode !== 'assault') return;
                e.stopPropagation();
                e.preventDefault();
                dropdown.classList.toggle('hidden');
                updateDebugUI();
            });
            ['pointerdown', 'mousedown', 'touchstart'].forEach(evt => {
                waveChip.addEventListener(evt, stopProp);
            });
        }

        let debugBtn = document.getElementById('assault-debug-trigger-btn');
        if (!debugBtn) {
            debugBtn = document.createElement('button');
            debugBtn.id = 'assault-debug-trigger-btn';
            debugBtn.className = 'debug-wave-trigger-btn';
            debugBtn.type = 'button';
            debugBtn.textContent = '🛠️ DEBUG';
            debugBtn.setAttribute('aria-label', 'Debug Controls Trigger');

            debugBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (typeof mode !== 'undefined' && mode !== 'assault') return;
                dropdown.classList.toggle('hidden');
                updateDebugUI();
            });
            ['pointerdown', 'mousedown', 'touchstart'].forEach(evt => {
                debugBtn.addEventListener(evt, stopProp);
            });
        }

        if (!waveChip.contains(debugBtn)) {
            waveChip.appendChild(debugBtn);
        }
    }

    // Hook renderHUD
    const originalRenderHUD = window.renderHUD;
    if (typeof originalRenderHUD === 'function') {
        window.renderHUD = function () {
            originalRenderHUD.apply(this, arguments);
            if (typeof mode !== 'undefined' && mode === 'assault') {
                attachDebugToWaveChip();
            }
        };
    }

    // Poller backup
    setInterval(() => {
        if (typeof mode !== 'undefined' && mode === 'assault') {
            attachDebugToWaveChip();
        }
    }, 500);
}

// Global exports for browser and node environments
if (typeof window !== 'undefined') {
    window.initEscapeDebugControls = initEscapeDebugControls;
    window.initAssaultDebugControls = initAssaultDebugControls;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initEscapeDebugControls, initAssaultDebugControls };
}

// Auto-initialize controls when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initEscapeDebugControls();
            initAssaultDebugControls();
        });
    } else {
        initEscapeDebugControls();
        initAssaultDebugControls();
    }
}