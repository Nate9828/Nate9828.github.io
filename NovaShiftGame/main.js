/* ---------------------------------------------------------
   NOVA SHIFT - Main Engine & Shared Utilities
--------------------------------------------------------- */

/* ---------------------------------------------------------
   Utility
--------------------------------------------------------- */
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand  = (a,b)=>a+Math.random()*(b-a);
const randInt = (a,b)=>Math.floor(a+Math.random()*(b-a+1));
const dist2 = (ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by; return dx*dx+dy*dy;};

function getComputedColor(varName){
  if(varName.startsWith('--')) return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return varName;
}

/* ---------------------------------------------------------
   Canvas + sizing
--------------------------------------------------------- */
const bgCanvas = document.getElementById('bg');
const gCanvas  = document.getElementById('game');
const bgCtx = bgCanvas.getContext('2d');
const ctx   = gCanvas.getContext('2d');

let W=0, H=0, DPR=1;
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  [bgCanvas, gCanvas].forEach(c=>{
    c.width = W*DPR; c.height = H*DPR;
    c.style.width = W+'px'; c.style.height = H+'px';
  });
  bgCtx.setTransform(DPR,0,0,DPR,0,0);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  initStars();
  onResizeGameplay();
}

/* ---------------------------------------------------------
   Starfield ambient background
--------------------------------------------------------- */
let stars = [];
function initStars(){
  stars = [];
  const count = Math.floor((W*H)/9000);
  for(let i=0;i<count;i++){
    stars.push({
      x: rand(0,W), y: rand(0,H),
      r: rand(0.4,1.8),
      tw: rand(0,Math.PI*2),
      speed: rand(0.15,0.6)
    });
  }
}
function drawStars(dt, driftX, driftY){
  bgCtx.clearRect(0,0,W,H);
  const g = bgCtx.createRadialGradient(W*0.5,H*0.35,0, W*0.5,H*0.35, Math.max(W,H)*0.8);
  g.addColorStop(0,'rgba(60,40,110,0.35)');
  g.addColorStop(1,'rgba(5,6,14,0)');
  bgCtx.fillStyle = g;
  bgCtx.fillRect(0,0,W,H);
  for(const s of stars){
    s.tw += dt*0.002;
    s.x -= driftX*s.speed*dt*0.05;
    s.y -= driftY*s.speed*dt*0.05;
    if(s.x<0) s.x+=W; if(s.x>W) s.x-=W;
    if(s.y<0) s.y+=H; if(s.y>H) s.y-=H;
    const a = 0.4 + Math.sin(s.tw)*0.35;
    bgCtx.globalAlpha = clamp(a,0.1,0.9);
    bgCtx.fillStyle = '#cfe0ff';
    bgCtx.beginPath();
    bgCtx.arc(s.x,s.y,s.r,0,Math.PI*2);
    bgCtx.fill();
  }
  bgCtx.globalAlpha = 1;
}

/* ---------------------------------------------------------
   Orientation / mode
--------------------------------------------------------- */
const HUD_HEIGHT = 64;

function getMode(){ return window.innerWidth >= window.innerHeight ? 'assault' : 'escape'; }
let mode = getMode();

/* ---------------------------------------------------------
   Input state (shared)
--------------------------------------------------------- */
const input = { x:null, y:null, down:false, keys:{}, mouseActive:true };
function pointerPos(e){
  const t = (e.touches && e.touches[0]) ? e.touches[0] : e;
  return { x: t.clientX, y: t.clientY };
}
function updateInputPos(e){
  if (e && e.target && e.target.closest && e.target.closest('#hud')) return;
  const p = pointerPos(e);
  if (mode === 'assault' && typeof assault !== 'undefined' && typeof assault.getViewport === 'function') {
    const vp = assault.getViewport();
    input.x = (p.x - vp.ox) / vp.scale;
    input.y = (p.y - vp.oy) / vp.scale;
  } else {
    input.x = p.x;
    input.y = p.y;
  }
  input.mouseActive = true; // Re-enable mouse tracking on pointer/touch movement
}
window.addEventListener('pointerdown', e=>{
  input.down = true;
  updateInputPos(e);
  onPress(e);
}, {passive:true});
window.addEventListener('pointermove', e=>{
  updateInputPos(e);
}, {passive:true});
window.addEventListener('pointerup', ()=>{ input.down=false; }, {passive:true});
window.addEventListener('pointercancel', ()=>{ input.down=false; }, {passive:true});

window.addEventListener('touchstart', e=>{
  input.down = true;
  updateInputPos(e);
  onPress(e);
}, {passive:true});
window.addEventListener('touchmove', e=>{
  updateInputPos(e);
}, {passive:true});
window.addEventListener('touchend', ()=>{ input.down=false; }, {passive:true});

window.addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  input.keys[k] = true;
  if(k==='arrowleft'||k==='arrowright'||k==='arrowup'||k==='arrowdown'||k==='a'||k==='d'||k==='w'||k==='s'){
    input.mouseActive = false; // Disable mouse tracking when keyboard keys are pressed
  }
  if(e.key === ' ' || e.key === 'Spacebar') onPress(e);

  if(mode === 'assault' && typeof assault !== 'undefined' && assault.state === 'playing' && !e.repeat){
    if(e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1'){
      assault.buyUpgrade('rate');
    } else if(e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2'){
      assault.buyUpgrade('spread');
    } else if(e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3'){
      assault.buyUpgrade('laser');
    }
  }
}, {passive:true});
window.addEventListener('keyup', e=>{
  input.keys[e.key.toLowerCase()] = false;
}, {passive:true});

let lastPressTime = 0;
function onPress(e){
  if (e && e.target && e.target.closest && e.target.closest('#hud')) return;
  if(overlay && !overlay.classList.contains('hidden')) return;
  const now = performance.now();
  if(now - lastPressTime < 80) return;
  lastPressTime = now;
  if(mode === 'assault' && typeof assault !== 'undefined' && assault.state === 'playing'){
    assault.shoot();
  }
}

/* ---------------------------------------------------------
   HUD helpers
--------------------------------------------------------- */
const hudLeft = document.getElementById('hud-left');
const modeTag = document.getElementById('mode-tag');
const controlsHint = document.getElementById('controls-hint');
const overlay = document.getElementById('overlay');
const panel = document.getElementById('panel');

function heartsHTML(lives,max){
  let h='';
  for(let i=0;i<max;i++){
    const on = i<lives;
    h += `<div class="heart ${on?'on':''}"><svg viewBox="0 0 24 24" fill="${on?'var(--player)':'rgba(255,255,255,0.15)'}"><path d="M12 21s-7.5-4.6-10-9.2C.5 8 2.4 4.5 6 4.5c2 0 3.5 1.1 4.3 2.6.8-1.5 2.3-2.6 4.3-2.6 3.6 0 5.5 3.5 4 7.3C19.5 16.4 12 21 12 21z"/></svg></div>`;
  }
  return h;
}

function renderHUD(){
  if(mode==='escape'){
    hudLeft.innerHTML = `
      <div class="hud-chip"><span class="hud-label">Score</span><span class="hud-value" id="hv-score">${escapeGame.score}</span></div>
      <div class="hud-chip"><span id="hearts">${heartsHTML(escapeGame.lives, escapeGame.maxLives)}</span></div>
    `;
    modeTag.textContent = 'Escape Mode';
    modeTag.className = 'mode-tag escape';
    controlsHint.textContent = 'Move mouse/finger to steer, or use WASD / Arrows';
  } else {
    const diffLabel = assault.selectedDifficulty === 'hard' ? ' (HARD)' : (assault.selectedDifficulty === 'endless' ? ' (ENDLESS)' : '');
    hudLeft.innerHTML = `
      <div class="hud-chip"><span class="hud-label">Wave</span><span class="hud-value" id="hv-wave">${assault.wave} / ${assault.totalWaves === Infinity ? '∞' : assault.totalWaves}</span></div>
      <div class="hud-chip"><span class="hud-label">Points</span><span class="hud-value" id="hv-points">${assault.points||0}</span></div>
      <div class="hud-chip"><span class="hud-label">Base</span><div id="healthbar-wrap"><div id="healthbar" style="width:${clamp((assault.health / (assault.maxHealth || 100)) * 100, 0, 100)}%"></div></div></div>
      <div class="upgrade-bar" id="upgrade-bar"></div>
    `;
    modeTag.textContent = 'Assault Mode' + diffLabel;
    modeTag.className = 'mode-tag assault';
    controlsHint.textContent = 'Hold click/touch to steer & fire. Keys 1-3 for upgrades';
    if(typeof renderUpgradesHTML === 'function') renderUpgradesHTML();
  }
}

function getAssaultUnlocks() {
  try {
    const saved = localStorage.getItem('nova_assault_unlocks');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { hard: false, endless: false };
}

function setAssaultUnlock(key) {
  const curr = getAssaultUnlocks();
  curr[key] = true;
  try {
    localStorage.setItem('nova_assault_unlocks', JSON.stringify(curr));
  } catch (e) {}
}

function gateSVG(m){
  const rot = m==='escape' ? 0 : 90;
  const color = m==='escape' ? 'var(--hazard)' : 'var(--energy)';
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
  // Only auto-trigger fullscreen on mobile/tablet touch devices with constrained viewports
  const isMobileTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
                        (window.innerWidth <= 1024 || window.innerHeight <= 600);
  if (!isMobileTouch) return;

  const doc = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
    const rfs = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.msRequestFullscreen;
    if (rfs) rfs.call(doc).catch(() => {});
  }
}

function toggleFullscreen() {
  const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (!isFS) {
    const doc = document.documentElement;
    const rfs = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.msRequestFullscreen;
    if (rfs) rfs.call(doc).catch(() => {});
  } else {
    const efs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (efs) efs.call(document).catch(() => {});
  }
}

function showStart(){
  const m = mode;
  const unlocks = getAssaultUnlocks();
  const currentDiff = (typeof assault !== 'undefined' && assault.selectedDifficulty) || 'normal';

  let diffHTML = '';
  if (m === 'assault') {
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
    `;
  }

  panel.innerHTML = `
    <h1 class="title">NOVA SHIFT</h1>
    <p class="subtitle">One world. The goal depends on how you hold it.</p>
    <div id="gate">${gateSVG(m)}</div>
    <h2 class="mode-heading ${m}">${m==='escape' ? 'Escape Mode' : 'Assault Mode'}</h2>
    ${ m==='escape'
      ? `<p class="desc">There is no end &mdash; only how long you last. Dodge the falling wreckage, grab <b>crystals</b> for score, and survive as long as you can with <b>3 lives</b>.</p>`
      : `<p class="desc">Tactical base defense. Earn points for upgrades, collect power-ups, and defeat the <b>Leviathan Flagship</b>.</p>${diffHTML}`
    }
    <div class="rotate-hint">⟳ Rotate your device to switch objectives entirely</div>
    <button id="btn-start">${m==='escape' ? 'Start Run' : 'Launch Defense'}</button>
  `;

  if (m === 'assault') {
    panel.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const diff = btn.getAttribute('data-diff');
        if (diff === 'hard' && !unlocks.hard) {
          if (typeof showWaveAnnouncement === 'function') showWaveAnnouncement('🔒 LOCKED', 'BEAT NORMAL MODE TO UNLOCK HARD MODE', false);
          return;
        }
        if (diff === 'endless' && !unlocks.endless) {
          if (typeof showWaveAnnouncement === 'function') showWaveAnnouncement('🔒 LOCKED', 'BEAT HARD MODE TO UNLOCK ENDLESS ASSAULT', false);
          return;
        }
        if (typeof assault !== 'undefined') assault.selectedDifficulty = diff;
        panel.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  overlay.classList.remove('hidden');
  document.getElementById('btn-start').addEventListener('click', ()=>{
    requestFullscreenMode();
    overlay.classList.add('hidden');
    if(m==='escape') escapeGame.start(); else assault.start();
  });
}

/* ---------------------------------------------------------
   Shared particle helpers
--------------------------------------------------------- */
function spark(x,y,color){
  return { x,y, vx:rand(-160,160), vy:rand(-160,160), life:rand(280,520), maxLife:520, color };
}
function updateParticles(arr,dt){
  for(const p of arr){ p.x+=p.vx*dt/1000; p.y+=p.vy*dt/1000; p.life-=dt; p.vx*=0.94; p.vy*=0.94; }
  for(let i=arr.length-1;i>=0;i--) if(arr[i].life<=0) arr.splice(i,1);
}
function drawParticles(ctx,arr){
  for(const p of arr){
    const a = clamp(p.life/p.maxLife,0,1);
    ctx.globalAlpha = a;
    ctx.fillStyle = getComputedColor(p.color.replace('var(','').replace(')',''));
    ctx.beginPath(); ctx.arc(p.x,p.y,2.4,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}

/* ---------------------------------------------------------
   Resize handling / mode switching
--------------------------------------------------------- */
function onResizeGameplay(){
  initStars();
  if(typeof escapeGame !== 'undefined' && escapeGame.player) escapeGame.player.y = H - Math.max(90,H*0.14);
  if(typeof assault !== 'undefined' && assault.turret) assault.turret.x = Math.max(70, assault.vw * 0.09);
}

let lastMode = mode;
function checkOrientation(){
  const m = getMode();
  if(m!==mode){
    mode = m;
    lastMode = m;
    const active = mode==='escape' ? escapeGame : assault;
    if(active.state==='playing'){
      overlay.classList.add('hidden');
    } else {
      showStart();
    }
    renderHUD();
  }
}

window.addEventListener('resize', ()=>{ resize(); checkOrientation(); });
window.addEventListener('orientationchange', ()=>{ setTimeout(()=>{ resize(); checkOrientation(); }, 60); });

/* ---------------------------------------------------------
   Main loop & Boot initialization
--------------------------------------------------------- */
let last = performance.now();
function loop(now){
  const dt = Math.min(now-last, 42);
  last = now;

  const driftX = mode==='escape' ? (escapeGame.player?.vx||0)*0.02 : 0;
  const driftY = mode==='assault' ? (assault.turret?.vy||0)*0.02 : 0;
  drawStars(dt, driftX, driftY);

  ctx.clearRect(0,0,W,H);
  if(mode==='escape'){
    escapeGame.update(dt);
    escapeGame.draw();
  } else {
    assault.update(dt);
    assault.draw();
  }
  requestAnimationFrame(loop);
}

function initGame(){
  resize();
  const fsBtn = document.getElementById('btn-fullscreen');
  if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);
  renderHUD();
  showStart();
  requestAnimationFrame(loop);
}
