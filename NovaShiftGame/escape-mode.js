/* ---------------------------------------------------------
   ESCAPE MODE — Multi-Zone Area Escape & Dodging Survival (Vertical Portrait)
   No Shooting — Pure Steering, Hazard Evading & Objective Escape
--------------------------------------------------------- */

const ESCAPE_ZONES = [
  {
    id: 1,
    name: 'Asteroid Belt',
    type: 'distance',
    target: 5000,
    bgTheme: 'asteroid',
    desc: 'Dodge incoming asteroids and cover 5000m to reach the hypergate!',
    accentColor: '#4dd8ff',
    badge: 'ZONE 1'
  },
  {
    id: 2,
    name: 'Plasma Nebula',
    type: 'crystals',
    target: 15,
    bgTheme: 'plasma',
    desc: 'Extract 15 Plasma Cores amidst high-speed electrical orb surges!',
    accentColor: '#e056fd',
    badge: 'ZONE 2'
  },
  {
    id: 3,
    name: 'Cyber Laser Grid',
    type: 'time',
    target: 45,
    bgTheme: 'cyber',
    desc: 'Evade sweeping laser defense matrices and full-screen wall beams!',
    accentColor: '#00f2fe',
    badge: 'ZONE 3'
  },
  {
    id: 4,
    name: 'Black Hole Singularity',
    type: 'distance',
    target: 7500,
    bgTheme: 'blackhole',
    desc: 'Break free from event horizon gravity and rapid void mine swarms!',
    accentColor: '#a855f7',
    badge: 'ZONE 4'
  },
  {
    id: 5,
    name: 'Meteor Cavern',
    type: 'distance',
    target: 6000,
    bgTheme: 'cavern',
    desc: 'Navigate morphing cave walls, split tunnels, and wall magma geyser eruptions!',
    accentColor: '#ff8c00',
    badge: 'ZONE 5'
  }
];

const escapeGame = {
  state: 'idle', // idle | playing | warping | over | victory
  score: 0,
  bestNormal: typeof loadSecure === 'function' ? loadSecure('novashift_escape_best_normal', 0) : 0,
  bestOverclocked: typeof loadSecure === 'function' ? loadSecure('novashift_escape_best_overclocked', 0) : 0,
  unlockedOverclocked: typeof loadSecure === 'function' ? loadSecure('novashift_escape_unlocked_overclocked', false) : false,
  isOverclockedMode: false,
  showMouse: typeof loadSecure === 'function' ? loadSecure('novashift_escape_show_mouse', false) : false,

  setShowMouse(val) {
    this.showMouse = !!val;
    if (typeof saveSecure === 'function') saveSecure('novashift_escape_show_mouse', this.showMouse);
    this.updateCursorVisibility();
  },

  updateCursorVisibility() {
    if (typeof gCanvas === 'undefined' || !gCanvas) return;
    if (typeof mode !== 'undefined' && mode === 'escape' && this.state === 'playing') {
      gCanvas.style.cursor = this.showMouse ? 'crosshair' : 'none';
    } else {
      gCanvas.style.cursor = 'default';
    }
  },

  resetBestScore(type) {
    if (type === 'standard' || type === 'normal') {
      this.bestNormal = 0;
      if (typeof saveSecure === 'function') saveSecure('novashift_escape_best_normal', 0);
    } else if (type === 'endless' || type === 'overclocked') {
      this.bestOverclocked = 0;
      if (typeof saveSecure === 'function') saveSecure('novashift_escape_best_overclocked', 0);
    }

    const scoreDisp = document.getElementById('escape-best-score-display');
    if (scoreDisp) scoreDisp.textContent = String(this.best);

    const gameOverBest = document.getElementById('escape-game-over-best');
    if (gameOverBest) gameOverBest.textContent = String(this.best);

    if (typeof this.updateSettingsModalUI === 'function') {
      this.updateSettingsModalUI();
    }
  },

  get best() {
    return this.isOverclockedMode ? this.bestOverclocked : this.bestNormal;
  },

  checkBestScore() {
    const s = Math.floor(this.score);
    if (this.isOverclockedMode) {
      if (s > this.bestOverclocked) {
        this.bestOverclocked = s;
        if (typeof saveSecure === 'function') saveSecure('novashift_escape_best_overclocked', s);
      }
    } else {
      if (s > this.bestNormal) {
        this.bestNormal = s;
        if (typeof saveSecure === 'function') saveSecure('novashift_escape_best_normal', s);
      }
    }
  },

  crystals: 0,
  lives: 3,
  maxLives: 3,
  t: 0,
  zoneTime: 0, // time spent in current zone (for speed acceleration)
  invuln: 0,
  shieldTime: 0, // temporary invulnerability shield from void shards

  // Virtual Vertical Dimensions (540x960 base aspect ratio)
  vw: 540,
  vh: 960,
  getViewport() {
    const vw = 540;
    const scale = window.innerWidth / vw;
    const vh = Math.max(960, window.innerHeight / scale);
    return { scale, ox: 0, oy: 0, vw, vh, speedScale: vh / 960 };
  },

  // Zone Progression
  currentZoneIdx: 0,
  zoneProgress: 0,
  zoneTarget: 5000,
  warpTimer: 0,
  warpDuration: 2600,
  warpBannerText: '',
  bannerAlpha: 0,

  // Player state
  player: { x: 0, y: 0, r: 16, vx: 0, vy: 0 },

  // Entity groups
  rocks: [],
  gems: [],
  plasmaOrbs: [],
  lasers: [],
  voidMines: [],
  caveBats: [],
  geysers: [],
  particles: [],
  warpSpeedLines: [],

  // Scrolling Cavern Wall Engine
  caveNodes: [],
  caveLastLeft: 70,
  caveLastRight: 470,
  cavePillarState: 'idle',
  cavePillarStep: 0,
  cavePillarLength: 20,

  // Timers
  spawnTimer: 0,
  spawnInterval: 900,

  start() {
    this.isOverclockedMode = false;
    this.state = 'playing';
    this.score = 0;
    this.crystals = 0;
    this.lives = this.maxLives;
    this.t = 0;
    this.invuln = 0;
    this.shieldTime = 0;
    this.currentZoneIdx = 0;

    this.initZone(0);

    const vp = this.getViewport();
    this.player.x = vp.vw / 2;
    this.player.y = vp.vh - Math.max(90, vp.vh * 0.14);
    this.player.vx = 0;
    this.player.vy = 0;

    if (typeof renderHUD === 'function') renderHUD();
    if (typeof renderHUDNumbers === 'function') renderHUDNumbers();
    this.updateCursorVisibility();
  },

  startOverclocked() {
    this.isOverclockedMode = true;
    this.state = 'playing';
    this.score = 0;
    this.crystals = 0;
    this.lives = this.maxLives;
    this.t = 0;
    this.invuln = 0;
    this.shieldTime = 0;
    this.unlockedOverclocked = true;
    if (typeof saveSecure === 'function') saveSecure('novashift_escape_unlocked_overclocked', true);

    this.initZone(5); // Enter directly into Zone 6 (Overclocked Void Loop!)

    const vp = this.getViewport();
    this.player.x = vp.vw / 2;
    this.player.y = vp.vh - Math.max(90, vp.vh * 0.14);
    this.player.vx = 0;
    this.player.vy = 0;

    if (typeof renderHUD === 'function') renderHUD();
    if (typeof renderHUDNumbers === 'function') renderHUDNumbers();
    this.updateCursorVisibility();
  },

  initZone(idx) {
    this.currentZoneIdx = idx;
    if (idx >= 5 && !this.unlockedOverclocked) {
      this.unlockedOverclocked = true;
      if (typeof saveSecure === 'function') saveSecure('novashift_escape_unlocked_overclocked', true);
    }
    const z = this.getZoneConfig();
    this.zoneTime = 0;
    this.spawnTimer = 0;
    this.spawnInterval = z.bgTheme === 'plasma' ? 550 : 800;
    this.rocks = [];
    this.gems = [];
    this.plasmaOrbs = [];
    this.lasers = [];
    this.voidMines = [];
    this.caveBats = [];
    this.geysers = [];
    this.particles = [];

    if (z.bgTheme === 'cavern') {
      this.initCavern();
    }

    if (z.type === 'distance') {
      this.zoneProgress = z.target;
    } else if (z.type === 'crystals') {
      this.zoneProgress = 0;
    } else if (z.type === 'time') {
      this.zoneProgress = z.target;
    }
  },

  jumpToZone(zNum) {
    if (this.state !== 'playing') this.state = 'playing';
    if (typeof overlay !== 'undefined' && overlay) overlay.classList.add('hidden');
    const idx = Math.max(0, zNum - 1);
    this.initZone(idx);
    const vp = this.getViewport();
    this.player.x = vp.vw / 2;
    this.player.y = vp.vh - Math.max(90, vp.vh * 0.14);
    this.player.vx = 0;
    this.player.vy = 0;
    if (typeof renderHUD === 'function') renderHUD();
    if (typeof renderHUDNumbers === 'function') renderHUDNumbers();
  },

  getZoneConfig() {
    if (this.currentZoneIdx < ESCAPE_ZONES.length) {
      return ESCAPE_ZONES[this.currentZoneIdx];
    }
    // Zone 6+ (Endless Overclocked Mode)
    const loopNum = Math.floor((this.currentZoneIdx - 1) / ESCAPE_ZONES.length) + 1;
    return {
      id: this.currentZoneIdx + 1,
      name: `Overclocked Void (Loop ${loopNum})`,
      type: 'distance',
      target: 10000 + loopNum * 2500,
      bgTheme: 'overclocked',
      desc: 'Progressive hazard matrix! Starts with asteroids, adding plasma, lasers, and singularity over time!',
      accentColor: '#ff2a6d',
      badge: `LOOP ${loopNum}`
    };
  },

  getBgTheme() {
    return this.getZoneConfig().bgTheme;
  },

  /* ---------------------------------------------------------
     SCROLLING ORGANIC CAVERN SYSTEM (Zone 5 & Overclocked)
  --------------------------------------------------------- */
  initCavern() {
    const vp = this.getViewport();
    const W = vp.vw;
    const H = vp.vh;
    this.caveNodes = [];
    this.caveLastLeft = 70;
    this.caveLastRight = W - 70;
    this.cavePillarState = 'idle';
    this.cavePillarStep = 0;

    // Pre-populate continuous nodes from y = H + 100 up to y = -100 at 25px steps
    for (let y = H + 120; y >= -120; y -= 25) {
      this.caveNodes.push(this.createCaveNode(y));
    }
  },

  createCaveNode(y) {
    const vp = this.getViewport();
    const W = vp.vw;

    // Organic natural drift for left and right cave walls
    this.caveLastLeft = clamp(this.caveLastLeft + rand(-10, 10), 45, W * 0.35);
    this.caveLastRight = clamp(this.caveLastRight + rand(-10, 10), W * 0.65, W - 45);

    // Maintain minimum tunnel clearance width
    if (this.caveLastRight - this.caveLastLeft < 240) {
      this.caveLastRight = this.caveLastLeft + 240;
    }

    let pillarLeft = null;
    let pillarRight = null;

    // Scrolling Central Rock Pillar Island Event (Longer split tunnels!)
    if (this.cavePillarState === 'active') {
      this.cavePillarStep++;
      const progress = this.cavePillarStep / this.cavePillarLength;
      if (progress >= 1) {
        this.cavePillarState = 'idle';
      } else {
        // Island width expands in the middle and tapers off at both ends
        const pWidth = Math.sin(progress * Math.PI) * 80;
        if (pWidth > 8) {
          pillarLeft = W / 2 - pWidth / 2;
          pillarRight = W / 2 + pWidth / 2;
        }
      }
    } else {
      // Slightly higher chance to start a longer scrolling pillar island from top
      if (Math.random() < 0.05) {
        this.cavePillarState = 'active';
        this.cavePillarStep = 0;
        this.cavePillarLength = randInt(28, 48);
      }
    }

    return {
      y,
      leftX: this.caveLastLeft,
      rightX: this.caveLastRight,
      pillarLeft,
      pillarRight
    };
  },

  updateCavern(dt, scrollSpeed) {
    const vp = this.getViewport();
    const H = vp.vh;

    // Scroll all cavern nodes downward towards the player
    for (const node of this.caveNodes) {
      node.y += (scrollSpeed * dt) / 1000;
    }

    // Remove nodes that scrolled off bottom of screen
    this.caveNodes = this.caveNodes.filter(n => n.y <= H + 140);

    // Continuous generation of new cavern nodes at top
    if (this.caveNodes.length > 0) {
      let topY = this.caveNodes[this.caveNodes.length - 1].y;
      while (topY > -100) {
        topY -= 25;
        const newNode = this.createCaveNode(topY);
        this.caveNodes.push(newNode);
      }
    }
  },

  getCavernBoundsAtY(targetY) {
    const vp = this.getViewport();
    const W = vp.vw;

    if (!this.caveNodes || this.caveNodes.length < 2) {
      return { leftMargin: 60, rightMargin: W - 60, isPillar: false, pillarLeft: 0, pillarRight: 0 };
    }

    // Find node segment surrounding targetY
    let n1 = null, n2 = null;
    for (let i = 0; i < this.caveNodes.length - 1; i++) {
      const a = this.caveNodes[i];
      const b = this.caveNodes[i + 1];
      if ((a.y >= targetY && b.y <= targetY) || (b.y >= targetY && a.y <= targetY)) {
        n1 = a; n2 = b;
        break;
      }
    }

    if (!n1 || !n2) {
      return { leftMargin: 60, rightMargin: W - 60, isPillar: false, pillarLeft: 0, pillarRight: 0 };
    }

    const dy = Math.abs(n1.y - n2.y);
    const t = dy > 0.001 ? Math.abs(targetY - n1.y) / dy : 0;
    const leftMargin = n1.leftX + (n2.leftX - n1.leftX) * t;
    const rightMargin = n1.rightX + (n2.rightX - n1.rightX) * t;

    let isPillar = false, pillarLeft = 0, pillarRight = 0;
    if (n1.pillarLeft !== null && n2.pillarLeft !== null) {
      isPillar = true;
      pillarLeft = n1.pillarLeft + (n2.pillarLeft - n1.pillarLeft) * t;
      pillarRight = n1.pillarRight + (n2.pillarRight - n1.pillarRight) * t;
    }

    return { leftMargin, rightMargin, isPillar, pillarLeft, pillarRight };
  },

  hit() {
    if (this.invuln > 0 || this.shieldTime > 0 || this.state === 'warping') return;

    this.lives--;
    this.invuln = 1400;

    const pColor = getComputedColor('--player') || '#ff3d81';
    for (let i = 0; i < 22; i++) {
      this.particles.push(spark(this.player.x, this.player.y, pColor));
    }

    if (this.lives <= 0) {
      this.state = 'over';
      this.score = Math.floor(this.score);
      this.checkBestScore();
      showEscapeGameOver();
    }
    renderHUD();
  },

  completeZone() {
    if (this.state === 'warping') return;
    this.checkBestScore();
    this.state = 'warping';
    this.warpTimer = 0;

    const healMsg = this.lives < this.maxLives ? ' +1 REPAIR' : ' SHIELDED';
    this.lives = Math.min(this.maxLives, this.lives + 1);

    const currZ = this.getZoneConfig();
    this.warpBannerText = `${currZ.name.toUpperCase()} ESCAPED!${healMsg}`;
    this.bannerAlpha = 1.0;

    const vp = this.getViewport();
    this.warpSpeedLines = [];
    for (let i = 0; i < 60; i++) {
      this.warpSpeedLines.push({
        x: rand(0, vp.vw),
        y: rand(0, vp.vh),
        len: rand(40, 180),
        speed: rand(900, 1800),
        color: currZ.accentColor
      });
    }

    renderHUDNumbers();
  },

  update(dt) {
    if (this.state === 'idle' || this.state === 'over') return;

    const vp = this.getViewport();
    const W = vp.vw;
    const H = vp.vh;

    // --- WARP TRANSITION LOGIC ---
    if (this.state === 'warping') {
      this.warpTimer += dt;
      const targetX = W / 2;
      const targetY = H * 0.25;
      this.player.x += (targetX - this.player.x) * (dt * 0.004);
      this.player.y += (targetY - this.player.y) * (dt * 0.004);

      for (const line of this.warpSpeedLines) {
        line.y += line.speed * (dt / 1000);
        if (line.y > H) {
          line.y = -line.len;
          line.x = rand(0, W);
        }
      }

      updateParticles(this.particles, dt);

      if (this.warpTimer >= this.warpDuration) {
        this.currentZoneIdx++;
        this.state = 'playing';
        this.initZone(this.currentZoneIdx);
        this.player.y = H - Math.max(90, H * 0.14);
        renderHUD();
      }
      return;
    }

    // --- PLAYING LOGIC ---
    this.t += dt;
    this.zoneTime += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shieldTime > 0) this.shieldTime -= dt;

    const z = this.getZoneConfig();
    const zoneSecs = this.zoneTime / 1000;
    const isOverclocked = z.bgTheme === 'overclocked';
    const speedAccel = isOverclocked ? Math.min(zoneSecs * 2.0, 90) : Math.min(zoneSecs * 3.8, 195);
    const travelSpeed = 70 + speedAccel;

    // Update Cavern Scrolling Nodes & Magma Geysers (Zone 5 Cavern ONLY)
    if (z.bgTheme === 'cavern') {
      this.updateCavern(dt, travelSpeed * 2.2);
      this.updateGeysers(dt, travelSpeed * 2.2);
    }

    // Zone Objective Progress Update
    if (z.type === 'distance') {
      const distDelta = (travelSpeed * dt) / 1000;
      this.zoneProgress = Math.max(0, this.zoneProgress - distDelta);
      this.score += distDelta * 1.5;

      if (this.zoneProgress <= 0) {
        this.completeZone();
        return;
      }
    } else if (z.type === 'time') {
      this.zoneProgress = Math.max(0, this.zoneProgress - dt / 1000);
      this.score += dt * 0.015;

      if (this.zoneProgress <= 0) {
        this.completeZone();
        return;
      }
    } else if (z.type === 'crystals') {
      this.score += dt * 0.01;
      if (this.zoneProgress >= z.target) {
        this.completeZone();
        return;
      }
    }

    // --- PLAYER MOVEMENT ---
    const targetSpeed = 820;
    const keyActive = input.keys['arrowleft'] || input.keys['a'] || input.keys['arrowright'] || input.keys['d'] || input.keys['arrowup'] || input.keys['w'] || input.keys['arrowdown'] || input.keys['s'];
    if (keyActive) input.mouseActive = false;

    if (!keyActive && input.mouseActive && input.x != null) {
      const dx = input.x - this.player.x;
      this.player.vx = clamp(dx * 10, -targetSpeed, targetSpeed);
    } else if (!keyActive) {
      this.player.vx *= 0.9;
    }

    if (!keyActive && input.mouseActive && input.y != null) {
      const dy = input.y - this.player.y;
      this.player.vy = clamp(dy * 10, -targetSpeed, targetSpeed);
    } else if (!keyActive) {
      this.player.vy = (this.player.vy || 0) * 0.9;
    }

    if (keyActive) {
      let kx = 0, ky = 0;
      if (input.keys['arrowleft'] || input.keys['a']) kx -= 1;
      if (input.keys['arrowright'] || input.keys['d']) kx += 1;
      if (input.keys['arrowup'] || input.keys['w']) ky -= 1;
      if (input.keys['arrowdown'] || input.keys['s']) ky += 1;

      const keySpeed = 500;
      const norm = (kx !== 0 && ky !== 0) ? Math.SQRT1_2 : 1;
      this.player.vx = kx * keySpeed * norm;
      this.player.vy = ky * keySpeed * norm;
    }

    // Black Hole Gravitational Pull (Zone 4 & Overclocked Phase 4 after 36s)
    if (z.bgTheme === 'blackhole' || (z.bgTheme === 'overclocked' && zoneSecs >= 36)) {
      const pullX = (W / 2 - this.player.x) * 0.3;
      const pullY = (H * 0.35 - this.player.y) * 0.3;
      this.player.vx += pullX * (dt / 1000);
      this.player.vy += pullY * (dt / 1000);
    }

    this.player.x = clamp(this.player.x + (this.player.vx * dt) / 1000, 24, W - 24);
    this.player.y = clamp(this.player.y + ((this.player.vy || 0) * dt) / 1000, 64 + 24, H - 24);

    // Cavern Wall Collisions (Zone 5 Cavern ONLY)
    if (z.bgTheme === 'cavern') {
      const bounds = this.getCavernBoundsAtY(this.player.y);
      if (this.player.x - this.player.r < bounds.leftMargin || this.player.x + this.player.r > bounds.rightMargin) {
        this.hit();
      }
      if (bounds.isPillar && (this.player.x + this.player.r > bounds.pillarLeft && this.player.x - this.player.r < bounds.pillarRight)) {
        this.hit();
      }
    }

    // --- SPAWN LOGIC PER ZONE ---
    const baseSpawnRate = z.bgTheme === 'plasma' ? 550 : (z.bgTheme === 'overclocked' ? 680 : 800);
    const spawnDecay = isOverclocked ? zoneSecs * 4 : zoneSecs * 8;
    this.spawnInterval = clamp(baseSpawnRate - spawnDecay, 220, baseSpawnRate);
    this.spawnTimer += dt;

    if (this.spawnTimer > this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnHazardsForZone(z);
    }

    // --- ENTITY UPDATES & COLLISIONS ---
    this.updateRocks(dt);
    this.updatePlasmaOrbs(dt);
    this.updateLasers(dt);
    this.updateVoidMines(dt);
    this.updateCaveBats(dt);
    this.updateGems(dt);

    updateParticles(this.particles, dt);
    renderHUDNumbers();
    this.checkBestScore();
    this.updateCursorVisibility();
  },

  spawnHazardsForZone(z) {
    const vp = this.getViewport();
    const W = vp.vw;
    const H = vp.vh;
    const theme = z.bgTheme;
    const zoneSecs = this.zoneTime / 1000;
    const isOverclocked = theme === 'overclocked';
    const accel = isOverclocked ? Math.min(zoneSecs * 0.008, 0.35) : Math.min(zoneSecs * 0.018, 1.3);
    const hazardSpeedMult = 1 + accel;

    // Pick gem/crystal vs hazard ratio
    const gemChance = z.type === 'crystals' ? 0.45 : 0.22;
    if (Math.random() < gemChance) {
      const isSpecial = z.type === 'time' && Math.random() < 0.35;
      const isShield = (z.bgTheme === 'blackhole' || z.bgTheme === 'cavern') && Math.random() < 0.25;
      this.gems.push({
        x: rand(50, W - 50),
        y: -20,
        r: isSpecial || isShield ? 12 : 9,
        vy: rand(160, 240) * hazardSpeedMult,
        type: isShield ? 'shield' : (isSpecial ? 'chrono' : 'standard')
      });
    }

    // Zone 1: Asteroids (Active 0s-24s, removed 24s-48s, re-added 48s+ in Zone 6)
    if (theme === 'asteroid' || (theme === 'overclocked' && (zoneSecs < 24 || zoneSecs >= 48))) {
      const r = rand(16, 34);
      const pts = 7;
      const offsets = [];
      for (let i = 0; i < pts; i++) offsets.push(rand(0.75, 1.1));
      this.rocks.push({
        x: rand(40, W - 40),
        y: -30,
        r,
        vy: (rand(160, 280) + zoneSecs * 3.5) * hazardSpeedMult,
        rot: rand(0, 7),
        vr: rand(-2, 2),
        offsets
      });
    }

    // Zone 4: Black Hole Homing Void Mines (Active 12s-36s in Zone 6, removed at 36s)
    if (theme === 'blackhole' || (theme === 'overclocked' && zoneSecs >= 12 && zoneSecs < 36)) {
      const count = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        this.voidMines.push({
          x: rand(40, W - 40),
          y: -20,
          r: 14,
          vx: 0,
          vy: (rand(140, 240) + zoneSecs * 3.5) * hazardSpeedMult,
          pulse: rand(0, Math.PI * 2)
        });
      }
    }

    // Zone 2: Plasma Nebula Orbs (Added at 24s+ in Zone 6)
    if (theme === 'plasma' || (theme === 'overclocked' && zoneSecs >= 24)) {
      this.plasmaOrbs.push({
        x: rand(50, W - 50),
        y: -30,
        baseR: rand(20, 34),
        pulseSpeed: rand(6, 12),
        t: rand(0, Math.PI * 2),
        vy: (rand(240, 380) + zoneSecs * 4) * hazardSpeedMult,
        vx: rand(-60, 60)
      });
    }

    // Zone 3: Cyber Lasers (Added at 36s+ in Zone 6 - Moderated)
    if (theme === 'cyber' || (theme === 'overclocked' && zoneSecs >= 36)) {
      const isOverclocked = theme === 'overclocked';

      if (isOverclocked) {
        // Moderated laser spawning in Zone 6 (No full-screen wall lockdowns)
        if (Math.random() < 0.45) {
          const lType = Math.random();
          if (lType < 0.85) {
            // Standard Single Beam with 1400ms warning
            const isHorizontal = Math.random() < 0.5;
            this.lasers.push({
              type: 'beam',
              isHorizontal,
              pos: isHorizontal ? rand(64 + 60, H - 60) : rand(40, W - 40),
              warnTimer: Math.max(900, 1400 / (1 + zoneSecs * 0.01)),
              fireTimer: 700,
              width: rand(18, 24),
              state: 'warning'
            });
          } else {
            // Rare Dual Cross Beam with 1500ms warning
            const hPos = rand(64 + 60, H - 60);
            const vPos = rand(40, W - 40);
            const wTime = Math.max(950, 1500 / (1 + zoneSecs * 0.01));
            this.lasers.push({ type: 'beam', isHorizontal: true, pos: hPos, warnTimer: wTime, fireTimer: 700, width: 20, state: 'warning' });
            this.lasers.push({ type: 'beam', isHorizontal: false, pos: vPos, warnTimer: wTime, fireTimer: 700, width: 20, state: 'warning' });
          }
        }
      } else {
        // Zone 3 Full Cyber Matrix
        const lType = Math.random();
        if (lType < 0.4) {
          const isHorizontal = Math.random() < 0.5;
          this.lasers.push({
            type: 'beam',
            isHorizontal,
            pos: isHorizontal ? rand(64 + 60, H - 60) : rand(40, W - 40),
            warnTimer: Math.max(700, 1300 / (1 + zoneSecs * 0.015)),
            fireTimer: 750,
            width: rand(20, 30),
            state: 'warning'
          });
        } else if (lType < 0.75) {
          const hPos = rand(64 + 60, H - 60);
          const vPos = rand(40, W - 40);
          const wTime = Math.max(750, 1350 / (1 + zoneSecs * 0.015));
          this.lasers.push({ type: 'beam', isHorizontal: true, pos: hPos, warnTimer: wTime, fireTimer: 750, width: 24, state: 'warning' });
          this.lasers.push({ type: 'beam', isHorizontal: false, pos: vPos, warnTimer: wTime, fireTimer: 750, width: 24, state: 'warning' });
        } else {
          const side = Math.random() < 0.5 ? 'left' : 'right';
          this.lasers.push({
            type: 'wall',
            side,
            warnTimer: Math.max(800, 1400 / (1 + zoneSecs * 0.015)),
            fireTimer: 900,
            state: 'warning'
          });
        }
      }
    }

    // Zone 5: Wall Magma Geysers (Zone 5 Cavern ONLY - Excluded from Zone 6)
    if (theme === 'cavern') {
      if (Math.random() < 0.7) {
        const side = Math.random() < 0.5 ? 'left' : 'right';
        this.geysers.push({
          side,
          y: -30,
          warnTimer: Math.max(750, 1200 / (1 + zoneSecs * 0.012)),
          fireTimer: 800,
          lengthRatio: rand(0.55, 0.68),
          state: 'warning'
        });
      }
    }
  },

  updateGeysers(dt, scrollSpeed) {
    const vp = this.getViewport();
    for (const g of this.geysers) {
      g.y += (scrollSpeed * dt) / 1000;

      if (g.state === 'warning') {
        g.warnTimer -= dt;
        if (g.warnTimer <= 0) g.state = 'firing';
      } else if (g.state === 'firing') {
        g.fireTimer -= dt;
        if (g.fireTimer <= 0) {
          g.state = 'cooldown';
          g.cooldownTimer = rand(1100, 1500);
        }

        // Collision check with player
        const bounds = this.getCavernBoundsAtY(g.y);
        const p = this.player;

        if (Math.abs(p.y - g.y) < (22 + p.r * 0.7)) {
          if (g.side === 'left') {
            const channelWidth = bounds.isPillar ? (bounds.pillarLeft - bounds.leftMargin) : (bounds.rightMargin - bounds.leftMargin);
            const jetEnd = bounds.leftMargin + channelWidth * g.lengthRatio;
            if (p.x - p.r < jetEnd) {
              this.hit();
            }
          } else {
            const channelWidth = bounds.isPillar ? (bounds.rightMargin - bounds.pillarRight) : (bounds.rightMargin - bounds.leftMargin);
            const jetStart = bounds.rightMargin - channelWidth * g.lengthRatio;
            if (p.x + p.r > jetStart) {
              this.hit();
            }
          }
        }
      } else if (g.state === 'cooldown') {
        g.cooldownTimer -= dt;
        if (g.cooldownTimer <= 0) {
          g.state = 'warning';
          g.warnTimer = 1100;
          g.fireTimer = 800;
        }
      }
    }
    this.geysers = this.geysers.filter(g => g.y <= vp.vh + 60);
  },

  updateRocks(dt) {
    const vp = this.getViewport();
    for (const r of this.rocks) {
      r.y += (r.vy * dt) / 1000;
      r.rot += (r.vr * dt) / 1000;
    }
    this.rocks = this.rocks.filter(r => {
      if (r.y - r.r > vp.vh) return false;
      if (dist2(r.x, r.y, this.player.x, this.player.y) < (r.r + this.player.r * 0.7) ** 2) {
        this.hit(); return false;
      }
      return true;
    });
  },

  updatePlasmaOrbs(dt) {
    const vp = this.getViewport();
    for (const orb of this.plasmaOrbs) {
      orb.y += (orb.vy * dt) / 1000;
      orb.x += (orb.vx * dt) / 1000;
      if (orb.x < orb.baseR || orb.x > vp.vw - orb.baseR) orb.vx *= -1;
      orb.t += (dt / 1000) * orb.pulseSpeed;
    }
    this.plasmaOrbs = this.plasmaOrbs.filter(orb => {
      if (orb.y - orb.baseR > vp.vh) return false;
      const currentR = orb.baseR + Math.sin(orb.t) * 6;
      if (dist2(orb.x, orb.y, this.player.x, this.player.y) < (currentR + this.player.r * 0.75) ** 2) {
        this.hit(); return false;
      }
      return true;
    });
  },

  updateLasers(dt) {
    const vp = this.getViewport();
    for (const l of this.lasers) {
      if (l.state === 'warning') {
        l.warnTimer -= dt;
        if (l.warnTimer <= 0) l.state = 'firing';
      } else if (l.state === 'firing') {
        l.fireTimer -= dt;
        if (l.fireTimer <= 0) l.state = 'done';

        if (l.type === 'wall') {
          if (l.side === 'left' && this.player.x - this.player.r < vp.vw * 0.46) {
            this.hit();
          } else if (l.side === 'right' && this.player.x + this.player.r > vp.vw * 0.54) {
            this.hit();
          }
        } else {
          if (l.isHorizontal) {
            if (Math.abs(this.player.y - l.pos) < (l.width / 2 + this.player.r * 0.7)) this.hit();
          } else {
            if (Math.abs(this.player.x - l.pos) < (l.width / 2 + this.player.r * 0.7)) this.hit();
          }
        }
      }
    }
    this.lasers = this.lasers.filter(l => l.state !== 'done');
  },

  updateVoidMines(dt) {
    const vp = this.getViewport();
    for (const m of this.voidMines) {
      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      m.vx += clamp(dx * 1.2, -160, 160) * (dt / 1000);
      m.vy += clamp(dy * 0.6 + 80, 60, 220) * (dt / 1000);
      m.x += (m.vx * dt) / 1000;
      m.y += (m.vy * dt) / 1000;
      m.pulse += (dt / 1000) * 5;
    }
    this.voidMines = this.voidMines.filter(m => {
      if (m.y - m.r > vp.vh + 40) return false;
      if (dist2(m.x, m.y, this.player.x, this.player.y) < (m.r + this.player.r * 0.75) ** 2) {
        this.hit(); return false;
      }
      return true;
    });
  },

  updateCaveBats(dt) {
    const vp = this.getViewport();
    for (const b of this.caveBats) {
      b.t += (dt / 1000) * b.wingFreq;
      b.x = b.x0 + Math.sin(b.t) * 75;
      b.y += (b.vy * dt) / 1000;
    }
    this.caveBats = this.caveBats.filter(b => {
      if (b.y - b.r > vp.vh + 40) return false;
      if (dist2(b.x, b.y, this.player.x, this.player.y) < (b.r + this.player.r * 0.75) ** 2) {
        this.hit(); return false;
      }
      return true;
    });
  },

  updateGems(dt) {
    const vp = this.getViewport();
    for (const g of this.gems) {
      g.y += (g.vy * dt) / 1000;
    }
    this.gems = this.gems.filter(g => {
      if (g.y - g.r > vp.vh) return false;
      if (dist2(g.x, g.y, this.player.x, this.player.y) < (g.r + this.player.r * 0.8) ** 2) {
        if (g.type === 'chrono') {
          const z = this.getZoneConfig();
          if (z.type === 'time') this.zoneProgress = Math.max(0, this.zoneProgress - 3);
          this.score += 60;
          for (let i = 0; i < 12; i++) this.particles.push(spark(g.x, g.y, '#00f2fe'));
        } else if (g.type === 'shield') {
          this.shieldTime = 3500;
          this.score += 50;
          for (let i = 0; i < 14; i++) this.particles.push(spark(g.x, g.y, '#a855f7'));
        } else {
          this.score += 40;
          this.crystals++;
          const z = this.getZoneConfig();
          if (z.type === 'crystals') this.zoneProgress++;
          for (let i = 0; i < 10; i++) this.particles.push(spark(g.x, g.y, 'var(--energy)'));
        }
        return false;
      }
      return true;
    });
  },

  draw() {
    const vp = this.getViewport();
    const W = vp.vw;
    const H = vp.vh;
    const p = this.player;
    const z = this.getZoneConfig();

    ctx.save();
    ctx.scale(vp.scale, vp.scale);

    // DRAW ORGANIC SCROLLING CAVERN WALLS & CENTRAL PILLARS (Zone 5 Cavern ONLY)
    if (z.bgTheme === 'cavern') {
      ctx.save();
      ctx.fillStyle = '#1c0e05';
      ctx.strokeStyle = '#ff8c00';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff8c00';
      ctx.shadowBlur = 12;

      if (this.caveNodes.length > 1) {
        // Left Rock Wall Polygon
        ctx.beginPath();
        ctx.moveTo(0, -100);
        for (let i = this.caveNodes.length - 1; i >= 0; i--) {
          const n = this.caveNodes[i];
          ctx.lineTo(n.leftX, n.y);
        }
        ctx.lineTo(0, H + 100);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Right Rock Wall Polygon
        ctx.beginPath();
        ctx.moveTo(W, -100);
        for (let i = this.caveNodes.length - 1; i >= 0; i--) {
          const n = this.caveNodes[i];
          ctx.lineTo(n.rightX, n.y);
        }
        ctx.lineTo(W, H + 100);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Central Rock Pillar Islands (Sits in middle of cavern and scrolls down)
        let pillarPoly = [];
        for (let i = this.caveNodes.length - 1; i >= 0; i--) {
          const n = this.caveNodes[i];
          if (n.pillarLeft !== null) {
            pillarPoly.push(n);
          } else if (pillarPoly.length > 0) {
            this.drawPillarIsland(ctx, pillarPoly);
            pillarPoly = [];
          }
        }
        if (pillarPoly.length > 0) {
          this.drawPillarIsland(ctx, pillarPoly);
        }
      }
      ctx.restore();
    }

    // WARP TUNNEL EFFECT DURING LEVEL ESCAPE TRANSITION
    if (this.state === 'warping') {
      ctx.save();
      for (const line of this.warpSpeedLines) {
        ctx.strokeStyle = line.color;
        ctx.globalAlpha = rand(0.4, 0.9);
        ctx.lineWidth = rand(1.5, 3.5);
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x, line.y + line.len);
        ctx.stroke();
      }
      ctx.restore();
      drawHypergatePortal(ctx, W / 2, H * 0.25, z.accentColor, this.warpTimer / 1000);
    }

    // DRAW HAZARDS
    for (const l of this.lasers) drawLaserHazard(ctx, l, W, H);
    for (const g of this.geysers) drawMagmaGeyser(ctx, g, this);

    for (const r of this.rocks) {
      ctx.save(); ctx.translate(r.x, r.y);
      const streakLen = r.r * 1.5 + r.vy * 0.08;
      const g = ctx.createLinearGradient(0, 0, 0, -streakLen);
      g.addColorStop(0, 'rgba(77, 216, 255, 0.28)');
      g.addColorStop(0.4, 'rgba(124, 92, 255, 0.16)');
      g.addColorStop(1, 'rgba(124, 92, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-r.r * 0.7, 0); ctx.lineTo(r.r * 0.7, 0);
      ctx.lineTo(r.r * 0.15, -streakLen); ctx.lineTo(-r.r * 0.15, -streakLen);
      ctx.closePath(); ctx.fill(); ctx.restore();

      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      drawRock(ctx, r); ctx.restore();
    }

    for (const orb of this.plasmaOrbs) drawPlasmaOrb(ctx, orb);
    for (const m of this.voidMines) drawVoidMine(ctx, m);
    for (const b of this.caveBats) drawCaveBat(ctx, b);
    for (const g of this.gems) drawGem(ctx, g);

    drawParticles(ctx, this.particles);

    // PLAYER SHIP
    ctx.save();
    ctx.translate(p.x, p.y);
    const blink = this.invuln > 0 && Math.floor(this.invuln / 100) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.rotate(clamp(p.vx * 0.0009, -0.5, 0.5));
    drawEscapeShip(ctx, p.r, getComputedColor('--player') || '#ff3d81', p.vx, p.vy, this.t / 1000);

    if (this.shieldTime > 0) {
      drawShieldBubble(ctx, p.r * 1.5, '#a855f7', this.t / 1000);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // DRAW MOUSE POINTER TARGET RETICLE (IF SHOW MOUSE IS ENABLED)
    if (this.showMouse && typeof input !== 'undefined' && input.mouseActive && input.x != null && input.y != null && (this.state === 'playing' || this.state === 'warping')) {
      ctx.save();
      const mx = input.x;
      const my = input.y;
      const time = performance.now() * 0.003;
      const accentColor = z.accentColor || '#4dd8ff';

      // Dashed laser targeting line from ship to pointer position
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(mx, my);
      ctx.stroke();

      // Glowing reticle target at pointer position
      ctx.translate(mx, my);
      ctx.rotate(time * 0.4);
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      const gap = 16;
      const tickLen = 6;
      ctx.beginPath();
      ctx.moveTo(gap, 0); ctx.lineTo(gap + tickLen, 0);
      ctx.moveTo(-gap, 0); ctx.lineTo(-gap - tickLen, 0);
      ctx.moveTo(0, gap); ctx.lineTo(0, gap + tickLen);
      ctx.moveTo(0, -gap); ctx.lineTo(0, -gap - tickLen);
      ctx.stroke();

      ctx.restore();
    }

    // CLOSE TO EXIT / TIME SURVIVED ON-SCREEN GLOWING ALERT (20% from Top)
    if (this.state === 'playing') {
      let isClose = false;
      let alertMsg = '';

      if (z.type === 'distance' && this.zoneProgress <= Math.min(900, z.target * 0.22)) {
        isClose = true;
        alertMsg = `⚡ HYPERGATE NEARBY — ${Math.ceil(this.zoneProgress)}m LEFT!`;
      } else if (z.type === 'time' && this.zoneProgress <= Math.min(10, z.target * 0.25)) {
        isClose = true;
        alertMsg = `⏳ WARP IMPENDING — ${Math.ceil(this.zoneProgress)}s SURVIVED!`;
      } else if (z.type === 'crystals' && (z.target - this.zoneProgress) <= 3) {
        isClose = true;
        const remaining = Math.max(0, z.target - this.zoneProgress);
        alertMsg = `💎 EXTRACTION NEAR — ${remaining} ${remaining === 1 ? 'CORE' : 'CORES'} LEFT!`;
      }

      if (isClose) {
        const now = performance.now();
        const pulse = Math.sin(now * 0.012) * 0.18 + 0.82;
        const textY = H * 0.12;

        ctx.save();
        ctx.font = '700 22px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(alertMsg).width;
        const pillW = textWidth + 36;
        const pillH = 42;

        ctx.shadowColor = z.accentColor;
        ctx.shadowBlur = 24 * pulse;
        ctx.fillStyle = 'rgba(10, 11, 26, 0.85)';
        ctx.strokeStyle = z.accentColor;
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(W / 2 - pillW / 2, textY - pillH / 2, pillW, pillH, 21);
        } else {
          ctx.rect(W / 2 - pillW / 2, textY - pillH / 2, pillW, pillH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = z.accentColor;
        ctx.shadowBlur = 18 * pulse;
        ctx.fillText(alertMsg, W / 2, textY);
        ctx.restore();
      }
    }

    // DANGER CORNER ACCENTS (Canvas rendering when lives === 1)
    if (this.state === 'playing' && this.lives === 1) {
      const now = performance.now();
      const pulse = Math.sin(now * 0.008) * 0.3 + 0.7;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 23, 68, ${0.85 * pulse})`;
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 24 * pulse;

      const cLen = 32;
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(14, 14 + cLen); ctx.lineTo(14, 14); ctx.lineTo(14 + cLen, 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - 14 - cLen, 14); ctx.lineTo(W - 14, 14); ctx.lineTo(W - 14, 14 + cLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, H - 14 - cLen); ctx.lineTo(14, H - 14); ctx.lineTo(14 + cLen, H - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - 14 - cLen, H - 14); ctx.lineTo(W - 14, H - 14); ctx.lineTo(W - 14, H - 14 - cLen); ctx.stroke();

      ctx.restore();
    }

    if (this.state === 'warping') {
      ctx.save();
      ctx.font = '700 22px "Chakra Petch", sans-serif';
      ctx.fillStyle = z.accentColor;
      ctx.textAlign = 'center';
      ctx.shadowColor = z.accentColor;
      ctx.shadowBlur = 16;
      ctx.fillText(this.warpBannerText, W / 2, H * 0.45);
      ctx.font = '600 14px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fillText('ENTERING NEXT ESCAPE SECTOR...', W / 2, H * 0.49);
      ctx.restore();
    }

    ctx.restore(); // Restore viewport scaling
  },

  drawPillarIsland(ctx, poly) {
    if (poly.length < 2) return;
    ctx.save();
    ctx.fillStyle = '#140803';
    ctx.strokeStyle = '#ff7700';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff7700';
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(poly[0].pillarLeft, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].pillarLeft, poly[i].y);
    }
    for (let i = poly.length - 1; i >= 0; i--) {
      ctx.lineTo(poly[i].pillarRight, poly[i].y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
};

/* ---------------------------------------------------------
   HUD & UI Helpers
--------------------------------------------------------- */
function updateDangerVignette(isCritical) {
  if (typeof document === 'undefined') return;
  let elem = document.getElementById('danger-vignette');
  if (!elem) {
    elem = document.createElement('div');
    elem.id = 'danger-vignette';
    document.body.appendChild(elem);
  }
  if (isCritical) {
    elem.classList.add('active');
  } else {
    elem.classList.remove('active');
  }
}

function renderHUDNumbers() {
  const s = document.getElementById('hv-score');
  if (s) s.textContent = Math.floor(escapeGame.score);
  const h = document.getElementById('hearts');
  if (h) {
    h.innerHTML = heartsHTML(escapeGame.lives, escapeGame.maxLives);
    const heartsChip = h.closest ? h.closest('.hud-chip') : h.parentElement;
    const isCriticalHealth = escapeGame.lives === 1 && escapeGame.state === 'playing';
    if (heartsChip) {
      heartsChip.classList.toggle('critical-health', isCriticalHealth);
    }
    updateDangerVignette(isCriticalHealth);
  }

  const z = escapeGame.getZoneConfig();
  const zoneTag = document.getElementById('escape-zone-tag');
  if (zoneTag) {
    const newText = `${z.badge}: ${z.name}`;
    if (zoneTag.getAttribute('data-zone-text') !== newText) {
      zoneTag.setAttribute('data-zone-text', newText);
      zoneTag.textContent = newText;
      zoneTag.style.color = z.accentColor;
    }
  }

  const objVal = document.getElementById('escape-obj-val');
  const objLbl = document.getElementById('escape-obj-lbl');
  if (objVal && objLbl) {
    let isNearExit = false;
    if (z.type === 'distance') {
      objLbl.textContent = 'DISTANCE';
      objVal.textContent = `${Math.ceil(escapeGame.zoneProgress)}m`;
      isNearExit = escapeGame.zoneProgress <= Math.min(900, z.target * 0.22);
    } else if (z.type === 'crystals') {
      objLbl.textContent = 'CRYSTALS';
      objVal.textContent = `${escapeGame.zoneProgress} / ${z.target}`;
      isNearExit = (z.target - escapeGame.zoneProgress) <= 3;
    } else if (z.type === 'time') {
      objLbl.textContent = 'TIME SURVIVED';
      objVal.textContent = `${Math.ceil(escapeGame.zoneProgress)}s`;
      isNearExit = escapeGame.zoneProgress <= Math.min(10, z.target * 0.25);
    }

    const chip = objVal.closest ? objVal.closest('.hud-chip') : objVal.parentElement;
    if (chip) {
      if (isNearExit) {
        chip.style.boxShadow = `0 0 22px ${z.accentColor}, inset 0 0 12px ${z.accentColor}`;
        chip.style.borderColor = z.accentColor;
        chip.style.transform = 'scale(1.06)';
        chip.style.transition = 'all 0.3s ease';
      } else {
        chip.style.boxShadow = '';
        chip.style.borderColor = '';
        chip.style.transform = '';
      }
    }
  }
}

function showEscapeGameOver() {
  updateDangerVignette(false);
  escapeGame.checkBestScore();
  const z = escapeGame.getZoneConfig();
  const modeLabel = escapeGame.isOverclockedMode ? 'ENDLESS OVERCLOCKED' : 'STANDARD ESCAPE RUN';

  let objProgressHTML = '';
  if (z.type === 'distance') {
    const remMeters = Math.ceil(escapeGame.zoneProgress);
    objProgressHTML = `<div style="margin-top:6px; color:#ffe600; font-weight:600; font-size:0.9rem;">📍 You only had <b>${remMeters}m</b> left to reach the hypergate!</div>`;
  } else if (z.type === 'time') {
    const remSecs = Math.ceil(escapeGame.zoneProgress);
    objProgressHTML = `<div style="margin-top:6px; color:#ffe600; font-weight:600; font-size:0.9rem;">⏳ You only had <b>${remSecs}s</b> remaining to survive the sector warp!</div>`;
  } else if (z.type === 'crystals') {
    const remCores = Math.max(0, z.target - escapeGame.zoneProgress);
    objProgressHTML = `<div style="margin-top:6px; color:#ffe600; font-weight:600; font-size:0.9rem;">💎 You only needed <b>${remCores} ${remCores === 1 ? 'core' : 'cores'}</b> needed to finish extraction!</div>`;
  }

  panel.innerHTML = `
    <h1 class="title loss-title">RUN OVER</h1>
    <div id="gate">${gateSVG('escape')}</div>
    <div style="font-size:0.8rem; letter-spacing:1.5px; text-transform:uppercase; color:var(--hazard); font-weight:700; margin-bottom:8px;">${modeLabel}</div>
    <div class="stat-row">
      <div class="stat"><span class="num">${Math.floor(escapeGame.score)}</span><span class="lbl">Score</span></div>
      <div class="stat"><span class="num" id="escape-game-over-best">${escapeGame.best}</span><span class="lbl">Best (${escapeGame.isOverclockedMode ? 'Endless' : 'Normal'})</span></div>
      <div class="stat"><span class="num">${escapeGame.crystals}</span><span class="lbl">Crystals</span></div>
    </div>
    <p class="desc">Destroyed in <b>${z.name}</b>. ${objProgressHTML}</p>
    <div style="display:flex; gap:10px; width:100%; justify-content:center; margin-top:12px;">
      <button id="btn-retry" style="flex:1;">Try Again</button>
      <button id="btn-menu" style="flex:1; background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.2);">Main Menu</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  document.getElementById('btn-retry').addEventListener('click', () => {
    if (typeof requestFullscreenMode === 'function') requestFullscreenMode();
    overlay.classList.add('hidden');
    if (escapeGame.isOverclockedMode) {
      escapeGame.startOverclocked();
    } else {
      escapeGame.start();
    }
  });
  document.getElementById('btn-menu').addEventListener('click', () => {
    if (typeof showStart === 'function') showStart();
  });
}

/* ---------------------------------------------------------
   Sprite Drawing & Hazards Visual Effects
--------------------------------------------------------- */
function drawEscapeShip(ctx, r, color, vx, vy, t) {
  ctx.save();
  const pulse = Math.sin((t || 0) * 12) * 0.15 + 0.85;
  const accentColor = getComputedColor('--hazard') || '#4dd8ff';

  // Dual Thruster Plumes
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * pulse;
  ctx.fillStyle = color;
  ctx.beginPath();
  const flame1 = r * (0.8 + Math.random() * 0.4);
  const flame2 = r * (0.8 + Math.random() * 0.4);
  ctx.moveTo(-r * 0.4, r * 0.6);
  ctx.lineTo(-r * 0.3, r * 0.6 + flame1);
  ctx.lineTo(-r * 0.2, r * 0.6);
  ctx.moveTo(r * 0.2, r * 0.6);
  ctx.lineTo(r * 0.3, r * 0.6 + flame2);
  ctx.lineTo(r * 0.4, r * 0.6);
  ctx.fill();
  ctx.restore();

  // Outer Wing Silhouette
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillStyle = '#0a0b16';

  ctx.beginPath();
  ctx.moveTo(0, -r * 1.65);
  ctx.lineTo(-r * 0.35, -r * 0.6);
  ctx.lineTo(-r * 1.35, r * 0.7);
  ctx.lineTo(-r * 1.1, r * 0.85);
  ctx.lineTo(-r * 0.45, r * 0.55);
  ctx.lineTo(0, r * 0.8);
  ctx.lineTo(r * 0.45, r * 0.55);
  ctx.lineTo(r * 1.1, r * 0.85);
  ctx.lineTo(r * 1.35, r * 0.7);
  ctx.lineTo(r * 0.35, -r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner Armor Panel Plates
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#26183b';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.lineTo(-r * 0.6, r * 0.2);
  ctx.lineTo(0, r * 0.4);
  ctx.lineTo(r * 0.6, r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Neon Energy Lines
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.5);
  ctx.lineTo(-r * 1.1, r * 0.5);
  ctx.moveTo(r * 0.35, -r * 0.5);
  ctx.lineTo(r * 1.1, r * 0.5);
  ctx.stroke();

  // Cockpit Canopy
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 12;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.lineTo(-r * 0.25, -r * 0.1);
  ctx.lineTo(0, r * 0.2);
  ctx.lineTo(r * 0.25, -r * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawShieldBubble(ctx, r, color, t) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.fillStyle = 'rgba(168, 85, 247, 0.18)';

  const pulseR = r + Math.sin(t * 8) * 2;
  ctx.beginPath();
  ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRock(ctx, rock) {
  ctx.save();
  const r = typeof rock === 'object' ? rock.r : rock;
  const offsets = (typeof rock === 'object' && rock.offsets) ? rock.offsets : [0.9, 1.05, 0.8, 1.0, 0.85, 1.05, 0.95];
  const pts = offsets.length;

  ctx.fillStyle = '#4a4f68';
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * offsets[i];
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner crater detail lines
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.2);
  ctx.lineTo(r * 0.1, r * 0.1);
  ctx.lineTo(-r * 0.1, r * 0.4);
  ctx.stroke();

  ctx.restore();
}

function drawPlasmaOrb(ctx, orb) {
  ctx.save();
  ctx.translate(orb.x, orb.y);
  const currentR = orb.baseR + Math.sin(orb.t) * 6;
  const color = '#e056fd';

  ctx.shadowColor = color;
  ctx.shadowBlur = 18;

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentR);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, '#e056fd');
  grad.addColorStop(1, 'rgba(124, 58, 237, 0.15)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, currentR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawLaserHazard(ctx, laser, W, H) {
  if (typeof W === 'undefined') {
    const vp = typeof escapeGame !== 'undefined' ? escapeGame.getViewport() : { vw: 540, vh: 960 };
    W = vp.vw; H = vp.vh;
  }
  ctx.save();
  const now = performance.now();
  const blinkRatio = Math.sin(now * 0.012) * 0.5 + 0.5;

  if (laser.state === 'warning') {
    if (laser.type === 'wall') {
      const x1 = laser.side === 'left' ? 0 : W * 0.54;
      const w = W * 0.46;
      ctx.fillStyle = `rgba(255, 42, 109, ${0.12 + blinkRatio * 0.16})`;
      ctx.fillRect(x1, 64, w, H - 64);

      const lineX = laser.side === 'left' ? W * 0.46 : W * 0.54;
      ctx.strokeStyle = '#ff2a6d';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(lineX, 64); ctx.lineTo(lineX, H);
      ctx.stroke();

      ctx.save();
      ctx.font = '700 16px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#ff2a6d';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.6 + blinkRatio * 0.4;
      const textX = laser.side === 'left' ? W * 0.23 : W * 0.77;
      ctx.fillText('⚠️ SECTOR LOCKDOWN', textX, H * 0.45);
      ctx.fillText('LASER WALL INCOMING', textX, H * 0.49);
      ctx.restore();

    } else if (laser.isHorizontal) {
      ctx.fillStyle = `rgba(255, 42, 109, ${0.08 + blinkRatio * 0.12})`;
      ctx.fillRect(0, laser.pos - laser.width / 2, W, laser.width);

      ctx.strokeStyle = '#ff2a6d';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, laser.pos); ctx.lineTo(W, laser.pos);
      ctx.stroke();

    } else {
      ctx.fillStyle = `rgba(255, 42, 109, ${0.08 + blinkRatio * 0.12})`;
      ctx.fillRect(laser.pos - laser.width / 2, 64, laser.width, H - 64);

      ctx.strokeStyle = '#ff2a6d';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(laser.pos, 64); ctx.lineTo(laser.pos, H);
      ctx.stroke();
    }

  } else if (laser.state === 'firing') {
    const color = '#00f2fe';
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(0, 242, 254, 0.32)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    if (laser.type === 'wall') {
      const x1 = laser.side === 'left' ? 0 : W * 0.54;
      const w = W * 0.46;
      ctx.fillRect(x1, 64, w, H - 64);
      ctx.beginPath();
      ctx.moveTo(laser.side === 'left' ? W * 0.46 : W * 0.54, 64);
      ctx.lineTo(laser.side === 'left' ? W * 0.46 : W * 0.54, H);
      ctx.stroke();
    } else if (laser.isHorizontal) {
      ctx.fillRect(0, laser.pos - laser.width / 2, W, laser.width);
      ctx.beginPath(); ctx.moveTo(0, laser.pos); ctx.lineTo(W, laser.pos); ctx.stroke();
    } else {
      ctx.fillRect(laser.pos - laser.width / 2, 64, laser.width, H - 64);
      ctx.beginPath(); ctx.moveTo(laser.pos, 64); ctx.lineTo(laser.pos, H); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMagmaGeyser(ctx, g, escapeObj) {
  const bounds = escapeObj.getCavernBoundsAtY(g.y);
  const wallX = g.side === 'left' ? bounds.leftMargin : bounds.rightMargin;
  const dir = g.side === 'left' ? 1 : -1;

  ctx.save();
  const now = performance.now();
  const warnProgress = g.warnTimer ? clamp(1 - g.warnTimer / 1200, 0, 1) : 0;
  const pulseFreq = 0.012 + warnProgress * 0.025;
  const pulse = Math.sin(now * pulseFreq) * 0.5 + 0.5;

  const coneDepth = 22;
  const craterX = wallX + dir * coneDepth;

  // 1. MINI VOLCANO CONE (Dome-shaped /^\ curve sloping down at crater tip)
  ctx.save();
  ctx.fillStyle = '#26140b';
  ctx.strokeStyle = '#ff7700';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ff4500';
  ctx.shadowBlur = 8 + pulse * 6;

  ctx.beginPath();
  if (g.side === 'left') {
    // Base bottom on wall -> smooth upward & right curve to top lip -> concave crater mouth -> smooth downward curve back to base top
    ctx.moveTo(wallX - 4, g.y + 20);
    ctx.bezierCurveTo(wallX + 8, g.y + 18, craterX - 4, g.y + 12, craterX, g.y + 7);
    ctx.bezierCurveTo(craterX - 5, g.y + 3, craterX - 5, g.y - 3, craterX, g.y - 7);
    ctx.bezierCurveTo(craterX - 4, g.y - 12, wallX + 8, g.y - 18, wallX - 4, g.y - 20);
  } else {
    // Base bottom on wall -> smooth upward & left curve to top lip -> concave crater mouth -> smooth downward curve back to base top
    ctx.moveTo(wallX + 4, g.y + 20);
    ctx.bezierCurveTo(wallX - 8, g.y + 18, craterX + 4, g.y + 12, craterX, g.y + 7);
    ctx.bezierCurveTo(craterX + 5, g.y + 3, craterX + 5, g.y - 3, craterX, g.y - 7);
    ctx.bezierCurveTo(craterX + 4, g.y - 12, wallX - 8, g.y - 18, wallX + 4, g.y - 20);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Basalt Slope Detail Ridges
  ctx.strokeStyle = '#422213';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(wallX, g.y - 12); ctx.quadraticCurveTo(wallX + dir * 8, g.y - 8, craterX - dir * 4, g.y - 4);
  ctx.moveTo(wallX, g.y + 12); ctx.quadraticCurveTo(wallX + dir * 8, g.y + 8, craterX - dir * 4, g.y + 4);
  ctx.stroke();
  ctx.restore();

  // 2. COOLDOWN STATE: RESTING CRATER & SMOKE EMBERS
  if (g.state === 'cooldown') {
    ctx.save();
    ctx.fillStyle = '#ff4500';
    ctx.shadowColor = '#ff4500';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(craterX, g.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Subtle smoke wisps
    ctx.fillStyle = 'rgba(255, 140, 0, 0.4)';
    for (let i = 0; i < 2; i++) {
      const ex = craterX + dir * (4 + i * 4);
      const ey = g.y + Math.sin(now * 0.005 + i) * 4;
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

  } else if (g.state === 'warning') {
    // 3. WARNING STATE: PULSING MOLTEN MAGMA GLOW
    const glowRadius = 10 + pulse * 8 + warnProgress * 6;
    const glowAlpha = 0.5 + pulse * 0.45 + warnProgress * 0.3;

    ctx.save();
    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur = 20 + warnProgress * 15;

    const coreGrad = ctx.createRadialGradient(craterX, g.y, 0, craterX, g.y, glowRadius * 1.6);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.3, `rgba(255, 120, 0, ${glowAlpha})`);
    coreGrad.addColorStop(0.7, `rgba(255, 34, 0, ${glowAlpha * 0.7})`);
    coreGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(craterX, g.y, glowRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(craterX, g.y, 6 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff8c00';
    for (let i = 0; i < 3; i++) {
      const ex = craterX + dir * rand(2, 10);
      const ey = g.y + rand(-7, 7);
      ctx.beginPath();
      ctx.arc(ex, ey, rand(1, 2.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

  } else if (g.state === 'firing') {
    // 3. FIRING STATE: PLASMA JET ERUPTION FROM NARROW VOLCANO CRATER
    const channelWidth = g.side === 'left'
      ? (bounds.isPillar ? (bounds.pillarLeft - bounds.leftMargin) : (bounds.rightMargin - bounds.leftMargin))
      : (bounds.isPillar ? (bounds.rightMargin - bounds.pillarRight) : (bounds.rightMargin - bounds.leftMargin));
    const jetLen = channelWidth * g.lengthRatio;

    const startX = craterX;
    const endX = g.side === 'left' ? (startX + jetLen) : (startX - jetLen);

    ctx.save();
    ctx.shadowColor = '#ff1100';
    ctx.shadowBlur = 28;

    const grad = ctx.createLinearGradient(startX, g.y, endX, g.y);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.15, '#ffaa00');
    grad.addColorStop(0.65, '#ff2200');
    grad.addColorStop(1, 'rgba(255, 34, 0, 0)');

    // Jet originates thin (8px height) at crater nozzle and flares outwards
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(startX, g.y - 4);
    ctx.quadraticCurveTo(startX + dir * (jetLen * 0.4), g.y - 11, endX, g.y - 2);
    ctx.lineTo(endX, g.y + 2);
    ctx.quadraticCurveTo(startX + dir * (jetLen * 0.4), g.y + 11, startX, g.y + 4);
    ctx.closePath();
    ctx.fill();

    // White-hot Nozzle Flash at Volcano Crater Mouth
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(startX, g.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffff55';
    for (let i = 0; i < 6; i++) {
      const px = startX + (endX - startX) * (i / 6) + rand(-8, 8);
      const py = g.y + rand(-7, 7);
      ctx.beginPath();
      ctx.arc(px, py, rand(1.5, 3.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawVoidMine(ctx, mine) {
  ctx.save();
  ctx.translate(mine.x, mine.y);
  const pulse = Math.sin(mine.pulse) * 0.15 + 0.85;

  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 16 * pulse;
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2;

  ctx.beginPath();
  const pts = 8;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = i % 2 === 0 ? mine.r * 1.3 : mine.r * 0.6;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ff2a6d';
  ctx.beginPath();
  ctx.arc(0, 0, mine.r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCaveBat(ctx, bat) {
  ctx.save();
  ctx.translate(bat.x, bat.y);
  const wingY = Math.sin(bat.t) * 10;

  ctx.shadowColor = '#ff8c00';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ff8c00';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  // Bat body
  ctx.beginPath();
  ctx.arc(0, 0, bat.r * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Left wing
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-bat.r * 1.5, wingY);
  ctx.lineTo(-bat.r * 0.6, bat.r * 0.6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(bat.r * 1.5, wingY);
  ctx.lineTo(bat.r * 0.6, bat.r * 0.6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.restore();
}

function drawGem(ctx, g) {
  ctx.save();
  ctx.translate(g.x, g.y);

  let c = getComputedColor('--energy') || '#ffb020';
  if (g.type === 'chrono') c = '#00f2fe';
  if (g.type === 'shield') c = '#a855f7';

  ctx.shadowColor = c;
  ctx.shadowBlur = 14;
  ctx.fillStyle = c;
  ctx.beginPath();

  if (g.type === 'chrono') {
    const r = g.r;
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.9, 0);
  } else if (g.type === 'shield') {
    const r = g.r;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  } else {
    const r = g.r;
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.8, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.8, 0);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHypergatePortal(ctx, x, y, color, t) {
  ctx.save();
  ctx.translate(x, y);

  ctx.shadowColor = color;
  ctx.shadowBlur = 30;

  for (let i = 1; i <= 3; i++) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 / i;
    ctx.globalAlpha = 0.8 / i;

    const r = 50 * i + Math.sin(t * 6 + i) * 10;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/* ==========================================================================
   DEBUG MODE CONTROLS (Escape Mode)
   ========================================================================== */

/* ==========================================================================
   END DEBUG MODE CONTROLS
   ========================================================================== */

/* ==========================================================================
   ESCAPE MODE SETTINGS MODAL
   ========================================================================== */
(function initEscapeSettings() {
  if (typeof document === 'undefined') return;

  function createModal() {
    if (document.getElementById('escape-settings-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'escape-settings-modal';
    modal.innerHTML = `
      <div class="escape-settings-panel">
        <div class="settings-header">
          <span class="settings-title">⚙️ Escape Settings</span>
          <button id="btn-close-escape-settings" class="settings-close-btn" type="button" title="Close Settings">✕</button>
        </div>

        <div class="settings-group">
          <div class="settings-row">
            <div class="settings-label-wrap">
              <span class="settings-label">Show Mouse Pointer When Flying</span>
              <span class="settings-sublabel">Display your advanced flight mouse🐭</span>
            </div>
            <div class="toggle-btn-group">
              <button type="button" class="toggle-opt-btn" id="btn-mouse-yes">YES</button>
              <button type="button" class="toggle-opt-btn" id="btn-mouse-no">NO</button>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-row">
            <div class="settings-label-wrap">
              <span class="settings-label">Reset Best Score</span>
              <span class="settings-sublabel">Clear saved high score records for Escape Mode</span>
            </div>
          </div>
          <div class="reset-btn-row">
            <button type="button" class="btn-reset-score" id="btn-reset-standard">Standard</button>
            <button type="button" class="btn-reset-score" id="btn-reset-endless">Endless Mode</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const stopProp = (e) => { e.stopPropagation(); };
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup', 'click'].forEach(evt => {
      modal.addEventListener(evt, stopProp);
    });

    function updateModalUI() {
      if (typeof escapeGame === 'undefined') return;
      const isMouse = escapeGame.showMouse;
      const btnYes = document.getElementById('btn-mouse-yes');
      const btnNo = document.getElementById('btn-mouse-no');
      if (btnYes && btnNo) {
        btnYes.classList.toggle('active', isMouse);
        btnNo.classList.toggle('active', !isMouse);
      }
      const btnResetStd = document.getElementById('btn-reset-standard');
      const btnResetEnd = document.getElementById('btn-reset-endless');
      if (btnResetStd && !btnResetStd.classList.contains('reset-done')) {
        btnResetStd.textContent = `Standard (${escapeGame.bestNormal})`;
      }
      if (btnResetEnd && !btnResetEnd.classList.contains('reset-done')) {
        btnResetEnd.textContent = `Endless (${escapeGame.bestOverclocked})`;
      }
    }

    const closeModal = () => {
      modal.classList.remove('active');
    };

    document.getElementById('btn-close-escape-settings').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.getElementById('btn-mouse-yes').addEventListener('click', () => {
      if (typeof escapeGame !== 'undefined') escapeGame.setShowMouse(true);
      updateModalUI();
    });

    document.getElementById('btn-mouse-no').addEventListener('click', () => {
      if (typeof escapeGame !== 'undefined') escapeGame.setShowMouse(false);
      updateModalUI();
    });

    function flashResetDone(btn, originalText) {
      btn.classList.add('reset-done');
      btn.textContent = 'Reset! ✓';
      setTimeout(() => {
        btn.classList.remove('reset-done');
        updateModalUI();
      }, 1200);
    }

    document.getElementById('btn-reset-standard').addEventListener('click', function () {
      if (typeof escapeGame !== 'undefined') {
        escapeGame.resetBestScore('standard');
        flashResetDone(this, `Standard (${escapeGame.bestNormal})`);
      }
    });

    document.getElementById('btn-reset-endless').addEventListener('click', function () {
      if (typeof escapeGame !== 'undefined') {
        escapeGame.resetBestScore('endless');
        flashResetDone(this, `Endless (${escapeGame.bestOverclocked})`);
      }
    });

    if (typeof escapeGame !== 'undefined') {
      escapeGame.updateSettingsModalUI = updateModalUI;
      escapeGame.openSettingsModal = function () {
        updateModalUI();
        modal.classList.add('active');
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createModal);
  } else {
    createModal();
  }
})();
