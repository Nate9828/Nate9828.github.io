/* ---------------------------------------------------------
   NOVA SHIFT - Main Engine & Shared Utilities
--------------------------------------------------------- */

/* ---------------------------------------------------------
   Utility
--------------------------------------------------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

function getComputedColor(varName) {
  if (varName.startsWith('--')) return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return varName;
}

/* ---------------------------------------------------------
   Secure LocalStorage Utility (Obfuscated + Checksum Signed)
 --------------------------------------------------------- */
const SAVE_SALT = 'NovaShift_v1_SecretSalt_99823';

function hashChecksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function xorCipher(str, key) {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    res += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return res;
}

function saveSecure(key, val) {
  try {
    const rawStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
    const chk = hashChecksum(rawStr + SAVE_SALT);
    const payload = `${chk}:${rawStr}`;
    const obfuscated = btoa(xorCipher(payload, SAVE_SALT));
    localStorage.setItem(key, obfuscated);
  } catch (e) {
    try { localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : String(val)); } catch (err) { }
  }
}

function loadSecure(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;

    try {
      const decodedPayload = xorCipher(atob(raw), SAVE_SALT);
      const colonIdx = decodedPayload.indexOf(':');
      if (colonIdx > -1) {
        const chk = decodedPayload.substring(0, colonIdx);
        const dataStr = decodedPayload.substring(colonIdx + 1);
        const expectedChk = hashChecksum(dataStr + SAVE_SALT);

        if (chk === expectedChk) {
          if (typeof defaultValue === 'number') return parseFloat(dataStr) || 0;
          if (typeof defaultValue === 'boolean') return dataStr === 'true';
          if (typeof defaultValue === 'object') return JSON.parse(dataStr);
          return dataStr;
        }
      }
    } catch (e) { }

    // Check if raw value is legacy unencoded
    if (typeof defaultValue === 'number') {
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        saveSecure(key, num);
        return num;
      }
    } else if (typeof defaultValue === 'boolean') {
      if (raw === 'true' || raw === 'false') {
        const boolVal = raw === 'true';
        saveSecure(key, boolVal);
        return boolVal;
      }
    } else if (typeof defaultValue === 'object') {
      try {
        const obj = JSON.parse(raw);
        saveSecure(key, obj);
        return obj;
      } catch (e) { }
    }

    // Tampered or invalid signature
    return defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/* ---------------------------------------------------------
   Canvas + sizing
--------------------------------------------------------- */
const bgCanvas = document.getElementById('bg');
const gCanvas = document.getElementById('game');
const bgCtx = bgCanvas.getContext('2d');
const ctx = gCanvas.getContext('2d');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  [bgCanvas, gCanvas].forEach(c => {
    c.width = W * DPR; c.height = H * DPR;
    c.style.width = W + 'px'; c.style.height = H + 'px';
  });
  bgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  initStars();
  onResizeGameplay();
}

/* ---------------------------------------------------------
   Starfield ambient background
--------------------------------------------------------- */
let stars = [];
function initStars() {
  stars = [];
  const count = Math.floor((W * H) / 9000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(0, W), y: rand(0, H),
      r: rand(0.4, 1.8),
      tw: rand(0, Math.PI * 2),
      speed: rand(0.15, 0.6)
    });
  }
}
function drawStars(dt, driftX, driftY) {
  bgCtx.clearRect(0, 0, W, H);

  let theme = 'default';
  if (mode === 'escape' && typeof escapeGame !== 'undefined' && typeof escapeGame.getBgTheme === 'function') {
    theme = escapeGame.getBgTheme();
  }

  if (theme === 'plasma') {
    const g = bgCtx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.85);
    g.addColorStop(0, 'rgba(147, 51, 234, 0.45)');
    g.addColorStop(0.5, 'rgba(79, 70, 229, 0.25)');
    g.addColorStop(1, 'rgba(5, 6, 14, 1)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, W, H);
  } else if (theme === 'cyber') {
    bgCtx.fillStyle = '#030712';
    bgCtx.fillRect(0, 0, W, H);
    bgCtx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
    bgCtx.lineWidth = 1;
    const step = 45;
    for (let x = 0; x < W; x += step) {
      bgCtx.beginPath(); bgCtx.moveTo(x, 0); bgCtx.lineTo(x, H); bgCtx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(W, y); bgCtx.stroke();
    }
  } else if (theme === 'blackhole') {
    bgCtx.fillStyle = '#04020a';
    bgCtx.fillRect(0, 0, W, H);
    const bhX = W * 0.5, bhY = H * 0.35;
    const g = bgCtx.createRadialGradient(bhX, bhY, 10, bhX, bhY, Math.max(W, H) * 0.6);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.12, 'rgba(168, 85, 247, 0.4)');
    g.addColorStop(0.35, 'rgba(79, 70, 229, 0.15)');
    g.addColorStop(1, 'rgba(4, 2, 10, 1)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, W, H);
  } else if (theme === 'cavern') {
    bgCtx.fillStyle = '#160c04';
    bgCtx.fillRect(0, 0, W, H);
    const g = bgCtx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(255, 140, 0, 0.35)');
    g.addColorStop(0.5, 'rgba(180, 50, 0, 0.18)');
    g.addColorStop(1, 'rgba(8, 4, 1, 1)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, W, H);
  } else if (theme === 'overclocked') {
    const g = bgCtx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(255, 42, 109, 0.4)');
    g.addColorStop(1, 'rgba(10, 5, 20, 1)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, W, H);
  } else {
    const g = bgCtx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(60,40,110,0.35)');
    g.addColorStop(1, 'rgba(5,6,14,0)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, W, H);
  }

  for (const s of stars) {
    s.tw += dt * 0.002;
    s.x -= driftX * s.speed * dt * 0.05;
    s.y -= driftY * s.speed * dt * 0.05;
    if (s.x < 0) s.x += W; if (s.x > W) s.x -= W;
    if (s.y < 0) s.y += H; if (s.y > H) s.y -= H;
    const a = 0.4 + Math.sin(s.tw) * 0.35;
    bgCtx.globalAlpha = clamp(a, 0.1, 0.9);
    bgCtx.fillStyle = theme === 'cyber' ? '#7dd3fc' : (theme === 'plasma' ? '#e9d5ff' : (theme === 'cavern' ? '#fed7aa' : '#cfe0ff'));
    bgCtx.beginPath();
    bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    bgCtx.fill();
  }
  bgCtx.globalAlpha = 1;
}

/* ---------------------------------------------------------
   Orientation / mode
--------------------------------------------------------- */
const HUD_HEIGHT = 64;

function getMode() { return window.innerWidth >= window.innerHeight ? 'assault' : 'escape'; }
let mode = getMode();

/* ---------------------------------------------------------
   Input state (shared)
--------------------------------------------------------- */
const input = { x: null, y: null, down: false, keys: {}, mouseActive: true };

function resetInputState() {
  input.down = false;
  input.keys = {};
  if (typeof escapeGame !== 'undefined' && escapeGame && escapeGame.player) {
    escapeGame.player.vx = 0;
    escapeGame.player.vy = 0;
  }
  if (typeof assault !== 'undefined' && assault && assault.turret) {
    assault.turret.vx = 0;
    assault.turret.vy = 0;
  }
}

function pointerPos(e) {
  const t = (e.touches && e.touches[0]) ? e.touches[0] : e;
  return { x: t.clientX, y: t.clientY };
}
function updateInputPos(e) {
  if (e && e.target && e.target.closest && (e.target.closest('#hud') || e.target.closest('#pause-modal') || e.target.closest('#game-settings-modal') || e.target.closest('.game-settings-modal') || e.target.closest('.top-actions'))) return;
  const p = pointerPos(e);
  if (mode === 'assault' && typeof assault !== 'undefined' && typeof assault.getViewport === 'function') {
    const vp = assault.getViewport();
    input.x = (p.x - vp.ox) / vp.scale;
    input.y = (p.y - vp.oy) / vp.scale;
  } else if (mode === 'escape' && typeof escapeGame !== 'undefined' && typeof escapeGame.getViewport === 'function') {
    const vp = escapeGame.getViewport();
    input.x = (p.x - vp.ox) / vp.scale;
    input.y = (p.y - vp.oy) / vp.scale;
  } else {
    input.x = p.x;
    input.y = p.y;
  }
  input.mouseActive = true; // Re-enable mouse tracking on pointer/touch movement
}
window.addEventListener('pointerdown', e => {
  if (isGamePaused) return;
  if (e && e.target && e.target.closest && (e.target.closest('#hud') || e.target.closest('#pause-modal') || e.target.closest('#game-settings-modal') || e.target.closest('.game-settings-modal') || e.target.closest('.top-actions'))) return;
  input.down = true;
  updateInputPos(e);
  onPress(e);
}, { passive: true });
window.addEventListener('pointermove', e => {
  if (isGamePaused) return;
  updateInputPos(e);
}, { passive: true });
window.addEventListener('pointerup', () => { input.down = false; }, { passive: true });
window.addEventListener('pointercancel', () => { input.down = false; }, { passive: true });
window.addEventListener('mouseup', () => { input.down = false; }, { passive: true });

window.addEventListener('touchstart', e => {
  if (isGamePaused) return;
  if (e && e.target && e.target.closest && (e.target.closest('#hud') || e.target.closest('#pause-modal') || e.target.closest('#game-settings-modal') || e.target.closest('.game-settings-modal') || e.target.closest('.top-actions'))) return;
  input.down = true;
  updateInputPos(e);
  onPress(e);
}, { passive: true });
window.addEventListener('touchmove', e => {
  if (isGamePaused) return;
  updateInputPos(e);
}, { passive: true });
window.addEventListener('touchend', () => { input.down = false; }, { passive: true });
window.addEventListener('touchcancel', () => { input.down = false; }, { passive: true });

window.addEventListener('blur', resetInputState);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) resetInputState();
});

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();

  if ((k === 'm' || e.code === 'KeyM') && !e.repeat) {
    if (typeof Sound !== 'undefined') {
      Sound.toggleMute();
      if (typeof updatePauseSoundUI === 'function') updatePauseSoundUI();
    }
  }

  if ((k === 'p' || e.code === 'KeyP' || k === 'escape' || e.code === 'Escape') && !e.repeat) {
    toggleGamePause();
    return;
  }

  if (isGamePaused) return;

  input.keys[k] = true;
  if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown' || k === 'a' || k === 'd' || k === 'w' || k === 's') {
    input.mouseActive = false; // Disable mouse tracking when keyboard keys are pressed
  }
  if (e.key === ' ' || e.key === 'Spacebar') onPress(e);

  if (mode === 'assault' && typeof assault !== 'undefined' && assault.state === 'playing' && !e.repeat) {
    if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
      assault.buyUpgrade('rate');
    } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
      assault.buyUpgrade('spread');
    } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
      assault.buyUpgrade('laser');
    } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
      assault.buyUpgrade('pulse_turrets');
    }
  }
}, { passive: true });
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  input.keys[k] = false;
  delete input.keys[k];
}, { passive: true });

let lastPressTime = 0;
function onPress(e) {
  if (isGamePaused) return;
  if (e && e.target && e.target.closest && (e.target.closest('#hud') || e.target.closest('.top-actions'))) return;
  if (overlay && !overlay.classList.contains('hidden')) return;
  const now = performance.now();
  if (now - lastPressTime < 80) return;
  lastPressTime = now;
  if (mode === 'assault' && typeof assault !== 'undefined' && assault.state === 'playing') {
    assault.shoot();
  }
}

/* ---------------------------------------------------------
   HUD helpers
--------------------------------------------------------- */
const hudLeft = document.getElementById('hud-left');
const hudCenter = document.getElementById('hud-center');
const modeTag = document.getElementById('mode-tag');
const controlsHint = document.getElementById('controls-hint');
const overlay = document.getElementById('overlay');
const panel = document.getElementById('panel');

function heartsHTML(lives, max) {
  let h = '';
  for (let i = 0; i < max; i++) {
    const on = i < lives;
    h += `<div class="heart ${on ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="${on ? 'var(--player)' : 'rgba(255,255,255,0.15)'}"><path d="M12 21s-7.5-4.6-10-9.2C.5 8 2.4 4.5 6 4.5c2 0 3.5 1.1 4.3 2.6.8-1.5 2.3-2.6 4.3-2.6 3.6 0 5.5 3.5 4 7.3C19.5 16.4 12 21 12 21z"/></svg></div>`;
  }
  return h;
}

function renderHUD() {
  if (mode === 'escape') {
    const z = (typeof escapeGame !== 'undefined' && typeof escapeGame.getZoneConfig === 'function') ? escapeGame.getZoneConfig() : { badge: 'ZONE 1', name: 'Asteroid Belt' };
    hudLeft.innerHTML = `
      <div class="hud-chip"><span class="hud-label" id="escape-obj-lbl">DISTANCE</span><span class="hud-value" id="escape-obj-val">5000m</span></div>
      <div class="hud-chip"><span class="hud-label">Score</span><span class="hud-value" id="hv-score">${escapeGame.score || 0}</span></div>
    `;
    if (hudCenter) {
      hudCenter.innerHTML = `
        <div class="hud-chip"><span id="hearts">${heartsHTML(escapeGame.lives || 3, escapeGame.maxLives || 3)}</span></div>
      `;
    }
    modeTag.textContent = `${z.badge}: ${z.name}`;
    modeTag.className = 'mode-tag escape';
    modeTag.style.display = 'block';
    modeTag.id = 'escape-zone-tag';
    controlsHint.textContent = 'Move mouse/finger to steer, or use WASD / Arrows (No Shooting - Evade Hazards!)';
  } else {
    if (hudCenter) hudCenter.innerHTML = '';
    const diffLabel = assault.selectedDifficulty === 'hard' ? ' (HARD)' : (assault.selectedDifficulty === 'endless' ? ' (ENDLESS)' : '');
    hudLeft.innerHTML = `
      <div class="hud-stats-stack" id="hud-stats-stack">
        <div class="hud-chip" id="hud-wave-chip" style="position:relative;"><span class="hud-label">Wave</span><span class="hud-value" id="hv-wave">${assault.wave} / ${assault.totalWaves === Infinity ? '∞' : assault.totalWaves}</span></div>
        <div class="hud-chip" id="hud-points-chip"><span class="hud-label">Points</span><span class="hud-value" id="hv-points">${assault.points || 0}</span></div>
      </div>
      <div class="hud-chip"><span class="hud-label">Base</span><div id="healthbar-wrap"><div id="healthbar" style="width:${clamp((assault.health / (assault.maxHealth || 100)) * 100, 0, 100)}%"></div></div></div>
      <div class="upgrade-bar" id="upgrade-bar"></div>
    `;
    if (diffLabel) {
      modeTag.textContent = diffLabel.trim();
      modeTag.className = 'mode-tag assault';
      modeTag.style.display = 'block';
    } else {
      modeTag.textContent = '';
      modeTag.style.display = 'none';
    }
    controlsHint.textContent = (assault.selectedDifficulty === 'endless' && assault.wave > 9) ? 'Hold click/touch to steer & fire. Keys 1-4 for upgrades & pulse turrets' : 'Hold click/touch to steer & fire. Keys 1-3 for upgrades';
    if (typeof renderUpgradesHTML === 'function') renderUpgradesHTML();
  }
}

function getAssaultUnlocks() {
  return loadSecure('nova_assault_unlocks', { hard: false, endless: false });
}

function setAssaultUnlock(key) {
  const curr = getAssaultUnlocks();
  curr[key] = true;
  saveSecure('nova_assault_unlocks', curr);
}

function gateSVG(m) {
  const rot = m === 'escape' ? 0 : 90;
  const color = m === 'escape' ? 'var(--hazard)' : 'var(--energy)';
  return `
    <svg viewBox="0 0 120 120" style="transform:rotate(${rot}deg)">
      <g class="ring">
        <polygon points="60,10 100,32 100,78 60,100 20,78 20,32" fill="none" stroke="${color}" stroke-width="2" opacity="0.55"/>
      </g>
      <g class="core">
        <polygon points="60,30 82,44 82,76 60,90 38,76 38,44" fill="none" stroke="${color}" stroke-width="2.5"/>
        <circle cx="60" cy="60" r="9" fill="${color}"/>
      </g>
    </svg>
  `;
}

function requestFullscreenMode() {
  const isMobileTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    (window.innerWidth <= 1024 || window.innerHeight <= 600);
  if (!isMobileTouch) return;

  const doc = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
    const rfs = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.msRequestFullscreen;
    if (rfs) rfs.call(doc).catch(() => { });
  }
}

function toggleFullscreen() {
  const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (!isFS) {
    const doc = document.documentElement;
    const rfs = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.msRequestFullscreen;
    if (rfs) rfs.call(doc).catch(() => { });
  } else {
    const efs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (efs) efs.call(document).catch(() => { });
  }
}

function showStart() {
  if (isGamePaused) resumeGame();
  if (typeof Sound !== 'undefined') Sound.fadeOutBGM(400);

  if (typeof escapeGame !== 'undefined' && typeof escapeGame.stop === 'function') {
    escapeGame.stop();
  }
  if (typeof assault !== 'undefined' && typeof assault.stop === 'function') {
    assault.stop();
  }
  if (typeof removeBossHUD === 'function') removeBossHUD();
  if (typeof removeWaveAnnouncement === 'function') removeWaveAnnouncement();
  if (typeof updateDangerVignette === 'function') updateDangerVignette(false);
  resetInputState();
  renderHUD();

  const m = mode;
  const unlocks = getAssaultUnlocks();
  const currentDiff = (typeof assault !== 'undefined' && assault.selectedDifficulty) || 'normal';

  let diffHTML = '';
  if (m === 'assault') {
    const highestWave = (typeof assault !== 'undefined' && typeof assault.getHighestEndlessWave === 'function') ? assault.getHighestEndlessWave() : loadSecure('novashift_assault_highest_wave', 0);
    diffHTML = `
      <div class="diff-selector">
        <button type="button" class="diff-btn ${currentDiff === 'normal' ? 'active' : ''}" data-diff="normal">⚔️ Normal</button>
        <button type="button" class="diff-btn ${currentDiff === 'hard' ? 'active' : ''} ${unlocks.hard ? '' : 'locked'}" data-diff="hard" title="${unlocks.hard ? 'Hard Mode' : 'Win Normal Mode to unlock'}">
          💀 Hard ${unlocks.hard ? '' : '🔒'}
        </button>
        <button type="button" class="diff-btn ${currentDiff === 'endless' ? 'active' : ''} ${unlocks.endless ? '' : 'locked'}" data-diff="endless" title="${unlocks.endless ? 'Endless Mode' : 'Win Hard Mode to unlock'}">
          ♾️ Endless ${unlocks.endless ? '' : '🔒'}
        </button>
      </div>
      <div id="assault-highest-wave-container" style="font-size:0.85rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; text-align:center; margin-bottom:12px; display:${currentDiff === 'endless' ? 'block' : 'none'};">
        Highest Wave (Endless): <b style="color:#fff;" id="assault-highest-wave-display">${highestWave}</b>
      </div>
    `;
  }

  let escapeHTML = '';
  if (m === 'escape') {
    const isUnlocked = (typeof escapeGame !== 'undefined' && escapeGame.unlockedOverclocked) || loadSecure('novashift_escape_unlocked_overclocked', false);
    const isOverclockedActive = typeof escapeGame !== 'undefined' && escapeGame.isOverclockedMode;
    const bestScore = typeof escapeGame !== 'undefined' ? escapeGame.best : 0;

    escapeHTML = `
      <div class="diff-selector escape-mode-selector" style="margin-bottom:10px; display:flex; gap:8px; justify-content:center;">
        <button type="button" class="diff-btn ${!isOverclockedActive ? 'active' : ''}" id="btn-mode-normal">
          Standard Run
        </button>
        <button type="button" class="diff-btn ${isOverclockedActive ? 'active' : ''} ${isUnlocked ? '' : 'locked'}" id="btn-mode-overclocked" title="${isUnlocked ? 'Endless Overclocked Mode' : 'Reach Zone 6 to unlock'}">
          ⚡ Endless Overclocked ${isUnlocked ? '' : '🔒'}
        </button>
      </div>
      <div style="font-size:0.85rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; text-align:center; margin-bottom:12px;">
        Best Score (${isOverclockedActive ? 'Overclocked' : 'Normal'}): <b style="color:#fff;" id="escape-best-score-display">${bestScore}</b>
      </div>
    `;
  }

  panel.innerHTML = `
    <h1 class="title">NOVA SHIFT</h1>
    <p class="subtitle">One world. The goal depends on how you hold it.</p>
    <div id="gate">${gateSVG(m)}</div>
    <h2 class="mode-heading ${m}">${m === 'escape' ? 'Escape Mode' : 'Assault Mode'}</h2>
    ${m === 'escape'
      ? `<p class="desc">${(typeof escapeGame !== 'undefined' && escapeGame.isOverclockedMode) ? '⚡ <b>Endless Overclocked Mode</b>: Maximum speed, unrelenting hazard chaos. Test your steering reflexes and survive as long as possible!' : 'High-speed evasive piloting. Navigate through increasingly intense hazardous sectors, adapt to shifting space anomalies, and escape into hypergate warps.'}</p>${escapeHTML}`
      : `<p class="desc">Tactical base defense. Eliminate incoming enemy armadas, upgrade your ship weapons, and defend your core against boss flagships.</p>${diffHTML}`
    }
    <div class="rotate-hint">⟳ Rotate your device to switch objectives entirely</div>
    <div class="start-btn-row">
      <button id="btn-start" style="flex:1;">${m === 'escape' ? ((typeof escapeGame !== 'undefined' && escapeGame.isOverclockedMode) ? '⚡ Launch Overclocked' : 'Start Run') : 'Launch Defense'}</button>
      <button type="button" id="btn-main-settings" class="btn-settings-cog" title="Audio & Game Settings">⚙️</button>
    </div>
  `;

  const btnSettings = panel.querySelector('#btn-main-settings') || panel.querySelector('#btn-escape-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openSettingsModal === 'function') {
        openSettingsModal();
      }
    });
  }

  if (m === 'escape') {
    const btnNorm = panel.querySelector('#btn-mode-normal');
    const btnOver = panel.querySelector('#btn-mode-overclocked');

    if (btnNorm) {
      btnNorm.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Sound !== 'undefined' && Sound && typeof Sound.play === 'function') {
          Sound.play('uiClick');
        }
        if (typeof escapeGame !== 'undefined') escapeGame.isOverclockedMode = false;
        showStart();
      });
    }

    if (btnOver) {
      btnOver.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentlyUnlocked = (typeof escapeGame !== 'undefined' && escapeGame.unlockedOverclocked) || (typeof loadSecure === 'function' && loadSecure('novashift_escape_unlocked_overclocked', false));
        if (!currentlyUnlocked) {
          if (typeof Sound !== 'undefined' && Sound) {
            if (typeof Sound.laserWarning === 'function') Sound.laserWarning();
            else if (typeof Sound.play === 'function') Sound.play('hitHull');
          }
          showWaveAnnouncement('🔒 LOCKED', 'REACH ZONE 6 IN NORMAL MODE TO UNLOCK', false);
          return;
        }
        if (typeof Sound !== 'undefined' && Sound && typeof Sound.play === 'function') {
          Sound.play('uiClick');
        }
        if (typeof escapeGame !== 'undefined') escapeGame.isOverclockedMode = true;
        showStart();
      });
    }
  }

  if (m === 'assault') {
    panel.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const diff = btn.getAttribute('data-diff');
        if (diff === 'hard' && !unlocks.hard) {
          showWaveAnnouncement('🔒 LOCKED', 'BEAT NORMAL MODE TO UNLOCK HARD MODE', false);
          return;
        }
        if (diff === 'endless' && !unlocks.endless) {
          showWaveAnnouncement('🔒 LOCKED', 'BEAT HARD MODE TO UNLOCK ENDLESS ASSAULT', false);
          return;
        }
        if (typeof Sound !== 'undefined') Sound.play('uiClick');
        if (typeof assault !== 'undefined') assault.selectedDifficulty = diff;
        panel.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const highestContainer = document.getElementById('assault-highest-wave-container');
        if (highestContainer) {
          highestContainer.style.display = diff === 'endless' ? 'block' : 'none';
        }
      });
    });
  }

  overlay.classList.remove('hidden');
  document.getElementById('btn-start').addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.play('uiClick');
    requestFullscreenMode();
    overlay.classList.add('hidden');
    if (m === 'escape') {
      if (typeof escapeGame !== 'undefined' && escapeGame.isOverclockedMode) {
        escapeGame.startOverclocked();
      } else {
        escapeGame.start();
      }
    } else {
      assault.start();
    }
  });
}
window.showStartScreen = showStart;

/* ---------------------------------------------------------
   Global Announcement Overlay (Used for Waves, Bosses & Unlock Warnings)
--------------------------------------------------------- */
function showWaveAnnouncement(title, subtitle, isBoss) {
  removeWaveAnnouncement();
  const el = document.createElement('div');
  el.id = 'wave-announcement';
  if (isBoss) el.className = 'boss-wave';
  el.innerHTML = `
    <div class="wave-title">${title}</div>
    <div class="wave-subtitle">${subtitle}</div>
  `;
  document.body.appendChild(el);

  void el.offsetWidth;
  el.classList.add('active');

  if (window.waveAnnounceTimer) clearTimeout(window.waveAnnounceTimer);
  window.waveAnnounceTimer = setTimeout(() => {
    removeWaveAnnouncement();
  }, 2600);
}

function removeWaveAnnouncement() {
  if (window.waveAnnounceTimer) clearTimeout(window.waveAnnounceTimer);
  const existing = document.getElementById('wave-announcement');
  if (existing) existing.remove();
}

window.showWaveAnnouncement = showWaveAnnouncement;
window.removeWaveAnnouncement = removeWaveAnnouncement;

/* ---------------------------------------------------------
   Shared particle helpers
--------------------------------------------------------- */
function spark(x, y, color) {
  return { x, y, vx: rand(-160, 160), vy: rand(-160, 160), life: rand(280, 520), maxLife: 520, color };
}
function updateParticles(arr, dt) {
  for (const p of arr) { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.life -= dt; p.vx *= 0.94; p.vy *= 0.94; }
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0) arr.splice(i, 1);
}
function drawParticles(ctx, arr) {
  for (const p of arr) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = getComputedColor(p.color.replace('var(', '').replace(')', ''));
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------
   Resize handling / mode switching
--------------------------------------------------------- */
function onResizeGameplay() {
  initStars();
  if (typeof escapeGame !== 'undefined' && escapeGame.player && typeof escapeGame.getViewport === 'function') {
    const vp = escapeGame.getViewport();
    escapeGame.player.y = vp.vh - Math.max(90, vp.vh * 0.14);
  }
  if (typeof assault !== 'undefined' && assault.turret) assault.turret.x = Math.max(70, assault.vw * 0.09);
}

let lastMode = mode;
function checkOrientation() {
  const m = getMode();
  if (m !== mode) {
    mode = m;
    lastMode = m;
    const active = mode === 'escape' ? escapeGame : assault;
    if (active.state === 'playing') {
      overlay.classList.add('hidden');
    } else {
      showStart();
    }
    renderHUD();
  }
}

window.addEventListener('resize', () => { resize(); checkOrientation(); });
window.addEventListener('orientationchange', () => { setTimeout(() => { resize(); checkOrientation(); }, 60); });

/* ---------------------------------------------------------
   Main loop & Boot initialization
--------------------------------------------------------- */
let last = performance.now();
let isGamePaused = false;

function loop(now) {
  const dt = Math.min(now - last, 42);
  last = now;

  const driftX = (!isGamePaused && mode === 'escape') ? (escapeGame.player?.vx || 0) * 0.02 : 0;
  const driftY = (!isGamePaused && mode === 'assault') ? (assault.turret?.vy || 0) * 0.02 : 0;
  drawStars(dt, driftX, driftY);

  ctx.clearRect(0, 0, W, H);
  if (mode === 'escape') {
    if (!isGamePaused) {
      escapeGame.update(dt);
    }
    escapeGame.draw();
  } else {
    if (!isGamePaused) {
      assault.update(dt);
    }
    assault.draw();
  }
  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------
   Global Audio & Game Settings Modal
--------------------------------------------------------- */
function createSettingsModal() {
  if (document.getElementById('game-settings-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'game-settings-modal';
  modal.className = 'game-settings-modal';
  modal.innerHTML = `
    <div class="settings-panel">
      <div class="settings-header">
        <span class="settings-title">⚙️ Audio & Game Settings</span>
        <button id="btn-close-settings" class="settings-close-btn" type="button" title="Close Settings">✕</button>
      </div>

      <!-- AUDIO CONTROLS -->
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-label-wrap">
            <span class="settings-label">Sound Master</span>
            <span class="settings-sublabel">Master audio toggle</span>
          </div>
          <div class="toggle-btn-group">
            <button type="button" class="toggle-opt-btn" id="btn-sound-on">🔊 ON</button>
            <button type="button" class="toggle-opt-btn" id="btn-sound-off">🔇 MUTE</button>
          </div>
        </div>

        <div class="settings-slider-row">
          <div class="settings-row">
            <div class="settings-label-wrap">
              <span class="settings-label">Music Volume</span>
              <span class="settings-sublabel">Soundtrack & BGM tracks</span>
            </div>
            <span class="slider-val-badge" id="val-music-vol">60%</span>
          </div>
          <div class="settings-slider-wrap">
            <input type="range" min="0" max="100" value="60" class="settings-slider" id="slider-music-vol">
          </div>
        </div>

        <div class="settings-slider-row">
          <div class="settings-row">
            <div class="settings-label-wrap">
              <span class="settings-label">SFX Volume</span>
              <span class="settings-sublabel">Lasers, explosions & alerts</span>
            </div>
            <span class="slider-val-badge" id="val-sfx-vol">100%</span>
          </div>
          <div class="settings-slider-wrap">
            <input type="range" min="0" max="100" value="100" class="settings-slider" id="slider-sfx-vol">
          </div>
        </div>
      </div>

      <!-- FLIGHT & CONTROLS -->
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-label-wrap">
            <span class="settings-label">Flight Mouse Cursor</span>
            <span class="settings-sublabel">Show crosshair pointer in Escape Mode</span>
          </div>
          <div class="toggle-btn-group">
            <button type="button" class="toggle-opt-btn" id="btn-mouse-yes">YES</button>
            <button type="button" class="toggle-opt-btn" id="btn-mouse-no">NO</button>
          </div>
        </div>
      </div>

      <!-- RECORDS & DATA -->
      <div class="settings-group">
        <div class="settings-row">
          <div class="settings-label-wrap">
            <span class="settings-label">Reset Best Scores</span>
            <span class="settings-sublabel">Clear saved high score records</span>
          </div>
        </div>
        <div class="reset-btn-row">
          <button type="button" class="btn-reset-score" id="btn-reset-escape-std">Escape Standard</button>
          <button type="button" class="btn-reset-score" id="btn-reset-escape-end">Escape Endless</button>
          <button type="button" class="btn-reset-score" id="btn-reset-assault-end">Assault Endless</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const stopProp = (e) => { e.stopPropagation(); };
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'mousedown', 'mousemove', 'click'].forEach(evt => {
    modal.addEventListener(evt, stopProp);
  });

  function updateModalUI() {
    if (typeof Sound !== 'undefined') {
      const isMuted = Sound.muted;
      const btnOn = document.getElementById('btn-sound-on');
      const btnOff = document.getElementById('btn-sound-off');
      if (btnOn && btnOff) {
        btnOn.classList.toggle('active', !isMuted);
        btnOff.classList.toggle('active', isMuted);
      }

      const musicPct = Math.round((Sound.musicVolume !== undefined ? Sound.musicVolume : 0.60) * 100);
      const sfxPct = Math.round((Sound.sfxVolume !== undefined ? Sound.sfxVolume : 1.0) * 100);

      const sliderMusic = document.getElementById('slider-music-vol');
      const valMusic = document.getElementById('val-music-vol');
      if (sliderMusic) sliderMusic.value = musicPct;
      if (valMusic) valMusic.textContent = `${musicPct}%`;

      const sliderSFX = document.getElementById('slider-sfx-vol');
      const valSFX = document.getElementById('val-sfx-vol');
      if (sliderSFX) sliderSFX.value = sfxPct;
      if (valSFX) valSFX.textContent = `${sfxPct}%`;
    }

    if (typeof escapeGame !== 'undefined') {
      const isMouse = escapeGame.showMouse;
      const btnYes = document.getElementById('btn-mouse-yes');
      const btnNo = document.getElementById('btn-mouse-no');
      if (btnYes && btnNo) {
        btnYes.classList.toggle('active', isMouse);
        btnNo.classList.toggle('active', !isMouse);
      }
      const btnResetStd = document.getElementById('btn-reset-escape-std');
      const btnResetEnd = document.getElementById('btn-reset-escape-end');
      if (btnResetStd && !btnResetStd.classList.contains('reset-done')) {
        btnResetStd.textContent = `Escape Standard (${escapeGame.bestNormal || 0})`;
      }
      if (btnResetEnd && !btnResetEnd.classList.contains('reset-done')) {
        btnResetEnd.textContent = `Escape Endless (${escapeGame.bestOverclocked || 0})`;
      }
    }

    if (typeof assault !== 'undefined') {
      const btnResetAssault = document.getElementById('btn-reset-assault-end');
      if (btnResetAssault && !btnResetAssault.classList.contains('reset-done')) {
        const highest = typeof assault.getHighestEndlessWave === 'function' ? assault.getHighestEndlessWave() : (assault.highestEndlessWave || 0);
        btnResetAssault.textContent = `Assault Endless (W${highest})`;
      }
    }
  }

  const closeModal = () => {
    modal.classList.remove('active');
  };

  const closeBtn = document.getElementById('btn-close-settings');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Sound Master Toggle
  const btnSoundOn = document.getElementById('btn-sound-on');
  if (btnSoundOn) {
    btnSoundOn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined' && Sound.muted) {
        Sound.toggleMute();
        updateModalUI();
      }
    });
  }

  const btnSoundOff = document.getElementById('btn-sound-off');
  if (btnSoundOff) {
    btnSoundOff.addEventListener('click', () => {
      if (typeof Sound !== 'undefined' && !Sound.muted) {
        Sound.toggleMute();
        updateModalUI();
      }
    });
  }

  // Music Volume Slider
  const sliderMusic = document.getElementById('slider-music-vol');
  if (sliderMusic) {
    sliderMusic.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      if (typeof Sound !== 'undefined') {
        Sound.setMusicVolume(val);
      }
      const valMusic = document.getElementById('val-music-vol');
      if (valMusic) valMusic.textContent = `${e.target.value}%`;
    });
  }

  // SFX Volume Slider
  const sliderSFX = document.getElementById('slider-sfx-vol');
  if (sliderSFX) {
    sliderSFX.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      if (typeof Sound !== 'undefined') {
        Sound.setSFXVolume(val);
      }
      const valSFX = document.getElementById('val-sfx-vol');
      if (valSFX) valSFX.textContent = `${e.target.value}%`;
    });
    sliderSFX.addEventListener('change', () => {
      if (typeof Sound !== 'undefined') Sound.play('uiClick');
    });
  }

  // Mouse cursor toggle
  const btnMouseYes = document.getElementById('btn-mouse-yes');
  if (btnMouseYes) {
    btnMouseYes.addEventListener('click', () => {
      if (typeof escapeGame !== 'undefined') escapeGame.setShowMouse(true);
      updateModalUI();
    });
  }

  const btnMouseNo = document.getElementById('btn-mouse-no');
  if (btnMouseNo) {
    btnMouseNo.addEventListener('click', () => {
      if (typeof escapeGame !== 'undefined') escapeGame.setShowMouse(false);
      updateModalUI();
    });
  }

  // Score Resets
  function flashResetDone(btn, originalText) {
    btn.classList.add('reset-done');
    btn.textContent = 'Reset! ✓';
    setTimeout(() => {
      btn.classList.remove('reset-done');
      updateModalUI();
    }, 1200);
  }

  const btnResetEscapeStd = document.getElementById('btn-reset-escape-std');
  if (btnResetEscapeStd) {
    btnResetEscapeStd.addEventListener('click', function () {
      if (typeof escapeGame !== 'undefined') {
        escapeGame.resetBestScore('standard');
        flashResetDone(this, `Escape Std (${escapeGame.bestNormal || 0})`);
      }
    });
  }

  const btnResetEscapeEnd = document.getElementById('btn-reset-escape-end');
  if (btnResetEscapeEnd) {
    btnResetEscapeEnd.addEventListener('click', function () {
      if (typeof escapeGame !== 'undefined') {
        escapeGame.resetBestScore('endless');
        flashResetDone(this, `Escape End (${escapeGame.bestOverclocked || 0})`);
      }
    });
  }

  const btnResetAssaultEnd = document.getElementById('btn-reset-assault-end');
  if (btnResetAssaultEnd) {
    btnResetAssaultEnd.addEventListener('click', function () {
      if (typeof assault !== 'undefined' && typeof assault.resetHighestEndlessWave === 'function') {
        assault.resetHighestEndlessWave();
        const disp = document.getElementById('assault-highest-wave-display');
        if (disp) disp.textContent = '0';
        flashResetDone(this, 'Assault End (W0)');
      }
    });
  }

  window.openSettingsModal = function () {
    updateModalUI();
    modal.classList.add('active');
  };

  if (typeof escapeGame !== 'undefined') {
    escapeGame.updateSettingsModalUI = updateModalUI;
    escapeGame.openSettingsModal = window.openSettingsModal;
  }
}

/* ---------------------------------------------------------
   Pause System & Pause Menu Modal
--------------------------------------------------------- */
function isGameActive() {
  if (overlay && !overlay.classList.contains('hidden')) return false;
  if (mode === 'escape') {
    return escapeGame && (escapeGame.state === 'playing' || escapeGame.state === 'warping');
  } else {
    return assault && assault.state === 'playing';
  }
}

function pauseGame() {
  if (!isGameActive() || isGamePaused) return;
  isGamePaused = true;
  resetInputState();
  if (typeof Sound !== 'undefined') Sound.pauseBGM();
  showPauseModal();
}

function resumeGame() {
  if (!isGamePaused) return;
  isGamePaused = false;
  resetInputState();
  last = performance.now();
  if (typeof Sound !== 'undefined') Sound.resumeBGM();
  hidePauseModal();
}

function toggleGamePause() {
  const settingsModal = document.getElementById('game-settings-modal');
  if (settingsModal && settingsModal.classList.contains('active')) {
    settingsModal.classList.remove('active');
    return;
  }

  if (isGamePaused) {
    resumeGame();
  } else if (isGameActive()) {
    pauseGame();
  }
}

function updatePauseSoundUI() {
  const isMuted = (typeof Sound !== 'undefined') ? Sound.muted : false;
  const icon = document.getElementById('pause-sound-icon');
  const text = document.getElementById('pause-sound-text');
  const btn = document.getElementById('btn-pause-sound');
  if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
  if (text) text.textContent = isMuted ? 'Sound: MUTED' : 'Sound: ON';
  if (btn) {
    if (isMuted) btn.classList.add('muted');
    else btn.classList.remove('muted');
  }
}

function createPauseModal() {
  if (document.getElementById('pause-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'pause-modal';
  modal.innerHTML = `
    <div class="pause-panel">
      <h2 class="pause-title">⏸ GAME PAUSED</h2>
      <div class="pause-subtitle" id="pause-mode-info">Tactical Base Defense</div>

      <div class="pause-btn-list">
        <button type="button" class="pause-btn primary" id="btn-pause-resume">
          ▶ Resume Game
        </button>

        <div class="pause-btn-row-dual">
          <button type="button" class="pause-btn secondary" id="btn-pause-sound" title="Toggle Sound (M)">
            <span id="pause-sound-icon">🔊</span> <span id="pause-sound-text">Sound: ON</span>
          </button>
          <button type="button" class="pause-btn secondary" id="btn-pause-fullscreen" title="Toggle Fullscreen">
            <span>⛶</span> Fullscreen
          </button>
        </div>

        <button type="button" class="pause-btn secondary" id="btn-pause-settings">
          ⚙️ Audio & Game Settings
        </button>

        <button type="button" class="pause-btn secondary" id="btn-pause-restart">
          ⟳ Restart Mission
        </button>

        <button type="button" class="pause-btn secondary" id="btn-pause-quit" style="border-color:rgba(255,61,129,0.4); color:#ff85ad;">
          ⌂ Quit to Main Menu
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const stopProp = (e) => { e.stopPropagation(); };
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'mousedown', 'mousemove', 'click'].forEach(evt => {
    modal.addEventListener(evt, stopProp);
  });

  document.getElementById('btn-pause-resume').addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.play('uiClick');
    resumeGame();
  });

  document.getElementById('btn-pause-sound').addEventListener('click', () => {
    if (typeof Sound !== 'undefined') {
      Sound.toggleMute();
      updatePauseSoundUI();
    }
  });

  document.getElementById('btn-pause-fullscreen').addEventListener('click', () => {
    toggleFullscreen();
  });

  document.getElementById('btn-pause-settings').addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.play('uiClick');
    if (typeof openSettingsModal === 'function') {
      openSettingsModal();
    }
  });

  document.getElementById('btn-pause-restart').addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.play('uiClick');
    resumeGame();
    if (mode === 'escape') {
      if (typeof escapeGame !== 'undefined') {
        if (escapeGame.isOverclockedMode) escapeGame.startOverclocked();
        else escapeGame.start();
      }
    } else {
      if (typeof assault !== 'undefined') assault.start();
    }
  });

  document.getElementById('btn-pause-quit').addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.play('uiClick');
    resumeGame();
    if (typeof showStart === 'function') {
      showStart();
    }
  });
}

function showPauseModal() {
  createPauseModal();
  const modal = document.getElementById('pause-modal');
  const info = document.getElementById('pause-mode-info');
  if (info) {
    if (mode === 'escape') {
      const z = (typeof escapeGame !== 'undefined' && typeof escapeGame.getZoneConfig === 'function') ? escapeGame.getZoneConfig() : { name: 'Escape Run' };
      info.textContent = `Escape Mode // ${z.name}`;
    } else {
      const diff = (typeof assault !== 'undefined') ? (assault.selectedDifficulty || 'normal').toUpperCase() : 'NORMAL';
      const wave = (typeof assault !== 'undefined') ? assault.wave : 1;
      info.textContent = `Assault Mode // ${diff} // Wave ${wave}`;
    }
  }
  updatePauseSoundUI();
  if (modal) modal.classList.add('active');
}

function hidePauseModal() {
  const modal = document.getElementById('pause-modal');
  if (modal) modal.classList.remove('active');
}

function initGame() {
  resize();
  createSettingsModal();
  createPauseModal();
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.addEventListener('click', toggleGamePause);
  if (typeof Sound !== 'undefined') Sound.updateUI();
  renderHUD();
  showStart();
  requestAnimationFrame(loop);
}
