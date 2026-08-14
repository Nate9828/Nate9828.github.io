/* ---------------------------------------------------------
   ASSAULT MODE (landscape) — 4 Waves, Upgrades, Power-ups & 3-Phase Leviathan Boss
--------------------------------------------------------- */
if (typeof randInt === 'undefined') {
  window.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
}

const assault = {
  state: 'idle', // idle | playing | over
  wave: 1, totalWaves: 4, kills: 0, points: 0, health: 100,
  vw: 960, vh: 540,
  selectedDifficulty: 'normal', // normal | hard | endless
  highestEndlessWave: typeof loadSecure === 'function' ? loadSecure('novashift_assault_highest_wave', 0) : 0,

  getHighestEndlessWave() {
    if (typeof loadSecure === 'function') {
      const saved = loadSecure('novashift_assault_highest_wave', 0);
      if (saved > (this.highestEndlessWave || 0)) {
        this.highestEndlessWave = saved;
      }
    }
    return this.highestEndlessWave || 0;
  },

  checkHighestWave() {
    if (this.selectedDifficulty === 'endless') {
      const w = this.wave;
      if (w > (this.highestEndlessWave || 0)) {
        this.highestEndlessWave = w;
        if (typeof saveSecure === 'function') {
          saveSecure('novashift_assault_highest_wave', w);
        } else {
          try { localStorage.setItem('novashift_assault_highest_wave', String(w)); } catch(e){}
        }
      }
    }
  },

  resetHighestEndlessWave() {
    this.highestEndlessWave = 0;
    if (typeof saveSecure === 'function') {
      saveSecure('novashift_assault_highest_wave', 0);
    } else {
      try { localStorage.removeItem('novashift_assault_highest_wave'); } catch(e){}
    }
  },
  solarFlareState: 'idle', // idle | warning | firing
  solarFlareTimer: 0,
  solarFlareLanes: [],
  getViewport() {
    const vh = 540;
    const scale = window.innerHeight / vh;
    const vw = Math.max(960, window.innerWidth / scale);
    return { scale, ox: 0, oy: 0, vw, vh, speedScale: vw / 960 };
  },

  // Weapon & Base Upgrades
  fireRateLevel: 1, // Max 3
  multishotLevel: 1, // Max 3 (1: Single, 2: Dual, 3: Triple Spread)
  fortifyLevel: 1,   // Max 3 (1: 100 HP, 2: 150 HP, 3: 200 HP)
  maxHealth: 100,

  // Active Power-up Timers & Stacked Shields
  overchargeTimer: 0,
  shieldCount: 0,

  // Shooting rate limiter
  lastShotTime: 0,

  spawnQueue: 0, spawnTimer: 0, spawnInterval: 900,
  turret: { x: 0, y: 0, r: 20, vx: 0, vy: 0 },
  bolts: [], enemyBolts: [], missiles: [], enemies: [], drops: [], particles: [], boss: null,

  start() {
    if (typeof isGamePaused !== 'undefined' && isGamePaused && typeof resumeGame === 'function') {
      resumeGame();
    }
    const W = this.vw, H = this.vh;
    this.state = 'playing'; this.wave = 1; this.kills = 0; this.points = 0;
    this.totalWaves = this.selectedDifficulty === 'endless' ? Infinity : 4;
    this.fireRateLevel = 1; this.multishotLevel = 1; this.fortifyLevel = 1;
    this.maxHealth = 100; this.health = 100;
    this.overchargeTimer = 0; this.healthFlashTimer = 0; this.shieldCount = 0; this.shields = []; this.lastShotTime = 0;
    this.pulseTurretCost = 600;
    this.activePulseTurrets = [];
    this.currentMutator = null;
    this.activeSolarFlares = [];
    this.solarFlareSpawnTimer = this.selectedDifficulty === 'hard' ? randInt(18000, 26000) : 0;
    this.bolts = []; this.enemyBolts = []; this.missiles = []; this.enemies = []; this.drops = []; this.particles = []; this.boss = null;
    this.turret.x = Math.max(70, W * 0.09); this.turret.y = H / 2; this.turret.vx = 0; this.turret.vy = 0;

    lastUpgradesState = '';
    if (this.selectedDifficulty === 'endless') {
      this.checkHighestWave();
    }
    this.beginWave();
    renderHUD();
    renderUpgradesHTML(true);
    removeBossHUD();
  },

  stop() {
    this.state = 'idle';
    const vp = this.getViewport();
    const W = vp.vw, H = vp.vh;
    this.wave = 1;
    this.kills = 0;
    this.points = 0;
    this.health = this.maxHealth || 100;
    this.overchargeTimer = 0;
    this.healthFlashTimer = 0;
    this.shieldCount = 0;
    this.shields = [];
    this.lastShotTime = 0;
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.activePulseTurrets = [];
    this.currentMutator = null;
    this.activeSolarFlares = [];
    this.bolts = [];
    this.enemyBolts = [];
    this.missiles = [];
    this.enemies = [];
    this.drops = [];
    this.particles = [];
    this.boss = null;
    if (this.turret) {
      this.turret.x = Math.max(70, W * 0.09);
      this.turret.y = H / 2;
      this.turret.vx = 0;
      this.turret.vy = 0;
    }
    removeBossHUD();
    if (typeof removeWaveAnnouncement === 'function') removeWaveAnnouncement();
  },

  beginWave() {
    if (this.selectedDifficulty === 'endless') {
      this.checkHighestWave();
    }
    const isHard = this.selectedDifficulty === 'hard';
    const isEndless = this.selectedDifficulty === 'endless';
    const isBossWave = (isEndless && (this.wave === 4 || (this.wave > 4 && (this.wave - 4) % 5 === 0))) || (!isEndless && this.wave === 4);
    const bossIndex = isEndless ? Math.floor((this.wave - 4) / 5) + 1 : 1;

    // Dynamic Soundtrack Theme Management
    if (typeof Sound !== 'undefined') {
      if (isBossWave) {
        if (isEndless) {
          // Endless Mode: Boss 1 -> Leviathan Omega (boss1), Boss 2 -> Boss Music 2 (boss2), Boss 3 -> Boss Music 3 (boss3), repeating
          const endlessBossCycle = ['boss1', 'boss2', 'boss3'];
          const chosenTheme = endlessBossCycle[(bossIndex - 1) % endlessBossCycle.length];
          Sound.playTheme(chosenTheme);
        } else if (isHard) {
          // Hard Mode: 1st boss = Leviathan Omega (boss1), 2nd boss = Boss Music 3 (boss3)
          Sound.playTheme((bossIndex >= 2) ? 'boss3' : 'boss1');
        } else {
          Sound.playTheme('boss1');
        }
      } else if (isEndless) {
        // Endless non-boss waves:
        // Waves 1-3 -> Infinite Overdrive (endless1)
        // Waves 5-8 -> Infinite Overdrive 2 (endless2)
        // Waves 10-13 -> Infinite Overdrive (endless1)
        // Waves 15-18 -> Infinite Overdrive 2 (endless2)...
        const endlessSegmentIndex = this.wave < 4 ? 0 : Math.floor((this.wave - 5) / 5) + 1;
        const endlessTheme = (endlessSegmentIndex % 2 === 0) ? 'endless1' : 'endless2';
        Sound.playTheme(endlessTheme);
      } else {
        Sound.playTheme('normal');
      }
    }

    if (isBossWave) {
      this.currentMutator = null;
      this.spawnQueue = 0;
      this.spawnBoss();
      const isHardBossType = isEndless ? (bossIndex % 2 === 0) : isHard;
      const bossName = isHardBossType ? 'LEVIATHAN OMEGA' : 'LEVIATHAN FLAGSHIP';
      if (typeof Sound !== 'undefined') Sound.play('bossAlarm');
      showWaveAnnouncement('⚠️ WARNING: BOSS DETECTED', `${bossName} APPROACHING${isEndless ? ` (BOSS ${bossIndex})` : ''}`, true);
    } else {
      let count = [8, 12, 16][Math.min(2, (this.wave - 1) % 4)];
      if (isHard) count = Math.floor(count * 1.3);
      if (isEndless) count = Math.floor(10 + (this.wave - 1) * 1.6);

      this.spawnQueue = count;
      this.spawnTimer = 0;
      let interval = [900, 680, 500][Math.min(2, (this.wave - 1) % 4)];
      if (isHard) interval = Math.floor(interval * 0.75);
      if (isEndless) interval = Math.max(480, Math.floor(900 * Math.pow(0.96, this.wave - 1)));

      this.spawnInterval = interval;
      this.boss = null;

      // 25% chance for a Sector Anomaly Mutator Bonus Wave in Endless mode after Wave 9
      if (isEndless && this.wave > 9 && Math.random() < 0.25) {
        const mutators = [
          { type: 'double_drops', title: '🌌 SECTOR ANOMALY DETECTED', sub: 'RESOURCE OVERFLOW // 2x DROPS & 2x SCORE (ENEMIES 2x HP)', color: '#00f2fe' },
          { type: 'kamikaze_swarm', title: '🌌 SECTOR ANOMALY DETECTED', sub: 'KAMIKAZE HYPER-SWARM // 100% POWER-UP DROPS', color: '#ff2a6d' },
          { type: 'solar_overload', title: '🌌 SECTOR ANOMALY DETECTED', sub: 'SOLAR OVERLOAD STORM // 3-5s STACKING SOLAR FLARES (2x DAMAGE)', color: '#ffe600' }
        ];
        this.currentMutator = mutators[Math.floor(Math.random() * mutators.length)];
        if (this.currentMutator.type === 'solar_overload') {
          const vp = this.getViewport();
          const H = vp ? vp.vh : 540;
          this.activeSolarFlares = this.activeSolarFlares || [];
          this.activeSolarFlares.push({
            state: 'warning',
            timer: 2000,
            lanes: [rand(HUD_HEIGHT + 50, H - 60), rand(HUD_HEIGHT + 50, H - 60)]
          });
          this.solarFlareSpawnTimer = randInt(3000, 5000);
        }
        if (typeof Sound !== 'undefined') Sound.play('bossAlarm');
        showWaveAnnouncement(this.currentMutator.title, this.currentMutator.sub, true);
      } else {
        this.currentMutator = null;
        const subtitles = [
          'ENEMY RECON DIVISION // DEFEND BASE',
          'ARMORED CRUISERS DETECTED // HEAVY FIREPOWER REQUIRED',
          'KAMIKAZE SWARM APPROACHING // WATCH DEFENSES',
          'HEAVY ASSAULT SQUADRON // BATTLE POSITIONS',
          'INTERCEPTOR FLEET // INTENSE FIRE FIGHT'
        ];
        const subIdx = (this.wave - 1) % subtitles.length;
        if (typeof Sound !== 'undefined') Sound.play('uiClick');
        showWaveAnnouncement(`WAVE ${this.wave} // INCOMING`, subtitles[subIdx], false);
      }
    }
  },

  spawnBoss() {
    const W = this.vw, H = this.vh;
    const isHard = this.selectedDifficulty === 'hard';
    const isEndless = this.selectedDifficulty === 'endless';
    const bossIndex = isEndless ? Math.floor((this.wave - 4) / 5) + 1 : 1;
    const isHardBossType = isEndless ? (bossIndex % 2 === 0) : isHard;

    let baseHp = isHardBossType ? 220 : 110;
    let hpVal = isEndless ? Math.floor(baseHp * Math.pow(1.25, bossIndex - 1)) : baseHp;

    if (isHardBossType) {
      // 6-PHASE HARD MODE BOSS: LEVIATHAN OMEGA
      this.boss = {
        isHardBoss: true,
        name: 'LEVIATHAN OMEGA',
        x: W + 180,
        y: H / 2,
        targetY: H / 2,
        r: 75,
        hp: hpVal,
        maxHp: hpVal,
        phase: 1,
        timer: 0,
        phaseTimer: 0,
        shootTimer: 0,
        salvoCooldown: 0,
        missileQueue: [],
        launchTimer: 0,
        invulnerable: true,
        phase1SecondWaveSpawned: false,
        regenTimer: 0
      };

      // Spawn Phase 1 Opening Escort Wave 1: 3 Siege Enemies
      this.spawnSiegeEscorts(3);
    } else {
      this.boss = {
        isHardBoss: false,
        name: 'LEVIATHAN FLAGSHIP',
        x: W + 160,
        y: H / 2,
        targetY: H / 2,
        r: 65,
        hp: hpVal,
        maxHp: hpVal,
        phase: 0,
        timer: 0,
        shootTimer: 0,
        salvoCooldown: 0,
        missileQueue: [],
        launchTimer: 0,
        invulnerable: false
      };
    }
    createBossHUD();
  },

  spawnSiegeEscorts(count) {
    const vp = this.getViewport();
    const W = vp.vw, H = vp.vh, speedScale = vp.speedScale;
    const isEndless = this.selectedDifficulty === 'endless';
    const endlessHpBonus = isEndless ? Math.floor(this.wave / 10) : 0;
    for (let i = 0; i < count; i++) {
      const yPos = HUD_HEIGHT + 60 + (i / Math.max(1, count - 1)) * (H - HUD_HEIGHT - 120);
      this.enemies.push({
        type: 'beam_dreadnought',
        x: W + 40 + i * 20,
        y: yPos,
        r: 32,
        vx: -50 * speedScale,
        vy: 0,
        hp: 5 + endlessHpBonus,
        maxHp: 5 + endlessHpBonus,
        state: 'moving',
        chargeTimer: 0,
        maxChargeTime: Math.max(2200, 4500 - (this.wave - 3) * 150),
        fireTimer: 0,
        maxFireTime: 1500,
        isEscort: true,
        isBossDrone: true
      });
    }
  },

  initPhase5CruiserGuards(b) {
    b.phase5GuardSlots = [
      { respawnTimer: 0 },
      { respawnTimer: 0 },
      { respawnTimer: 0 },
      { respawnTimer: 0 },
      { respawnTimer: 0 }
    ];
    for (let i = 0; i < 5; i++) {
      this.spawnSingleCruiserGuard(b, i, 5);
    }
  },

  initPhase6CruiserGuards(b) {
    this.enemies = this.enemies.filter(e => !e.isBossGuard);
    b.phase6GuardSlots = [
      { respawnTimer: 0 },
      { respawnTimer: 0 },
      { respawnTimer: 0 },
      { respawnTimer: 0 }
    ];
    for (let i = 0; i < 4; i++) {
      this.spawnSingleCruiserGuard(b, i, 4);
    }
  },

  spawnSingleCruiserGuard(b, slotIndex, totalSlots = 5) {
    const vp = this.getViewport();
    const H = vp ? vp.vh : 600;
    const minY = HUD_HEIGHT + 55;
    const maxY = H - 55;
    const divisor = Math.max(1, totalSlots - 1);
    const fixedY = minY + (slotIndex / divisor) * (maxY - minY);
    const isEndless = this.selectedDifficulty === 'endless';
    const endlessHpBonus = isEndless ? Math.floor(this.wave / 10) : 0;
    this.enemies.push({
      type: 'cruiser',
      x: b.x - 85,
      y: fixedY,
      fixedY: fixedY,
      r: 26,
      vx: 0,
      vy: 0,
      hp: 4 + endlessHpBonus,
      maxHp: 4 + endlessHpBonus,
      missileTimer: rand(1000, 2500),
      isBossGuard: true,
      guardSlotIndex: slotIndex,
      isBossDrone: true
    });
  },

  launchMissileSalvo(b, count, isStaggered) {
    const vp = this.getViewport();
    const H = vp.vh, speedScale = vp.speedScale;
    if (typeof Sound !== 'undefined') Sound.play('missileLaunch');
    if (isStaggered) {
      b.missileQueue = [];
      for (let i = 0; i < count; i++) {
        const tY = HUD_HEIGHT + 40 + (i / Math.max(1, count - 1)) * (H - HUD_HEIGHT - 80);
        const yOffset = (i - (count - 1) / 2) * 18;
        b.missileQueue.push({ tY, yOffset });
      }
      b.launchTimer = 0;
    } else {
      for (let i = 0; i < count; i++) {
        const tY = HUD_HEIGHT + 40 + (i / Math.max(1, count - 1)) * (H - HUD_HEIGHT - 80);
        const yOffset = (i - (count - 1) / 2) * 18;
        this.missiles.push({
          x: b.x - 45,
          y: clamp(b.y + yOffset, HUD_HEIGHT + 30, H - 30),
          r: 8, vx: (b.phase === 3 ? -250 : -230) * speedScale, vy: 0, targetY: tY, hp: 1
        });
      }
      b.salvoCooldown = 1800;
    }
  },

  triggerPhaseBurst(b) {
    const vp = this.getViewport();
    const H = vp.vh, speedScale = vp.speedScale;
    if (typeof Sound !== 'undefined') Sound.play('bossPhaseTransition');
    this.burstParticles(b.x, b.y, b.phase === 3 ? '#e040fb' : (b.phase === 1 ? '#ff1744' : '#ffb020'));

    if (b.phase === 1) {
      // Phase 1 Opening Volley: 5 Homing Missiles
      const count = 5;
      for (let i = 0; i < count; i++) {
        const tY = HUD_HEIGHT + 40 + (i / (count - 1)) * (H - HUD_HEIGHT - 80);
        const yOffset = (i - (count - 1) / 2) * 22;
        this.missiles.push({
          x: b.x - 45,
          y: clamp(b.y + yOffset, HUD_HEIGHT + 30, H - 30),
          r: 8, vx: -230 * speedScale, vy: 0, targetY: tY, hp: 1
        });
      }
    } else if (b.phase === 2) {
      // Phase 2 Opening Swarm: 5 Kamikaze Drones with variable speeds
      const count = 5;
      const endlessHpBonus = (this.selectedDifficulty === 'endless') ? Math.floor(this.wave / 10) : 0;
      for (let i = 0; i < count; i++) {
        const yOffset = (i - (count - 1) / 2) * 32;
        this.enemies.push({
          type: 'kamikaze',
          x: b.x - 40,
          y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35),
          r: 12, vx: -rand(220, 370) * speedScale, vy: 0, amp: 40, freq: 3, t: i * 0.3, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus
        });
      }
    } else if (b.phase === 3) {
      // Phase 3 Hyper Opening Barrage: 6 Homing Missiles AND 8 Kamikaze Drones!
      const countM = 6;
      const countD = 8;
      const endlessHpBonus = (this.selectedDifficulty === 'endless') ? Math.floor(this.wave / 10) : 0;
      for (let i = 0; i < countM; i++) {
        const tY = HUD_HEIGHT + 40 + (i / (countM - 1)) * (H - HUD_HEIGHT - 80);
        const yOffset = (i - (countM - 1) / 2) * 20;
        this.missiles.push({
          x: b.x - 50,
          y: clamp(b.y + yOffset, HUD_HEIGHT + 30, H - 30),
          r: 8, vx: -250 * speedScale, vy: 0, targetY: tY, hp: 1
        });
      }
      for (let i = 0; i < countD; i++) {
        const yOffset = (i - (countD - 1) / 2) * 22;
        this.enemies.push({
          type: 'kamikaze',
          x: b.x - 40,
          y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35),
          r: 12, vx: -rand(240, 400) * speedScale, vy: 0, amp: 55, freq: 3.5, t: i * 0.2, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus
        });
      }
    }
  },

  shoot() {
    if (this.state !== 'playing') return;
    if (typeof overlay !== 'undefined' && overlay && !overlay.classList.contains('hidden')) return;
    const vp = this.getViewport();
    const speedScale = vp.speedScale;
    const now = performance.now();

    // Cooldown based on Fire Rate level and Overcharge power-up
    const baseCooldown = [450, 320, 175][this.fireRateLevel - 1];
    const cooldown = this.overchargeTimer > 0 ? baseCooldown * 0.5 : baseCooldown;

    if (now - this.lastShotTime < cooldown) return;
    this.lastShotTime = now;

    const boltSpeed = 850 * speedScale;
    const boltDamage = (this.currentMutator && this.currentMutator.type === 'solar_overload') ? 2 : 1;

    if (this.multishotLevel === 1) {
      // Single Shot
      this.bolts.push({ x: this.turret.x + 18, y: this.turret.y, vx: boltSpeed, vy: 0, dmg: boltDamage });
    } else if (this.multishotLevel === 2) {
      // Dual Parallel Shot
      this.bolts.push({ x: this.turret.x + 18, y: this.turret.y - 8, vx: boltSpeed, vy: 0, dmg: boltDamage });
      this.bolts.push({ x: this.turret.x + 18, y: this.turret.y + 8, vx: boltSpeed, vy: 0, dmg: boltDamage });
    } else {
      // Triple Spread Shot
      this.bolts.push({ x: this.turret.x + 18, y: this.turret.y, vx: boltSpeed, vy: 0, dmg: boltDamage });
      this.bolts.push({ x: this.turret.x + 18, y: this.turret.y - 6, vx: boltSpeed, vy: -140 * speedScale, dmg: boltDamage });
      this.bolts.push({ x: this.turret.x + 18, y: this.turret.y + 6, vx: boltSpeed, vy: 140 * speedScale, dmg: boltDamage });
    }

    if (typeof Sound !== 'undefined') {
      if (this.overchargeTimer > 0) {
        Sound.play('playerShoot', 'overcharge');
      } else if (this.multishotLevel === 3) {
        Sound.play('playerShoot', 'triple');
      } else if (this.multishotLevel === 2) {
        Sound.play('playerShoot', 'dual');
      } else {
        Sound.play('playerShoot', 'single');
      }
    }
  },

  buyUpgrade(type) {
    const isHard = this.selectedDifficulty !== 'normal';
    const rCosts = isHard ? [150, 300] : [100, 250];
    const mCosts = isHard ? [200, 400] : [150, 350];
    const fCosts = isHard ? [250, 450] : [200, 400];

    let purchased = false;
    let attempted = false;

    if (type === 'rate' && this.fireRateLevel < 3) {
      attempted = true;
      const cost = rCosts[this.fireRateLevel - 1];
      if (this.points >= cost) {
        this.points -= cost;
        this.fireRateLevel++;
        this.burstParticles(this.turret.x, this.turret.y, 'var(--energy)');
        purchased = true;
      }
    } else if (type === 'spread' && this.multishotLevel < 3) {
      attempted = true;
      const cost = mCosts[this.multishotLevel - 1];
      if (this.points >= cost) {
        this.points -= cost;
        this.multishotLevel++;
        this.burstParticles(this.turret.x, this.turret.y, 'var(--player)');
        purchased = true;
      }
    } else if ((type === 'fortify' || type === 'laser') && this.fortifyLevel < 3) {
      attempted = true;
      const cost = fCosts[this.fortifyLevel - 1];
      if (this.points >= cost) {
        this.points -= cost;
        this.fortifyLevel++;
        this.maxHealth = this.fortifyLevel === 2 ? 150 : 200;
        this.health = Math.min(this.maxHealth, this.health + 50);
        this.healthFlashTimer = 1000;
        this.burstParticles(this.turret.x, this.turret.y, '#4dff88');
        purchased = true;
      }
    } else if (type === 'pulse_turrets' && this.selectedDifficulty === 'endless' && this.wave > 9) {
      attempted = true;
      const cost = this.pulseTurretCost || 600;
      if (this.points >= cost) {
        this.points -= cost;
        this.pulseTurretCost = cost + 250;
        this.activePulseTurrets = this.activePulseTurrets || [];
        this.activePulseTurrets.push({
          offsetX: -15, offsetY: -70,
          x: this.turret.x - 15, y: this.turret.y - 70,
          timer: 12.0, shootTimer: 0
        });
        this.activePulseTurrets.push({
          offsetX: -15, offsetY: 70,
          x: this.turret.x - 15, y: this.turret.y + 70,
          timer: 12.0, shootTimer: 0
        });
        this.burstParticles(this.turret.x, this.turret.y, '#00f2fe');
        purchased = true;
        if (typeof Sound !== 'undefined') Sound.play('turretDeploy');
      }
    }

    if (typeof Sound !== 'undefined') {
      if (purchased && type !== 'pulse_turrets') {
        Sound.play('upgradeSuccess');
      } else if (!purchased && attempted) {
        Sound.play('upgradeFail');
      }
    }

    renderAssaultHUDNumbers();
  },

  burstParticles(x, y, color) {
    for (let i = 0; i < 14; i++) {
      this.particles.push(spark(x, y, color));
    }
  },

  damageBase(n) {
    if (this.shields && this.shields.length > 0) {
      this.shields.pop();
      this.shieldCount = this.shields.length;
      for (let i = 0; i < 16; i++) {
        this.particles.push(spark(this.turret.x, this.turret.y, 'var(--hazard)'));
      }
      if (typeof Sound !== 'undefined') {
        if (this.shields.length === 0) {
          Sound.play('shieldBreak');
        } else {
          Sound.play('hitShield');
        }
      }
      return; // Stacked shield absorbs 1 hit completely
    }
    this.health -= n;
    if (typeof Sound !== 'undefined') Sound.play('hitHull');
    for (let i = 0; i < 12; i++) this.particles.push(spark(this.turret.x, this.turret.y, 'var(--player)'));
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'over';
      removeBossHUD();
      this.checkHighestWave();
      if (typeof Sound !== 'undefined') Sound.play('gameOver');
      showAssaultEnd(false);
    }
  },

  spawnPowerupDrop(x, y, enemyType) {
    let dropRate = this.selectedDifficulty === 'hard' ? 0.04 : 0.12;

    if (this.selectedDifficulty === 'endless') {
      const reductionStep = Math.floor(this.wave / 5);
      const rateMultiplier = Math.max(0.65, 1 - reductionStep * 0.05);
      dropRate *= rateMultiplier;
    }

    if (this.currentMutator) {
      if (this.currentMutator.type === 'double_drops') dropRate *= 2.0;
      if (this.currentMutator.type === 'kamikaze_swarm') dropRate = 1.0;
    }

    if (Math.random() > dropRate) return;

    const isEndless = this.selectedDifficulty === 'endless';
    const isBossWave = (isEndless && (this.wave === 4 || (this.wave > 4 && (this.wave - 4) % 5 === 0))) || (!isEndless && this.wave === 4);
    const isBossPhase = this.boss !== null || isBossWave;
    let type = 'overcharge';

    if (isBossPhase && enemyType === 'kamikaze') {
      // Boss Wave Kamikaze Drone Drop Weighting: Health (65%), Shield (25%), Overcharge (10%)
      const roll = Math.random();
      if (roll < 0.65) type = 'nanite';
      else if (roll < 0.90) type = 'shield';
      else type = 'overcharge';
    } else {
      const canSpawnHealth = this.health < this.maxHealth || isBossPhase;
      const types = canSpawnHealth
        ? ['nanite', 'overcharge', 'shield']
        : ['overcharge', 'shield'];
      type = types[Math.floor(Math.random() * types.length)];
    }

    const vp = this.getViewport();
    const speedScale = vp ? vp.speedScale : 1;
    this.drops.push({ x, y, r: 12, vx: -240 * speedScale, type, t: 0 });
  },

  update(dt) {
    if (this.state !== 'playing') return;
    const vp = this.getViewport();
    const W = vp.vw, H = vp.vh, speedScale = vp.speedScale;

    // Timers
    if (this.overchargeTimer > 0) this.overchargeTimer -= dt;
    if (this.healthFlashTimer > 0) this.healthFlashTimer -= dt;

    // Stacking Cosmic Solar Flare Telegraphed Hazards (Hard Mode & Solar Overload Storm)
    const isSolarMutator = this.currentMutator && this.currentMutator.type === 'solar_overload';
    if (this.selectedDifficulty === 'hard' || isSolarMutator) {
      this.solarFlareSpawnTimer = (this.solarFlareSpawnTimer || 0) - dt;
      if (this.solarFlareSpawnTimer <= 0) {
        this.solarFlareSpawnTimer = isSolarMutator ? randInt(3000, 5000) : randInt(20000, 28000);
        this.activeSolarFlares = this.activeSolarFlares || [];
        this.activeSolarFlares.push({
          state: 'warning',
          timer: 2000,
          lanes: [rand(HUD_HEIGHT + 50, H - 60), rand(HUD_HEIGHT + 50, H - 60)]
        });
        if (typeof Sound !== 'undefined') Sound.play('solarFlareWarning');
        showWaveAnnouncement('☀️ SOLAR HEAT FLARE', 'EVACUATE HAZARD LANES', true);
      }
    }

    // Always update any active solar flare hazards to completion even if wave or mutator changes
    if (this.activeSolarFlares && this.activeSolarFlares.length > 0) {
      for (const flare of this.activeSolarFlares) {
        if (flare.state === 'warning') {
          flare.timer -= dt;
          if (flare.timer <= 0) {
            flare.state = 'firing';
            flare.timer = 1200; // 1.2s heat wave duration
            if (typeof Sound !== 'undefined') Sound.play('solarFlareBeam');
          }
        } else if (flare.state === 'firing') {
          flare.timer -= dt;
          for (const laneY of (flare.lanes || [])) {
            if (Math.abs(this.turret.y - laneY) < 26) {
              if (this.shields && this.shields.length > 0) {
                this.shields.pop();
                this.shieldCount = this.shields.length;
              } else {
                this.damageBase(12 * dt / 1000);
              }
            }
            if (Math.random() < 0.5) {
              this.particles.push({
                x: rand(0, W), y: laneY + rand(-18, 18),
                vx: rand(-100, 100), vy: rand(-30, 30),
                life: rand(200, 450), maxLife: 450,
                color: '#ffb020'
              });
            }
          }
          if (flare.timer <= 0) {
            flare.expired = true;
          }
        }
      }
      this.activeSolarFlares = this.activeSolarFlares.filter(f => !f.expired);
    }

    if (this.shields && this.shields.length > 0) {
      for (const s of this.shields) {
        s.timer -= dt;
      }
      this.shields = this.shields.filter(s => s.timer > 0);
      this.shieldCount = this.shields.length;
    }

    // Auto-fire while touching/clicking screen or holding spacebar
    if (input.down || input.keys[' '] || input.keys['spacebar']) {
      this.shoot();
    }

    // Turret movement
    const targetSpeed = 750 * speedScale;
    const keySpeed = 280 * speedScale;
    const baseX = Math.max(70, W * 0.09);
    const keyActive = input.keys['arrowleft'] || input.keys['a'] || input.keys['arrowright'] || input.keys['d'] || input.keys['arrowup'] || input.keys['w'] || input.keys['arrowdown'] || input.keys['s'];
    if (keyActive) input.mouseActive = false;

    if (!keyActive && input.mouseActive && input.y != null) {
      const dy = input.y - this.turret.y;
      this.turret.vy = clamp(dy * 10, -targetSpeed, targetSpeed);
    } else if (!keyActive) {
      this.turret.vy = (this.turret.vy || 0) * 0.9;
    }

    if (!keyActive && input.mouseActive && input.x != null) {
      const targetX = Math.min(input.x, baseX);
      const dx = targetX - this.turret.x;
      this.turret.vx = clamp(dx * 10, -targetSpeed, targetSpeed);
    } else if (!keyActive) {
      this.turret.vx = (this.turret.vx || 0) * 0.9;
    }

    if (keyActive) {
      this.turret.vx = 0; this.turret.vy = 0;
      if (input.keys['arrowup'] || input.keys['w']) this.turret.vy = -keySpeed;
      if (input.keys['arrowdown'] || input.keys['s']) this.turret.vy = keySpeed;
      if (input.keys['arrowleft'] || input.keys['a']) this.turret.vx = -keySpeed;
      if (input.keys['arrowright'] || input.keys['d']) this.turret.vx = keySpeed;
    }

    this.turret.y = clamp(this.turret.y + (this.turret.vy || 0) * dt / 1000, HUD_HEIGHT + 24, H - 24);
    this.turret.x = clamp(this.turret.x + (this.turret.vx || 0) * dt / 1000, 30, baseX);

    // Standard Enemy Spawner
    if (this.spawnQueue > 0 && !this.boss) {
      const isEndless = this.selectedDifficulty === 'endless';
      const baseCap = 8 + Math.floor(Math.min(this.wave, 9) / 3);
      const maxConcurrent = isEndless ? (this.wave > 9 ? baseCap + (this.wave - 9) : baseCap) : 16;
      if (this.enemies.length < maxConcurrent) {
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval) {
          this.spawnTimer = 0; this.spawnQueue--;

          let type = 'raider';
          if (this.currentMutator && this.currentMutator.type === 'kamikaze_swarm') {
            type = 'kamikaze';
          } else if (this.wave === 1) {
            type = Math.random() < 0.3 ? 'kamikaze' : 'raider';
          } else if (this.wave === 2) {
            type = Math.random() < 0.25 ? 'cruiser' : (Math.random() < 0.35 ? 'kamikaze' : 'raider');
          } else {
            const roll = Math.random();
            const dreadProb = isEndless ? Math.min(0.18, 0.10 + Math.floor(this.wave / 6) * 0.02) : Math.min(0.35, 0.22 + Math.floor(this.wave / 5) * 0.03);
            const cruiserProb = dreadProb + (isEndless ? Math.min(0.22, 0.15 + Math.floor(this.wave / 6) * 0.02) : Math.min(0.30, 0.23 + Math.floor(this.wave / 5) * 0.02));
            const kamiProb = cruiserProb + 0.30;

            if (roll < dreadProb) type = 'beam_dreadnought';
            else if (roll < cruiserProb) type = 'cruiser';
            else if (roll < kamiProb) type = 'kamikaze';
            else type = 'raider';
          }

          const endlessHpBonus = isEndless ? Math.floor(this.wave / 10) : 0;
          let speed = (65 + Math.min(160, this.wave * 10)) * speedScale;
          let hpVal = 1 + endlessHpBonus;
          let radius = 18;

          if (type === 'kamikaze') {
            speed = (rand(200, 320) + Math.min(60, this.wave * 4)) * speedScale;
            radius = 12;
            hpVal = 1 + endlessHpBonus;
          } else if (type === 'cruiser') {
            speed = 45 * speedScale;
            hpVal = 4 + endlessHpBonus;
            radius = 26;
          } else if (type === 'beam_dreadnought') {
            speed = 40 * speedScale;
            hpVal = 5 + endlessHpBonus;
            radius = 32;
          }

          if (this.currentMutator && this.currentMutator.type === 'double_drops') {
            hpVal *= 2;
          }

          this.enemies.push({
            type,
            x: W + 35,
            y: rand(HUD_HEIGHT + 60, H - 60),
            r: radius,
            vx: -speed,
            vy: 0,
            amp: type === 'raider' && this.wave >= 2 ? rand(25, 60) : (type === 'kamikaze' ? rand(50, 100) : 0),
            freq: rand(1.5, 3.5),
            t: rand(0, 10),
            hp: hpVal,
            maxHp: hpVal,
            missileTimer: type === 'cruiser' ? rand(1800, 2600) : 0,
            state: 'moving',
            chargeTimer: 0,
            maxChargeTime: Math.max(3200, 5000 - (this.wave - 3) * 150),
            fireTimer: 0,
            maxFireTime: 1500
          });
        }
      }
    }

    // Boss Battle Logic (Wave 4)
    if (this.boss) {
      this.updateBoss(dt, baseX);
    }

    // Move Player Bolts
    for (const b of this.bolts) {
      b.x += b.vx * dt / 1000;
      b.y += (b.vy || 0) * dt / 1000;
    }
    this.bolts = this.bolts.filter(b => b.x < W + 40 && b.y > 0 && b.y < H);

    // Move Homing Missiles
    if (this.missiles.length > 0 && Math.random() < 0.035) {
      if (typeof Sound !== 'undefined') Sound.play('missileBeep');
    }
    for (const m of this.missiles) {
      m.x += m.vx * dt / 1000;
      const dy = m.targetY - m.y;
      m.vy = clamp(dy * 2.5, -130, 130);
      m.y += m.vy * dt / 1000;

      // Smoke Trail
      if (Math.random() < 0.35) {
        this.particles.push({
          x: m.x + 8, y: m.y + rand(-2, 2),
          vx: rand(20, 60), vy: rand(-15, 15),
          life: rand(140, 260), maxLife: 260,
          color: Math.random() < 0.5 ? '#ffb020' : '#ff1744'
        });
      }
    }
    // Homing Missiles vs Base Line
    this.missiles = this.missiles.filter(m => {
      if (m.x - m.r < baseX) {
        this.damageBase(12);
        this.burstParticles(m.x, m.y, '#ff1744');
        return false;
      }
      return true;
    });

    // Move & Update Enemies
    for (const e of this.enemies) {
      e.t += dt / 1000;
      if (e.isBossGuard && this.boss) {
        e.x += ((this.boss.x - 85) - e.x) * 5.0 * dt / 1000;
        if (e.fixedY != null) {
          e.y += (e.fixedY - e.y) * 5.0 * dt / 1000;
        }
      } else {
        e.x += e.vx * dt / 1000;
      }
      if (e.type === 'kamikaze') {
        const dy = this.turret.y - e.y;
        e.y += Math.sign(dy) * Math.min(Math.abs(dy), 140) * dt / 1000;
      } else if (e.type === 'cruiser') {
        e.missileTimer = (e.missileTimer || 2200) - dt;
        if (e.missileTimer <= 0) {
          e.missileTimer = 3200;
          this.missiles.push({
            x: e.x - e.r,
            y: e.y,
            r: 7,
            vx: -220 * speedScale,
            vy: 0,
            targetY: this.turret.y,
            hp: 1
          });
          if (typeof Sound !== 'undefined') Sound.play('missileLaunch');
          for (let i = 0; i < 6; i++) {
            this.particles.push(spark(e.x - e.r, e.y, '#ff1744'));
          }
        }
      } else if (e.type === 'beam_dreadnought') {
        if (e.state === 'moving') {
          if (e.x <= W * 0.85) {
            e.x = W * 0.85;
            e.vx = 0;
            e.state = 'charging';
            e.chargeTimer = 0;
          }
        } else if (e.state === 'charging') {
          e.chargeTimer += dt;
          if (Math.random() < 0.45) {
            const pAngle = Math.random() * Math.PI * 2;
            const pDist = rand(15, 45);
            this.particles.push({
              x: e.x - e.r * 0.8 + Math.cos(pAngle) * pDist,
              y: e.y + Math.sin(pAngle) * pDist,
              vx: -Math.cos(pAngle) * 60,
              vy: -Math.sin(pAngle) * 60,
              life: rand(180, 320),
              maxLife: 320,
              color: '#ff1744'
            });
          }
          if (e.chargeTimer >= e.maxChargeTime) {
            e.state = 'firing';
            e.fireTimer = 0;
            if (typeof Sound !== 'undefined') Sound.play('solarFlareBeam');
          }
        } else if (e.state === 'firing') {
          e.fireTimer += dt;
          // High-threat siege beam attack (18.0 HP/sec direct damage to base)
          this.health = Math.max(0, this.health - (18.0 * dt / 1000));
          if (this.health <= 0) {
            this.health = 0;
            this.state = 'over';
            removeBossHUD();
            showAssaultEnd(false);
          }

          if (e.fireTimer >= e.maxFireTime) {
            e.state = 'charging';
            e.chargeTimer = 0;
          }
        }
      } else if (e.amp) {
        e.y += Math.sin(e.t * e.freq) * e.amp * dt / 1000;
      }
    }

    // Enemies vs Base
    this.enemies = this.enemies.filter(e => {
      if (e.x - e.r < baseX + this.turret.r) {
        const dmg = e.type === 'cruiser' ? 25 : (e.type === 'kamikaze' ? 18 : 12);
        this.damageBase(dmg);
        for (let i = 0; i < 10; i++) this.particles.push(spark(e.x, e.y, 'var(--hazard)'));
        return false;
      }
      return true;
    });

    // Player Bolts vs Homing Missiles (PLAYER CAN SHOOT MISSILES DOWN!)
    for (const b of this.bolts) {
      for (const m of this.missiles) {
        if (!b.dead && !m.dead && dist2(b.x, b.y, m.x, m.y) < (m.r + 8) ** 2) {
          if (!b.pierce) b.dead = true;
          m.dead = true;
          if (typeof Sound !== 'undefined') Sound.play('explosionSmall');
          for (let i = 0; i < 8; i++) this.particles.push(spark(m.x, m.y, 'var(--energy)'));
        }
      }

      // Player Bolts vs Enemies
      for (const e of this.enemies) {
        if (!b.dead && !e.dead && dist2(b.x, b.y, e.x, e.y) < (e.r + 6) ** 2) {
          const isFrontalHit = b.x < e.x && Math.abs(b.y - e.y) < e.r * 0.7;
          if (e.type === 'cruiser' && isFrontalHit && !b.pierce && !b.pierceShields) {
            if (typeof Sound !== 'undefined') Sound.play('hitShield');
            for (let i = 0; i < 4; i++) this.particles.push(spark(b.x, b.y, 'var(--hazard)'));
            b.dead = true;
            continue;
          }

          if (!b.pierce) b.dead = true;
          e.hp -= b.dmg || 1;
          if (typeof Sound !== 'undefined') Sound.play('hitEnemy');
          for (let i = 0; i < 6; i++) this.particles.push(spark(e.x, e.y, 'var(--energy)'));

          if (e.hp <= 0) {
            e.dead = true;
            this.kills++;
            if (typeof Sound !== 'undefined') {
              if (e.type === 'cruiser' || e.type === 'beam_dreadnought') {
                Sound.play('explosionMedium');
              } else {
                Sound.play('explosionSmall');
              }
            }
            if (e.isBossGuard && typeof e.guardSlotIndex === 'number' && this.boss) {
              if (this.boss.phase === 5 && this.boss.phase5GuardSlots && this.boss.phase5GuardSlots[e.guardSlotIndex]) {
                this.boss.phase5GuardSlots[e.guardSlotIndex].respawnTimer = 5000;
              } else if (this.boss.phase === 6 && this.boss.phase6GuardSlots && this.boss.phase6GuardSlots[e.guardSlotIndex]) {
                this.boss.phase6GuardSlots[e.guardSlotIndex].respawnTimer = 5000;
              }
            }
            const isHard = this.selectedDifficulty !== 'normal';
            let ptsEarned = e.type === 'cruiser' ? 40 : (e.type === 'kamikaze' ? 25 : (e.type === 'beam_dreadnought' ? 55 : 15));
            if (isHard) {
              if (this.boss && (e.type === 'kamikaze' || e.isEscort || e.isBossDrone || e.isBossGuard)) {
                ptsEarned = 5;
              } else {
                ptsEarned = Math.floor(ptsEarned * 0.85);
              }
            }
            if (this.currentMutator && this.currentMutator.type === 'double_drops') {
              ptsEarned *= 2;
            }
            this.points += ptsEarned;
            this.spawnPowerupDrop(e.x, e.y, e.type);
          }
        }
      }

      // Player Bolts vs Boss
      if (this.boss && !b.dead && dist2(b.x, b.y, this.boss.x, this.boss.y) < (this.boss.r + 18) ** 2) {
        if (this.boss.invulnerable) {
          b.dead = true;
          if (typeof Sound !== 'undefined') Sound.play('hitShield');
          for (let i = 0; i < 6; i++) this.particles.push(spark(b.x, b.y, '#7c5cff'));
        } else {
          if (!b.pierce) b.dead = true;
          this.boss.hp -= b.dmg || 1;
          if (typeof Sound !== 'undefined') Sound.play('hitEnemy');
          for (let i = 0; i < 8; i++) this.particles.push(spark(b.x, b.y, 'var(--player)'));
          if (this.boss.hp <= 0) {
            this.boss.hp = 0;
            this.kills++;
            this.points += 500;
            if (typeof Sound !== 'undefined') Sound.play('bossExplosion');
            this.burstParticles(this.boss.x, this.boss.y, 'var(--energy)');
            this.boss = null;
            removeBossHUD();

            if (this.selectedDifficulty === 'endless') {
              if (typeof Sound !== 'undefined') Sound.play('waveClear');
              showWaveAnnouncement('BOSS DESTROYED!', `WAVE ${this.wave} CLEARED`, true);
              this.enemies = this.enemies.filter(e => !e.isBossDrone && !e.isBossGuard && !e.isEscort);
              this.wave++;
              this.checkHighestWave();
              this.beginWave();
              renderHUD();
            } else {
              this.state = 'over';
              showAssaultEnd(true);
            }
          }
        }
      }
    }

    this.bolts = this.bolts.filter(b => !b.dead);
    this.missiles = this.missiles.filter(m => !m.dead);
    this.enemies = this.enemies.filter(e => !e.dead);

    // Dropped Power-ups logic
    for (const d of this.drops) {
      d.t += dt / 1000;

      // Check if power-up reaches the base area
      if (!d.inBase && d.x <= baseX + 10) {
        d.inBase = true;
        d.baseTimer = 0;
      }

      if (d.inBase) {
        d.baseTimer = (d.baseTimer || 0) + dt;
        // Decelerate quickly so it comes to a stop in the base zone
        d.vx = (d.vx || 0) * Math.pow(0.01, dt / 1000);
        d.x += d.vx * dt / 1000;
        if (d.baseTimer >= 1000) {
          d.expired = true;
        }
      } else {
        d.x += d.vx * dt / 1000;
      }

      d.y += Math.sin(d.t * 4) * 20 * dt / 1000;

      if (dist2(d.x, d.y, this.turret.x, this.turret.y) < (this.turret.r + d.r + 4) ** 2) {
        d.collected = true;
        if (typeof Sound !== 'undefined') Sound.play('pickup', d.type);
        if (d.type === 'nanite') {
          this.health = Math.min(this.maxHealth || 100, this.health + 25);
          this.healthFlashTimer = 1000;
          this.burstParticles(this.turret.x, this.turret.y, '#4dff88');
        } else if (d.type === 'overcharge') {
          this.overchargeTimer = 6000;
          this.burstParticles(this.turret.x, this.turret.y, 'var(--energy)');
        } else if (d.type === 'shield') {
          this.shields = this.shields || [];
          this.shields.push({ maxTimer: 12000, timer: 12000 });
          this.shieldCount = this.shields.length;
          this.burstParticles(this.turret.x, this.turret.y, 'var(--hazard)');
        }
      }
    }
    this.drops = this.drops.filter(d => !d.collected && !d.expired);

    // Wave clear check
    const isWaveComplete = this.spawnQueue <= 0 && this.enemies.length === 0 && !this.boss && this.state === 'playing';
    if (isWaveComplete && (this.selectedDifficulty === 'endless' || this.wave < 4)) {
      if (typeof Sound !== 'undefined') Sound.play('waveClear');
      this.wave++;
      this.checkHighestWave();
      this.beginWave();
      renderHUD();
    }

    // Update Active Deployable Pulse Turrets
    if (this.activePulseTurrets && this.activePulseTurrets.length > 0) {
      const dtSec = dt / 1000;
      this.activePulseTurrets.forEach(pt => {
        pt.timer -= dtSec;
        const targetX = this.turret.x + pt.offsetX;
        const targetY = this.turret.y + pt.offsetY;
        pt.x += (targetX - pt.x) * 8 * dtSec;
        pt.y += (targetY - pt.y) * 8 * dtSec;

        pt.shootTimer += dtSec;
        if (pt.shootTimer >= 0.35) {
          pt.shootTimer = 0;
          if (typeof Sound !== 'undefined') Sound.play('turretShoot');
          const beamSpeed = 1600 * speedScale;
          this.bolts.push({
            x: pt.x + 20,
            y: pt.y,
            vx: beamSpeed,
            vy: 0,
            dmg: Math.max(3, 1 + Math.floor(this.wave / 10)),
            pierce: false,
            pierceShields: true,
            isPulseBeam: true
          });
          for (let i = 0; i < 6; i++) {
            this.particles.push(spark(pt.x + 20, pt.y, '#00f2fe'));
          }
        }
      });
      this.activePulseTurrets = this.activePulseTurrets.filter(pt => {
        if (pt.timer <= 0) {
          for (let i = 0; i < 14; i++) {
            this.particles.push(spark(pt.x, pt.y, '#00f2fe'));
          }
          return false;
        }
        return true;
      });
    }

    updateParticles(this.particles, dt);
    renderAssaultHUDNumbers();
  },

  updateBoss(dt, baseX) {
    const vp = this.getViewport();
    const W = vp.vw, H = vp.vh, speedScale = vp.speedScale;
    const b = this.boss;
    b.timer += dt / 1000;

    // Salvo cooldown & staggered missile launcher updates
    if (b.salvoCooldown > 0) b.salvoCooldown -= dt;

    if (b.missileQueue && b.missileQueue.length > 0) {
      b.launchTimer = (b.launchTimer || 0) + dt;
      if (b.launchTimer >= 140) {
        b.launchTimer = 0;
        const item = b.missileQueue.shift();
        if (item) {
          this.missiles.push({
            x: b.x - 45,
            y: clamp(b.y + item.yOffset, HUD_HEIGHT + 30, H - 30),
            r: 8, vx: b.phase >= 4 ? -260 : -230, vy: 0, targetY: item.tY, hp: 1
          });
          this.burstParticles(b.x - 45, b.y + item.yOffset, '#ff1744');
        }
        if (b.missileQueue.length === 0) {
          b.salvoCooldown = 1600;
        }
      }
    }

    // ---------------------------------------------------------
    // 6-PHASE HARD MODE BOSS LOGIC: LEVIATHAN OMEGA
    // ---------------------------------------------------------
    if (b.isHardBoss) {
      b.phaseTimer += dt;
      const activeEscorts = this.enemies.filter(e => e.isEscort || e.type === 'beam_dreadnought').length;
      const hpPct = b.hp / b.maxHp;

      // Phase 1: Siege Matrix (Wave 1: 3 Siege Drones | Wave 2: 2 Siege Drones)
      if (b.phase === 1) {
        if (activeEscorts === 0 && !b.phase1SecondWaveSpawned) {
          b.phase1SecondWaveSpawned = true;
          b.invulnerable = true;
          showWaveAnnouncement('⚠️ SIEGE REINFORCEMENTS', '2 MORE SIEGE UNITS SPAWNED', true);
          this.spawnSiegeEscorts(2);
        } else if (activeEscorts === 0 && b.phase1SecondWaveSpawned) {
          b.invulnerable = false;
        } else {
          b.invulnerable = true;
        }

        if (!b.invulnerable && hpPct <= 0.80) {
          b.phase = 2;
          b.phaseTimer = 0;
          this.triggerPhaseBurst(b);
        }
      }
      // Phase 2: Pure Homing Missile Barrage
      else if (b.phase === 2) {
        b.invulnerable = false;
        if (hpPct <= 0.50) {
          b.phase = 3;
          b.phaseTimer = 0;
          b.invulnerable = true;
          this.triggerPhaseBurst(b);
          this.spawnSiegeEscorts(2); // 2 Siphon Drones
        }
      }
      // Phase 3: Siphon Energy Overdrive (Regenerate Health while Siphon Drones alive)
      else if (b.phase === 3) {
        b.invulnerable = activeEscorts > 0;
        if (activeEscorts > 0 && b.hp < b.maxHp * 0.80) {
          const healRate = [14, 11, 8, 5][Math.min(3, b.siphonRepairCount || 0)];
          b.hp = Math.min(b.maxHp * 0.80, b.hp + (healRate * dt / 1000));
          if (Math.random() < 0.4) {
            this.particles.push(spark(b.x + rand(-30, 30), b.y + rand(-30, 30), '#4dff88'));
          }
        }
        if (activeEscorts === 0 || hpPct <= 0.35) {
          b.phase = b.savedPhase || 4;
          b.savedPhase = null;
          b.phaseTimer = 0;
          b.invulnerable = false;
          if (this.selectedDifficulty === 'hard' && typeof Sound !== 'undefined') {
            Sound.playTheme('boss3');
          }
          this.triggerPhaseBurst(b);
        }
      }
      // Phase 4: Pure Drone Swarm Barrage
      else if (b.phase === 4) {
        b.invulnerable = false;
        if (hpPct <= 0.35) {
          b.phase = 5;
          b.phaseTimer = 0;
          this.triggerPhaseBurst(b);
        }
      }
      // Phase 5: Desperation Combined Assault
      else if (b.phase === 5) {
        b.invulnerable = false;
        if (hpPct <= 0.10) {
          b.phase = 6;
          b.phaseTimer = 0;
          this.triggerPhaseBurst(b);
        }
      }
      // Phase 6: Hyper Overdrive
      else if (b.phase === 6) {
        b.invulnerable = false;
      }

      // Phase Timeout Reset: If player stays in Phase 4, 5, or 6 for > 18s without advancing, boss triggers Siphon Repair!
      if ((b.phase === 4 || b.phase === 5 || b.phase === 6) && b.phaseTimer >= 18000) {
        b.siphonRepairCount = (b.siphonRepairCount || 0) + 1;
        b.savedPhase = b.phase;
        b.phase = 3;
        b.phaseTimer = 0;
        b.invulnerable = true;
        showWaveAnnouncement('⚠️ REPAIR OVERDRIVE', 'BOSS REGENERATING HEALTH - DESTROY SIPHON DRONES', true);
        this.triggerPhaseBurst(b);
        this.spawnSiegeEscorts(2);
      }

      // Hard Boss Attack Behaviors per Phase
      if (b.phase === 1) {
        // Phase 1: Escort Missile Support
        if (b.x > W - 150) b.x -= 70 * dt / 1000;
        b.targetY = H / 2 + Math.sin(b.timer * 1.5) * (H * 0.25);
        b.y += (b.targetY - b.y) * 2.5 * dt / 1000;

        b.shootTimer += dt;
        if ((!b.salvoCooldown || b.salvoCooldown <= 0) && (!b.missileQueue || b.missileQueue.length === 0) && b.shootTimer > 1500) {
          b.shootTimer = 0;
          this.launchMissileSalvo(b, randInt(4, 6), Math.random() < 0.5);
        }
      } else if (b.phase === 2) {
        // Phase 2: Dedicated Homing Missile Barrage
        if (b.x > W - 140) b.x -= 80 * dt / 1000;
        b.targetY = H / 2 + Math.sin(b.timer * 2.2) * (H * 0.30);
        b.y += (b.targetY - b.y) * 3.2 * dt / 1000;

        b.shootTimer += dt;
        if ((!b.salvoCooldown || b.salvoCooldown <= 0) && (!b.missileQueue || b.missileQueue.length === 0) && b.shootTimer > 1250) {
          b.shootTimer = 0;
          const count = randInt(5, 8);
          this.launchMissileSalvo(b, count, Math.random() < 0.5);
        }
      } else if (b.phase === 3) {
        // Phase 3: Siphon Overdrive Lock-in Position
        if (b.x > W - 140) b.x -= 80 * dt / 1000;
        b.targetY = H / 2;
        b.y += (b.targetY - b.y) * 4.0 * dt / 1000;
      } else if (b.phase === 4) {
        // Phase 4: Dedicated Drone Swarm Barrage + Delayed Homing Missiles
        if (b.x > W - 130) b.x -= 80 * dt / 1000;
        b.targetY = H / 2 + Math.sin(b.timer * 2.0) * (H * 0.32);
        b.y += (b.targetY - b.y) * 3.0 * dt / 1000;

        b.shootTimer += dt;
        if (b.shootTimer > 2400) {
          b.shootTimer = 0;
          const count = randInt(5, 9);
          const endlessHpBonus = (this.selectedDifficulty === 'endless') ? Math.floor(this.wave / 10) : 0;
          for (let i = 0; i < count; i++) {
            const yOffset = (i - (count - 1) / 2) * 24;
            this.enemies.push({
              type: 'kamikaze', x: b.x - 40, y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35), r: 12, vx: -rand(250, 400), vy: 0, amp: 48, freq: 3.4, t: i * 0.12, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus, isBossDrone: true
            });
          }
          // Delay 0.9s (900ms) gap before spawning 1-3 homing missiles
          b.p4MissileTimer = 900;
          b.p4MissileCount = randInt(1, 3);
        }

        if (b.p4MissileTimer > 0) {
          b.p4MissileTimer -= dt;
          if (b.p4MissileTimer <= 0) {
            b.p4MissileTimer = 0;
            this.launchMissileSalvo(b, b.p4MissileCount || randInt(1, 3), Math.random() < 0.5);
          }
        }
      } else if (b.phase === 5) {
        // Phase 5: Desperation Combined Assault with 5 Cruiser Guards
        if (!b.phase5GuardSlots) {
          this.initPhase5CruiserGuards(b);
        }

        // Update 5-second Cruiser Guard slot respawn timers
        if (b.phase5GuardSlots) {
          for (let i = 0; i < 5; i++) {
            const slot = b.phase5GuardSlots[i];
            if (slot && slot.respawnTimer > 0) {
              slot.respawnTimer -= dt;
              if (slot.respawnTimer <= 0) {
                slot.respawnTimer = 0;
                this.spawnSingleCruiserGuard(b, i, 5);
              }
            }
          }
        }

        b.targetY = H / 2 + Math.sin(b.timer * 2.6) * (H * 0.35);
        b.y += (b.targetY - b.y) * 3.6 * dt / 1000;

        b.shootTimer += dt;
        if ((!b.salvoCooldown || b.salvoCooldown <= 0) && (!b.missileQueue || b.missileQueue.length === 0) && b.shootTimer > 1200) {
          b.shootTimer = 0;
          const dCount = randInt(5, 8);
          const endlessHpBonus = (this.selectedDifficulty === 'endless') ? Math.floor(this.wave / 10) : 0;
          for (let i = 0; i < dCount; i++) {
            const yOffset = (i - (dCount - 1) / 2) * 22;
            this.enemies.push({
              type: 'kamikaze', x: b.x - 40, y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35), r: 12, vx: -rand(250, 400), vy: 0, amp: 48, freq: 3.4, t: i * 0.12, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus, isBossDrone: true
            });
          }
          this.launchMissileSalvo(b, randInt(4, 7), true);
        }
      } else if (b.phase === 6) {
        // Phase 6: HYPER-OVERDRIVE with 4 Cruiser Guards
        if (!b.phase6GuardSlots) {
          this.initPhase6CruiserGuards(b);
        }

        // Update 5-second Cruiser Guard slot respawn timers for Phase 6
        if (b.phase6GuardSlots) {
          for (let i = 0; i < 4; i++) {
            const slot = b.phase6GuardSlots[i];
            if (slot && slot.respawnTimer > 0) {
              slot.respawnTimer -= dt;
              if (slot.respawnTimer <= 0) {
                slot.respawnTimer = 0;
                this.spawnSingleCruiserGuard(b, i, 4);
              }
            }
          }
        }

        b.targetY = H / 2 + Math.sin(b.timer * 3.2) * (H * 0.38);
        b.y += (b.targetY - b.y) * 4.2 * dt / 1000;

        if (Math.random() < 0.45) {
          this.particles.push(spark(b.x + rand(-b.r, b.r), b.y + rand(-b.r, b.r), '#ffee55'));
        }

        b.shootTimer += dt;
        if ((!b.salvoCooldown || b.salvoCooldown <= 0) && (!b.missileQueue || b.missileQueue.length === 0) && b.shootTimer > 1000) {
          b.shootTimer = 0;
          const mCount = randInt(5, 8);
          const dCount = randInt(6, 9);
          const endlessHpBonus = (this.selectedDifficulty === 'endless') ? Math.floor(this.wave / 10) : 0;
          for (let i = 0; i < dCount; i++) {
            const yOffset = (i - (dCount - 1) / 2) * 22;
            this.enemies.push({
              type: 'kamikaze', x: b.x - 40, y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35), r: 12, vx: -rand(260, 430), vy: 0, amp: 50, freq: 3.6, t: i * 0.1, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus
            });
          }
          this.launchMissileSalvo(b, mCount, true);
        }
      }
      return;
    }

    // Standard Leviathan Boss Phase Transitions (Normal / Endless modes)
    const hpPct = b.hp / b.maxHp;
    let newPhase = 1;
    if (hpPct <= 0.33) newPhase = 3;
    else if (hpPct <= 0.66) newPhase = 2;

    if (b.phase !== newPhase) {
      b.phase = newPhase;
      this.triggerPhaseBurst(b);
    }

    // Phase 1 Logic
    if (b.phase === 1) {
      if (b.x > W - 165) {
        b.x -= 60 * dt / 1000;
      }
      b.targetY = H / 2 + Math.sin(b.timer * 1.6) * (H * 0.28);
      b.y += (b.targetY - b.y) * 2.5 * dt / 1000;

      b.shootTimer += dt;
      if ((!b.salvoCooldown || b.salvoCooldown <= 0) && (!b.missileQueue || b.missileQueue.length === 0) && b.shootTimer > 1500) {
        b.shootTimer = 0;
        const count = randInt(3, 6);
        const isStaggered = Math.random() < 0.5;
        this.launchMissileSalvo(b, count, isStaggered);
      }
    }
    // Phase 2 Logic
    else if (b.phase === 2) {
      if (b.x > W - 130) {
        b.x -= 80 * dt / 1000;
      }
      b.targetY = H / 2 + Math.sin(b.timer * 1.2) * (H * 0.22);
      b.y += (b.targetY - b.y) * 2.0 * dt / 1000;

      b.shootTimer += dt;
      if (b.shootTimer > 1600) {
        b.shootTimer = 0;
        const count = randInt(4, 7);
        const endlessHpBonus = (this.selectedDifficulty === 'endless') ? Math.floor(this.wave / 10) : 0;
        for (let i = 0; i < count; i++) {
          const yOffset = (i - (count - 1) / 2) * 26;
          this.enemies.push({
            type: 'kamikaze', x: b.x - 40, y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35), r: 12, vx: -rand(220, 370), vy: 0, amp: 40, freq: 3, t: i * 0.15, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus
          });
        }
      }
    }
    // Phase 3 Logic
    else if (b.phase === 3) {
      b.targetY = H / 2 + Math.sin(b.timer * 2.4) * (H * 0.35);
      b.y += (b.targetY - b.y) * 3.5 * dt / 1000;

      if (Math.random() < 0.35) {
        this.particles.push(spark(b.x + rand(-b.r, b.r), b.y + rand(-b.r, b.r), '#ffee55'));
      }

      b.shootTimer += dt;
      if ((!b.salvoCooldown || b.salvoCooldown <= 0) && (!b.missileQueue || b.missileQueue.length === 0) && b.shootTimer > 1300) {
        b.shootTimer = 0;
        const endlessHpBonus = (this.selectedDifficulty === 'endless') ? Math.floor(this.wave / 10) : 0;
        const attackRoll = Math.random();

        if (attackRoll < 0.30) {
          const mCount = randInt(3, 6);
          const isStaggered = Math.random() < 0.5;
          this.launchMissileSalvo(b, mCount, isStaggered);
        } else if (attackRoll < 0.60) {
          const dCount = randInt(6, 9);
          for (let i = 0; i < dCount; i++) {
            const yOffset = (i - (dCount - 1) / 2) * 22;
            this.enemies.push({
              type: 'kamikaze', x: b.x - 40, y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35), r: 12, vx: -rand(240, 400), vy: 0, amp: 50, freq: 3.5, t: i * 0.12, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus
            });
          }
          b.salvoCooldown = 1800;
        } else {
          const dCount = randInt(6, 9);
          const mCount = randInt(3, 6);
          for (let i = 0; i < dCount; i++) {
            const yOffset = (i - (dCount - 1) / 2) * 22;
            this.enemies.push({
              type: 'kamikaze', x: b.x - 40, y: clamp(b.y + yOffset, HUD_HEIGHT + 35, H - 35), r: 12, vx: -rand(240, 400), vy: 0, amp: 50, freq: 3.5, t: i * 0.12, hp: 1 + endlessHpBonus, maxHp: 1 + endlessHpBonus
            });
          }
          const isStaggered = Math.random() < 0.4;
          this.launchMissileSalvo(b, mCount, isStaggered);
        }
      }
    }
  },

  draw() {
    const vp = this.getViewport();
    const W = vp.vw;
    const H = vp.vh;
    const baseX = Math.max(70, W * 0.09);

    ctx.save();
    ctx.scale(vp.scale, vp.scale);

    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // Fortified Base Structure
    drawBaseStructure(ctx, W, H, baseX, this.turret.r, this.health, this.healthFlashTimer);

    // Telegraphed Solar Flare Warning Lanes & Firing Waves (Supports Stacking)
    if (this.activeSolarFlares && this.activeSolarFlares.length > 0) {
      const warnPulse = 0.2 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.45;
      for (const flare of this.activeSolarFlares) {
        if (flare.state === 'warning' && flare.lanes) {
          for (const laneY of flare.lanes) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 176, 32, ${warnPulse})`;
            ctx.fillRect(0, laneY - 24, W, 48);
            ctx.strokeStyle = '#ffb020';
            ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 10;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(0, laneY - 24); ctx.lineTo(W, laneY - 24);
            ctx.moveTo(0, laneY + 24); ctx.lineTo(W, laneY + 24);
            ctx.stroke();
            ctx.restore();
          }
        } else if (flare.state === 'firing' && flare.lanes) {
          for (const laneY of flare.lanes) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 60, 0, 0.45)';
            ctx.shadowColor = '#ff3d00'; ctx.shadowBlur = 25;
            ctx.fillRect(0, laneY - 24, W, 48);
            ctx.restore();
          }
        }
      }
    }

    // Force Barrier Shield(s) around Base & Turret if active
    if (this.shields && this.shields.length > 0) {
      ctx.save();
      ctx.strokeStyle = getComputedColor('--hazard');
      ctx.shadowColor = getComputedColor('--hazard');
      ctx.shadowBlur = 18;

      const count = this.shields.length;
      const rings = Math.min(count, 4);
      for (let i = 0; i < rings; i++) {
        const s = this.shields[i];
        const radius = this.turret.r + 14 + i * 6;
        const progress = Math.max(0, Math.min(1, s.timer / (s.maxTimer || 12000)));

        // Faint background ring track
        ctx.save();
        ctx.strokeStyle = 'rgba(77, 216, 255, 0.15)';
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, 2.5 - i * 0.4);
        ctx.beginPath();
        ctx.arc(this.turret.x, this.turret.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Active countdown arc (shrinking clockwise as 6-second timer counts down)
        ctx.lineWidth = Math.max(1.5, 3.5 - i * 0.6);
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + progress * Math.PI * 2;
        ctx.arc(this.turret.x, this.turret.y, radius, startAngle, endAngle, false);
        ctx.stroke();
      }

      if (count > 1) {
        ctx.fillStyle = getComputedColor('--hazard');
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🛡️ x${count}`, this.turret.x, this.turret.y - this.turret.r - 20);
      }
      ctx.restore();
    }

    drawTurret(ctx, this.turret.x, this.turret.y, this.turret.r);

    // Player Bolts & Pulse Beams
    for (const b of this.bolts) {
      ctx.save();
      if (b.isPulseBeam) {
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe'; ctx.shadowBlur = 18;
        ctx.fillRect(b.x - 24, b.y - 5, 36, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x - 20, b.y - 2, 28, 4);
      } else {
        const color = b.pierce ? getComputedColor('--hazard') : getComputedColor('--energy');
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.fillRect(b.x - 12, b.y - (b.pierce ? 3 : 2), b.pierce ? 22 : 16, b.pierce ? 6 : 4);
      }
      ctx.restore();
    }

    // Deployable Dual Pulse Turrets
    if (this.activePulseTurrets) {
      for (const pt of this.activePulseTurrets) {
        drawPulseTurret(ctx, pt);
      }
    }

    // Homing Missiles
    for (const m of this.missiles) {
      drawMissile(ctx, m);
    }

    // Dropped Power-ups
    for (const d of this.drops) {
      drawPowerup(ctx, d);
    }

    // Enemies
    for (const e of this.enemies) {
      drawEnemy(ctx, e);
    }

    // Boss Siphon Energy Beams (Phase 3)
    if (this.boss && this.boss.isHardBoss && this.boss.phase === 3) {
      for (const e of this.enemies) {
        if (e.isEscort || e.type === 'beam_dreadnought') {
          ctx.save();
          ctx.strokeStyle = '#4dff88';
          ctx.shadowColor = '#4dff88'; ctx.shadowBlur = 16;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(this.boss.x, this.boss.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Boss & Boss Missiles
    if (this.boss) {
      drawBoss(ctx, this.boss);
    }

    drawParticles(ctx, this.particles);

    // Arena boundary border frame
    ctx.strokeStyle = getComputedColor('--panel-border');
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);

    ctx.restore();
  }
};

window.assault = assault;

/* ---------------------------------------------------------
   HUD Update & Upgrades UI
--------------------------------------------------------- */
function createBossHUD() {
  removeBossHUD();
  const hud = document.createElement('div');
  hud.id = 'boss-hud';
  hud.className = 'boss-phase-1';
  hud.innerHTML = `
    <div class="boss-header">
      <span class="boss-name">LEVIATHAN FLAGSHIP</span>
      <span class="boss-phase-tag" id="boss-phase-tag">PHASE 1 // MISSILE BARRAGE</span>
    </div>
    <div id="bossbar-wrap"><div id="bossbar"></div></div>
  `;
  document.body.appendChild(hud);
}

function removeBossHUD() {
  removeWaveAnnouncement();
  const existing = document.getElementById('boss-hud');
  if (existing) existing.remove();
}

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

let lastUpgradesState = '';

function renderUpgradesHTML(force) {
  const bar = document.getElementById('upgrade-bar');
  if (!bar) return;

  const isHard = assault.selectedDifficulty !== 'normal';
  const rCosts = isHard ? [150, 300] : [100, 250];
  const mCosts = isHard ? [200, 400] : [150, 350];
  const fCosts = isHard ? [250, 450] : [200, 400];

  const rCost = assault.fireRateLevel < 3 ? rCosts[assault.fireRateLevel - 1] : 'MAX';
  const mCost = assault.multishotLevel < 3 ? mCosts[assault.multishotLevel - 1] : 'MAX';
  const fCost = assault.fortifyLevel < 3 ? fCosts[assault.fortifyLevel - 1] : 'MAX';

  const rAffordable = assault.fireRateLevel < 3 && assault.points >= rCost;
  const mAffordable = assault.multishotLevel < 3 && assault.points >= mCost;
  const fAffordable = assault.fortifyLevel < 3 && assault.points >= fCost;

  const isEndlessWave9 = assault.selectedDifficulty === 'endless' && assault.wave > 9;
  const ptCost = assault.pulseTurretCost || 600;
  const ptAffordable = assault.points >= ptCost;

  let pulseTurretHTML = '';
  if (isEndlessWave9) {
    pulseTurretHTML = `
      <button type="button" class="upgrade-chip pulse-turret-chip ${ptAffordable ? 'affordable' : ''}" data-upgrade="pulse_turrets" title="Deploy Dual Pulse Turrets (${ptCost} pts)">
        <span class="hotkey-badge">[4]</span><span class="upg-icon">🤖</span> <span class="upg-name">Pulse Turrets</span> <span class="upg-cost">(${ptCost})</span>
      </button>
    `;
  }

  const currentState = `${assault.points}_${assault.fireRateLevel}_${assault.multishotLevel}_${assault.fortifyLevel}_${ptCost}_${rAffordable}_${mAffordable}_${fAffordable}_${ptAffordable}_${isEndlessWave9}`;
  if (!force && currentState === lastUpgradesState) return;
  lastUpgradesState = currentState;

  bar.innerHTML = `
    <button type="button" class="upgrade-chip ${rAffordable ? 'affordable' : (assault.fireRateLevel === 3 ? 'maxed' : '')}" data-upgrade="rate" title="Rate Level ${assault.fireRateLevel} (${rCost})">
      <span class="hotkey-badge">[1]</span><span class="upg-icon">⚡</span> <span class="upg-name">Rate</span> <span class="upg-lvl"><span class="upg-lvl-word">Lvl </span>${assault.fireRateLevel}</span> <span class="upg-cost">(${rCost})</span>
    </button>
    <button type="button" class="upgrade-chip ${mAffordable ? 'affordable' : (assault.multishotLevel === 3 ? 'maxed' : '')}" data-upgrade="spread" title="Spread Level ${assault.multishotLevel} (${mCost})">
      <span class="hotkey-badge">[2]</span><span class="upg-icon">💥</span> <span class="upg-name">Spread</span> <span class="upg-lvl"><span class="upg-lvl-word">Lvl </span>${assault.multishotLevel}</span> <span class="upg-cost">(${mCost})</span>
    </button>
    <button type="button" class="upgrade-chip ${fAffordable ? 'affordable' : (assault.fortifyLevel === 3 ? 'maxed' : '')}" data-upgrade="fortify" title="Fortify Level ${assault.fortifyLevel} (${fCost})">
      <span class="hotkey-badge">[3]</span><span class="upg-icon">🛡️</span> <span class="upg-name">Fortify</span> <span class="upg-lvl"><span class="upg-lvl-word">Lvl </span>${assault.fortifyLevel}</span> <span class="upg-cost">(${fCost})</span>
    </button>
    ${pulseTurretHTML}
  `;

  bar.querySelectorAll('.upgrade-chip').forEach(btn => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const type = btn.getAttribute('data-upgrade');
      assault.buyUpgrade(type);
    };
    btn.onclick = handler;
    btn.onpointerdown = (e) => { e.stopPropagation(); };
    btn.onmousedown = (e) => { e.stopPropagation(); };
    btn.ontouchstart = (e) => { e.stopPropagation(); };
  });
}

function renderAssaultHUDNumbers() {
  const w = document.getElementById('hv-wave');
  if (w) w.textContent = `${assault.wave} / ${assault.totalWaves === Infinity ? '∞' : assault.totalWaves}`;

  const pts = document.getElementById('hv-points');
  if (pts) pts.textContent = assault.points;

  const hb = document.getElementById('healthbar');
  if (hb) hb.style.width = clamp((assault.health / (assault.maxHealth || 100)) * 100, 0, 100) + '%';

  if (assault.boss) {
    const bb = document.getElementById('bossbar');
    if (bb) bb.style.width = clamp((assault.boss.hp / assault.boss.maxHp) * 100, 0, 100) + '%';

    const bhud = document.getElementById('boss-hud');
    const tag = document.getElementById('boss-phase-tag');
    const nameEl = bhud ? bhud.querySelector('.boss-name') : null;

    if (bhud && tag) {
      if (assault.boss.isHardBoss) {
        if (nameEl) nameEl.textContent = 'LEVIATHAN OMEGA';
        const p = assault.boss.phase;
        const inv = assault.boss.invulnerable ? ' [VOID SHIELD ACTIVE]' : '';
        const phaseNames = [
          '',
          `PHASE 1 // SIEGE MATRIX${inv}`,
          `PHASE 2 // HOMING MISSILE BARRAGE`,
          `PHASE 3 // SIPHON REPAIR OVERDRIVE${inv}`,
          `PHASE 4 // DRONE SWARM BARRAGE`,
          `PHASE 5 // DESPERATION ASSAULT`,
          `PHASE 6 // HYPER OVERDRIVE`
        ];
        tag.textContent = phaseNames[p] || `PHASE ${p} // OVERDRIVE`;
      } else {
        if (nameEl) nameEl.textContent = 'LEVIATHAN FLAGSHIP';
        const phase = assault.boss.phase;
        bhud.className = `boss-phase-${phase}`;
        if (phase === 1) tag.textContent = 'PHASE 1 // MISSILE BARRAGE';
        else if (phase === 2) tag.textContent = 'PHASE 2 // DRONE LAUNCHER';
        else tag.textContent = 'PHASE 3 // HYPER OVERDRIVE';
      }
    }
  }

  renderUpgradesHTML();
}

function showAssaultEnd(win) {
  removeWaveAnnouncement();
  if (typeof Sound !== 'undefined') {
    Sound.fadeOutBGM(600);
    Sound.play(win ? 'waveClear' : 'gameOver');
  }
  if (typeof assault !== 'undefined' && typeof assault.checkHighestWave === 'function') {
    assault.checkHighestWave();
  }
  let unlockHTML = '';
  if (win && typeof setAssaultUnlock === 'function') {
    if (assault.selectedDifficulty === 'normal') {
      setAssaultUnlock('hard');
      unlockHTML = `<div class="unlock-banner">💀 HARD MODE UNLOCKED!</div>`;
    } else if (assault.selectedDifficulty === 'hard') {
      setAssaultUnlock('endless');
      unlockHTML = `<div class="unlock-banner">♾️ ENDLESS ASSAULT UNLOCKED!</div>`;
    }
  }

  const isEndless = assault.selectedDifficulty === 'endless';
  const statRowHTML = isEndless ? `
    <div class="stat-row">
      <div class="stat"><span class="num">${assault.wave}</span><span class="lbl">Wave</span></div>
      <div class="stat"><span class="num">${assault.highestEndlessWave || 0}</span><span class="lbl">Best Wave</span></div>
      <div class="stat"><span class="num">${assault.kills}</span><span class="lbl">Kills</span></div>
      <div class="stat"><span class="num">${assault.points}</span><span class="lbl">Score</span></div>
    </div>
  ` : `
    <div class="stat-row">
      <div class="stat"><span class="num">${assault.wave}</span><span class="lbl">Waves</span></div>
      <div class="stat"><span class="num">${assault.kills}</span><span class="lbl">Kills</span></div>
      <div class="stat"><span class="num">${assault.points}</span><span class="lbl">Score</span></div>
    </div>
  `;

  panel.innerHTML = `
    <h1 class="title ${win ? 'victory-title' : 'loss-title'}">${win ? 'VICTORY SECURED' : 'BASE LOST'}</h1>
    ${unlockHTML}
    <div id="gate">${gateSVG('assault')}</div>
    ${statRowHTML}
    <p class="desc">${win ? 'The Leviathan Flagship has been shattered! The sector is saved.' : 'The base fell before the enemy invasion was repelled.'}</p>
    <button id="btn-retry2">${win ? 'Play Again' : 'Retry Defense'}</button>
  `;
  overlay.classList.remove('hidden');
  document.getElementById('btn-retry2').addEventListener('click', () => {
    if (typeof showStart === 'function') {
      showStart();
    } else {
      overlay.classList.add('hidden');
      assault.start();
    }
  });
}

/* ---------------------------------------------------------
   Sprite & Visual Drawing Functions
--------------------------------------------------------- */
function drawBaseStructure(ctx, W, H, baseX, turretR, health, healthFlashTimer) {
  const wallX = baseX + turretR + 6;
  const wallW = 16;
  const maxHP = (assault && assault.maxHealth) || 100;
  const healthPct = Math.max(0, Math.min(1, health / maxHP));
  const now = performance.now();

  // Dynamic Base Health & Flash Color Indicator
  let energyColor = 'rgba(77, 216, 255, 0.85)';
  let glowColor = '#4dd8ff';

  if (healthFlashTimer > 0) {
    // Green Health Pickup Flash Glow Override
    const healPulse = 0.5 + Math.sin(now * 0.02) * 0.5;
    glowColor = '#4dff88';
    energyColor = `rgba(77, 255, 136, ${0.7 + healPulse * 0.3})`;
  } else if (healthPct <= 0.25) {
    // Flash Red Alarm when almost destroyed (health <= 25%)
    const dangerFlash = Math.abs(Math.sin(now * 0.014));
    glowColor = dangerFlash > 0.3 ? '#ff1744' : '#660015';
    energyColor = `rgba(255, 23, 68, ${0.35 + dangerFlash * 0.65})`;
  } else if (healthPct <= 0.5) {
    energyColor = 'rgba(255, 176, 32, 0.9)';
    glowColor = '#ffb020';
  }

  ctx.save();

  // ---------------------------------------------------------
  // 1. SOLID BASE INTERIOR BULKHEAD BACKGROUND (x: 0 to wallX - wallW)
  // ---------------------------------------------------------
  const baseGrad = ctx.createLinearGradient(0, 0, wallX - wallW, 0);
  baseGrad.addColorStop(0, '#04050a');
  baseGrad.addColorStop(0.5, '#090d19');
  baseGrad.addColorStop(1, '#0e1426');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, HUD_HEIGHT, wallX - wallW, H - HUD_HEIGHT);

  // Floor Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  const gridSize = 24;
  for (let gx = 0; gx < wallX - wallW; gx += gridSize) {
    ctx.beginPath();
    ctx.moveTo(gx, HUD_HEIGHT);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = HUD_HEIGHT; gy < H; gy += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(wallX - wallW, gy);
    ctx.stroke();
  }

  // Vertical Energy Conduit Pipes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fillRect(18, HUD_HEIGHT, 6, H - HUD_HEIGHT);
  ctx.fillRect(52, HUD_HEIGHT, 8, H - HUD_HEIGHT);

  // Active Energy Conduit Glow Channel LEDs
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = (healthFlashTimer > 0 || healthPct <= 0.25) ? 12 : 6;
  ctx.fillStyle = energyColor;
  const pulseAlpha = (healthFlashTimer > 0 || healthPct <= 0.25)
    ? 0.55 + Math.sin(now * 0.016) * 0.4
    : 0.35 + Math.sin(now * 0.004) * 0.12;
  ctx.globalAlpha = Math.max(0.1, pulseAlpha);
  ctx.fillRect(19, HUD_HEIGHT, 4, H - HUD_HEIGHT);
  ctx.fillRect(54, HUD_HEIGHT, 4, H - HUD_HEIGHT);
  ctx.restore();

  // ---------------------------------------------------------
  // 2. RECESSED TURRET SLIDER RAIL TRACK (Around baseX)
  // ---------------------------------------------------------
  const railX = baseX - 8;
  const railW = 16;
  ctx.fillStyle = '#050711';
  ctx.fillRect(railX, HUD_HEIGHT, railW, H - HUD_HEIGHT);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(railX, HUD_HEIGHT, railW, H - HUD_HEIGHT);

  // Gear Notch Ribs along slider track
  ctx.fillStyle = '#171e30';
  for (let ry = HUD_HEIGHT + 10; ry < H; ry += 16) {
    ctx.fillRect(railX + 2, ry, 3, 6);
    ctx.fillRect(railX + railW - 5, ry, 3, 6);
  }

  // ---------------------------------------------------------
  // 3. HEAVY FORTIFIED OUTER WALL (Right Wall Section)
  // ---------------------------------------------------------
  // Wall Body Steel Gradient
  const wallGrad = ctx.createLinearGradient(wallX - wallW, 0, wallX, 0);
  wallGrad.addColorStop(0, '#101525');
  wallGrad.addColorStop(0.4, '#1d263f');
  wallGrad.addColorStop(0.8, '#2d3b61');
  wallGrad.addColorStop(1, '#161c2e');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(wallX - wallW, HUD_HEIGHT, wallW, H - HUD_HEIGHT);

  // Interlocking Armor Plate Panels & Horizontal Bevel Seams
  const panelH = 60;
  for (let py = HUD_HEIGHT; py < H; py += panelH) {
    // Horizontal Panel Seam Shadow
    ctx.strokeStyle = '#060812';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX - wallW, py);
    ctx.lineTo(wallX, py);
    ctx.stroke();

    // Structural Rivet Dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(wallX - wallW + 3, py + 6, 2, 2);
    ctx.fillRect(wallX - wallW + 3, py + panelH - 8, 2, 2);

    // Bevel Highlight Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wallX - wallW + 2, py + 2);
    ctx.lineTo(wallX - 2, py + 2);
    ctx.stroke();
  }

  // ---------------------------------------------------------
  // 4. FRONT ENERGY BARRIER SEAM & DEFENSE NODE POD LEDs
  // ---------------------------------------------------------
  // Glowing Vertical Energy Barrier LED Line on Wall Edge
  ctx.save();
  ctx.strokeStyle = glowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = (healthFlashTimer > 0) ? 26 : (healthPct <= 0.25 ? 20 : 14);
  ctx.lineWidth = (healthFlashTimer > 0 || healthPct <= 0.25) ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(wallX, HUD_HEIGHT);
  ctx.lineTo(wallX, H);
  ctx.stroke();
  ctx.restore();

  // Defense Node Emitter Pods along front wall
  const podPositions = [HUD_HEIGHT + 45, (HUD_HEIGHT + H) / 2, H - 45];
  for (const py of podPositions) {
    ctx.save();
    ctx.fillStyle = '#141a2a';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (healthFlashTimer > 0) ? 16 : (healthPct <= 0.25 ? 12 : 8);

    ctx.beginPath();
    ctx.moveTo(wallX - 4, py - 12);
    ctx.lineTo(wallX + 5, py - 7);
    ctx.lineTo(wallX + 5, py + 7);
    ctx.lineTo(wallX - 4, py + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Node Crystal LED Lens Indicator
    ctx.fillStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (healthFlashTimer > 0) ? 14 : (healthPct <= 0.25 ? 10 : 6);
    ctx.beginPath();
    ctx.arc(wallX + 1, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawMissile(ctx, m) {
  ctx.save();
  ctx.translate(m.x, m.y);

  const angle = Math.atan2(m.vy, m.vx);
  ctx.rotate(angle);

  // Thruster Flame
  ctx.fillStyle = '#ffb020';
  ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(-m.r, -m.r * 0.4);
  ctx.lineTo(-m.r - (6 + Math.random() * 4), 0);
  ctx.lineTo(-m.r, m.r * 0.4);
  ctx.fill();

  // Missile Body
  ctx.fillStyle = '#ff1744';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(m.r * 1.4, 0);
  ctx.lineTo(-m.r * 0.6, -m.r * 0.6);
  ctx.lineTo(-m.r, -m.r * 0.4);
  ctx.lineTo(-m.r, m.r * 0.4);
  ctx.lineTo(-m.r * 0.6, m.r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Nose Sensor Tip
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(m.r * 0.6, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPowerup(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);

  if (d.inBase && d.baseTimer != null) {
    ctx.globalAlpha = Math.max(0.15, 1 - (d.baseTimer / 1000));
  }

  let color = '#4dff88';
  let icon = '✚';
  if (d.type === 'overcharge') {
    color = 'var(--energy)';
    icon = '⚡';
  } else if (d.type === 'shield') {
    color = 'var(--hazard)';
    icon = '🛡️';
  }

  const c = getComputedColor(color.replace('var(', '').replace(')', ''));
  ctx.shadowColor = c;
  ctx.shadowBlur = 14;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(0, 0, d.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#05060e';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 0, 1);

  ctx.restore();
}

function drawTurret(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);

  const now = performance.now();
  const playerColor = getComputedColor('--player') || '#ff3d81';
  const energyColor = getComputedColor('--energy') || '#ffb020';
  const hazardColor = getComputedColor('--hazard') || '#4dd8ff';

  const multishot = (typeof assault !== 'undefined' && assault.multishotLevel) || 1;
  const laserLvl = (typeof assault !== 'undefined' && assault.laserLevel) || 1;
  const isOvercharged = (typeof assault !== 'undefined' && assault.overchargeTimer > 0);
  const timeSinceShot = now - ((typeof assault !== 'undefined' && assault.lastShotTime) || 0);

  // Mechanical Recoil calculation (quick punch back then smooth return)
  let recoilX = 0;
  if (timeSinceShot < 140) {
    const recoilFactor = Math.sin((timeSinceShot / 140) * Math.PI);
    recoilX = -recoilFactor * (multishot === 3 ? 5 : 3.5);
  }

  const pulse = Math.sin(now * 0.006) * 0.15 + 0.85;
  const themeGlow = isOvercharged ? energyColor : (laserLvl >= 2 ? hazardColor : playerColor);

  // ---------------------------------------------------------
  // 1. REAR BASE MOUNT & HEAVY TRACK RAILS (Attached to wall)
  // ---------------------------------------------------------
  ctx.save();
  const railX = -r * 1.05;
  const railW = 9;
  const railH = r * 2.3;

  // Rail track base shadow & fill
  ctx.fillStyle = '#060812';
  ctx.fillRect(railX - 3, -railH * 0.5 - 2, railW + 3, railH + 4);

  // Metallic rail plates
  const railGrad = ctx.createLinearGradient(railX, 0, railX + railW, 0);
  railGrad.addColorStop(0, '#0e1222');
  railGrad.addColorStop(0.5, '#222b45');
  railGrad.addColorStop(1, '#0b0f1d');
  ctx.fillStyle = railGrad;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(railX, -railH * 0.5, railW, railH);
  ctx.fill();
  ctx.stroke();

  // Rail rivet bolts & vertical hydraulic indicator
  ctx.fillStyle = themeGlow;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(railX + 2, -railH * 0.4, 2, 3);
  ctx.fillRect(railX + 2, railH * 0.4 - 3, 2, 3);
  ctx.globalAlpha = 1.0;

  // Hydraulic Strut Pistons connecting Rail to Main Turret Base
  ctx.fillStyle = '#1a2035';
  ctx.fillRect(railX + railW, -r * 0.55, r * 0.45, 4);
  ctx.fillRect(railX + railW, r * 0.55 - 4, r * 0.45, 4);

  // Shiny piston chrome shaft
  ctx.fillStyle = '#7a89b0';
  ctx.fillRect(railX + railW + 2, -r * 0.55 + 1, r * 0.35, 2);
  ctx.fillRect(railX + railW + 2, r * 0.55 - 3, r * 0.35, 2);
  ctx.restore();

  // ---------------------------------------------------------
  // 2. OVERCHARGE / POWER-UP REINFORCED ENERGY FIELD
  // ---------------------------------------------------------
  if (isOvercharged) {
    ctx.save();
    ctx.strokeStyle = energyColor;
    ctx.shadowColor = energyColor;
    ctx.shadowBlur = 20 * pulse;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------
  // 3. HEAVY TURRET CHASSIS BASE (Octagonal Base Plate)
  // ---------------------------------------------------------
  ctx.save();
  ctx.shadowColor = themeGlow;
  ctx.shadowBlur = 14 * pulse;

  // Outer Octagonal Base Outline
  const baseR = r * 0.95;
  ctx.fillStyle = '#0c101d';
  ctx.strokeStyle = themeGlow;
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 + Math.PI / 8;
    const bx = Math.cos(angle) * baseR;
    const by = Math.sin(angle) * baseR;
    if (i === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner Metallic Bevel Ring
  ctx.shadowBlur = 0;
  const chassisGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 2, 0, 0, baseR);
  chassisGrad.addColorStop(0, '#2a3454');
  chassisGrad.addColorStop(0.6, '#151b2d');
  chassisGrad.addColorStop(1, '#090d18');
  ctx.fillStyle = chassisGrad;
  ctx.beginPath();
  ctx.arc(0, 0, baseR * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Armor Sector Plate Insets
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -baseR * 0.75); ctx.lineTo(0, baseR * 0.75);
  ctx.moveTo(-baseR * 0.75, 0); ctx.lineTo(baseR * 0.75, 0);
  ctx.stroke();
  ctx.restore();

  // ---------------------------------------------------------
  // 4. CANNON BARRELS & RECOIL ASSEMBLY (Draw BEFORE Main Dome)
  // ---------------------------------------------------------
  ctx.save();
  ctx.translate(recoilX, 0); // Apply firing recoil displacement

  const barrelLength = r * 1.45;
  const barrelGlow = laserLvl >= 2 ? hazardColor : themeGlow;

  // Helper to draw a single heavy cannon barrel
  const drawBarrel = (byOffset, bw, bl, isCenter) => {
    ctx.save();
    // Barrel Shadow
    ctx.fillStyle = '#05070e';
    ctx.fillRect(r * 0.2, byOffset - bw / 2 + 1, bl, bw);

    // Barrel Steel Shroud Gradient
    const bGrad = ctx.createLinearGradient(0, byOffset - bw / 2, 0, byOffset + bw / 2);
    bGrad.addColorStop(0, '#3a4768');
    bGrad.addColorStop(0.3, '#1f273b');
    bGrad.addColorStop(0.7, '#121724');
    bGrad.addColorStop(1, '#0a0d16');
    ctx.fillStyle = bGrad;
    ctx.fillRect(r * 0.25, byOffset - bw / 2, bl, bw);

    // Reinforced Barrel Clamp / Heat Sink Rings
    ctx.fillStyle = '#101524';
    ctx.fillRect(r * 0.5, byOffset - bw / 2 - 1, 4, bw + 2);
    ctx.fillRect(r * 0.85, byOffset - bw / 2 - 1, 4, bw + 2);

    // Laser / Energy Optics Channel inside barrel
    if (laserLvl >= 2) {
      ctx.fillStyle = hazardColor;
      ctx.shadowColor = hazardColor;
      ctx.shadowBlur = 8;
      ctx.fillRect(r * 0.3, byOffset - 1, bl - 4, 2);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(r * 0.3, byOffset - 0.7, bl - 4, 1.4);
    }

    // Barrel Muzzle Tip Shroud
    ctx.fillStyle = '#2d3752';
    ctx.fillRect(r * 0.25 + bl - 3, byOffset - bw / 2 - 0.5, 4, bw + 1);

    // Muzzle Energy Glow Cap
    ctx.shadowColor = barrelGlow;
    ctx.shadowBlur = 10 * pulse;
    ctx.fillStyle = barrelGlow;
    ctx.fillRect(r * 0.25 + bl, byOffset - bw / 2 + 0.5, 2.5, bw - 1);

    ctx.restore();
  };

  if (multishot === 1) {
    // Single Heavy Cannon Barrel
    drawBarrel(0, 7.5, barrelLength, true);
  } else if (multishot === 2) {
    // Dual Twin Parallel Barrels
    drawBarrel(-6.5, 5.5, barrelLength * 0.95, false);
    drawBarrel(6.5, 5.5, barrelLength * 0.95, false);
  } else {
    // Triple Spread Cannon Array (Central Heavy + 2 Angled Flank Barrels)
    ctx.save();
    ctx.rotate(-0.15);
    drawBarrel(-5, 4.8, barrelLength * 0.88, false);
    ctx.restore();

    ctx.save();
    ctx.rotate(0.15);
    drawBarrel(5, 4.8, barrelLength * 0.88, false);
    ctx.restore();

    drawBarrel(0, 6.5, barrelLength, true);
  }

  ctx.restore(); // end recoil block

  // ---------------------------------------------------------
  // 5. MAIN TURRET DOME HOUSING & REACTOR CORE
  // ---------------------------------------------------------
  ctx.save();
  ctx.shadowColor = themeGlow;
  ctx.shadowBlur = 14 * pulse;

  // Sleek Armored Housing Pod (Forward Pointing Polygon)
  const domeGrad = ctx.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.7, r * 0.6);
  domeGrad.addColorStop(0, '#2d3856');
  domeGrad.addColorStop(0.4, '#192033');
  domeGrad.addColorStop(0.8, '#0f1422');
  domeGrad.addColorStop(1, '#070a12');

  ctx.fillStyle = domeGrad;
  ctx.strokeStyle = themeGlow;
  ctx.lineWidth = 1.6;

  ctx.beginPath();
  ctx.moveTo(-r * 0.75, -r * 0.45);
  ctx.lineTo(-r * 0.3, -r * 0.65);
  ctx.lineTo(r * 0.45, -r * 0.45);
  ctx.lineTo(r * 0.75, 0); // Nose apex pointing right
  ctx.lineTo(r * 0.45, r * 0.45);
  ctx.lineTo(-r * 0.3, r * 0.65);
  ctx.lineTo(-r * 0.75, r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Side Heat Vents (Top & Bottom Vents)
  ctx.shadowBlur = 0;
  ctx.fillStyle = isOvercharged ? energyColor : '#090d18';
  ctx.strokeStyle = themeGlow;
  ctx.lineWidth = 0.8;
  for (let side = -1; side <= 1; side += 2) {
    for (let vent = 0; vent < 3; vent++) {
      const vx = -r * 0.35 + vent * 6;
      const vy = side * (r * 0.48);
      ctx.fillRect(vx, vy - 1, 4, 2);
    }
  }

  // Metallic Armor Plating Center Cutout Accent
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 0.35);
  ctx.lineTo(r * 0.2, -r * 0.25);
  ctx.lineTo(r * 0.4, 0);
  ctx.lineTo(r * 0.2, r * 0.25);
  ctx.lineTo(-r * 0.4, r * 0.35);
  ctx.closePath();
  ctx.fill();

  // Glowing Reactor Core Orb in Center of Housing
  const coreR = r * 0.32;
  const coreGrad = ctx.createRadialGradient(-r * 0.1, 0, 1, -r * 0.1, 0, coreR);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.4, themeGlow);
  coreGrad.addColorStop(1, 'rgba(10, 14, 26, 0.9)');

  ctx.shadowColor = themeGlow;
  ctx.shadowBlur = 18 * pulse;
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(-r * 0.1, 0, coreR, 0, Math.PI * 2);
  ctx.fill();

  // Core Lens Grid Ring
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-r * 0.1, 0, coreR * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  // Forward Target Acquisition Sensor Optic Lens / Visor (at turret nose)
  ctx.fillStyle = themeGlow;
  ctx.shadowColor = themeGlow;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(r * 0.5, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

function drawPulseTurret(ctx, pt) {
  ctx.save();
  ctx.translate(pt.x, pt.y);
  const now = performance.now();
  const rot = (now / 350) % (Math.PI * 2);

  // Outer Rotating Cybernetic Ring
  ctx.save();
  ctx.rotate(rot);
  ctx.strokeStyle = '#00f2fe';
  ctx.shadowColor = '#00f2fe'; ctx.shadowBlur = 14;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();

  // Orbital Nodes
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Core Body Housing
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#7c5cff';
  ctx.shadowColor = '#7c5cff'; ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Forward Beam Emitter Nose
  ctx.fillStyle = '#00f2fe';
  ctx.shadowColor = '#00f2fe'; ctx.shadowBlur = 12;
  ctx.fillRect(4, -3, 7, 6);

  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === 'beam_dreadnought') {
    // Massive Heavy Armored Beam Dreadnought
    const pulse = Math.sin((e.t || 0) * 8) * 0.15 + 0.85;

    // Thruster Flames
    ctx.save();
    ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 14 * pulse;
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(e.r * 0.7, -e.r * 0.4, e.r * 0.6, e.r * 0.25);
    ctx.fillRect(e.r * 0.7, e.r * 0.15, e.r * 0.6, e.r * 0.25);
    ctx.restore();

    // Heavy Fortified Main Chassis Outer Polygon
    ctx.save();
    ctx.shadowColor = 'rgba(255,23,68,0.85)'; ctx.shadowBlur = 18 * pulse;
    ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 2.5;
    ctx.fillStyle = '#0a0d18';

    ctx.beginPath();
    ctx.moveTo(-e.r * 1.3, 0); // Front emitter nose
    ctx.lineTo(-e.r * 0.5, -e.r * 0.85);
    ctx.lineTo(e.r * 0.8, -e.r * 0.8);
    ctx.lineTo(e.r * 0.6, 0);
    ctx.lineTo(e.r * 0.8, e.r * 0.8);
    ctx.lineTo(-e.r * 0.5, e.r * 0.85);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Charging Coils / Heat Vents on sides
    ctx.fillStyle = e.state === 'charging' ? '#ffab00' : (e.state === 'firing' ? '#ff1744' : '#141c2e');
    ctx.fillRect(-e.r * 0.3, -e.r * 0.7, 12, 4);
    ctx.fillRect(-e.r * 0.3, e.r * 0.6, 12, 4);

    // Glowing Central Reactor Core Orb
    const coreColor = e.state === 'firing' ? '#ff1744' : (e.state === 'charging' ? '#ffab00' : '#d50000');
    ctx.shadowColor = coreColor; ctx.shadowBlur = e.state === 'charging' ? 20 : 10;
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(-e.r * 0.1, 0, e.r * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Optic Emitter Lens at Nose
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-e.r * 1.1, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // CHARGING ANIMATION & SIGHT BEAM
    if (e.state === 'charging' && e.maxChargeTime > 0) {
      const chargePct = Math.min(1, e.chargeTimer / e.maxChargeTime);

      // Telegraphed Horizontal Aiming Sight Beam
      ctx.save();
      ctx.strokeStyle = `rgba(255, 23, 68, ${0.15 + chargePct * 0.45})`;
      ctx.lineWidth = 1 + chargePct * 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(-e.r * 1.2, 0);
      ctx.lineTo(-1000, 0);
      ctx.stroke();
      ctx.restore();

      // Energy Gathering Ring Shrinking onto Lens
      ctx.save();
      const ringR = (1 - chargePct) * 35 + 6;
      ctx.strokeStyle = '#ffab00';
      ctx.shadowColor = '#ffab00'; ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-e.r * 1.1, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // FIRING SUSTAINED LASER BEAM
    if (e.state === 'firing') {
      ctx.save();
      ctx.fillStyle = '#ff1744';
      ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 24;

      // Outer Thick Beam
      ctx.fillRect(-1000, -10, 1000 - e.r * 1.1, 20);

      // Inner Core White Beam
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.fillRect(-1000, -4, 1000 - e.r * 1.1, 8);
      ctx.restore();
    }

    ctx.restore();

    // Health Bar for Beam Dreadnought
    if (e.hp < e.maxHp) {
      ctx.save();
      const bw = e.r * 1.8, bh = 4;
      const bx = e.x - bw / 2, by = e.y - e.r - 12;
      ctx.fillStyle = 'rgba(8, 10, 20, 0.8)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
      ctx.restore();
    }
    return;
  }

  const isDamaged = e.hp != null && e.maxHp != null && e.hp < e.maxHp;
  let pulse = Math.sin((e.t || 0) * 8) * 0.15 + 0.85;

  let colorPrimary = '#ff1744';
  let colorGlow = 'rgba(255,23,68,0.85)';
  let colorCore = '#ff5252';

  if (e.type === 'kamikaze') {
    colorPrimary = '#ffab00';
    colorGlow = 'rgba(255,171,0,0.85)';
    colorCore = '#ffd600';
  } else if (e.type === 'cruiser') {
    colorPrimary = '#e0115f';
    colorGlow = 'rgba(224,17,95,0.85)';
    colorCore = '#e040fb';
  }

  // Thruster Flame
  ctx.save();
  ctx.shadowColor = colorPrimary; ctx.shadowBlur = 12 * pulse;
  ctx.fillStyle = colorPrimary;
  ctx.beginPath();
  const fLen = e.r * (0.8 + Math.random() * 0.4);
  ctx.moveTo(e.r * 0.6, -e.r * 0.3); ctx.lineTo(e.r * 0.6 + fLen, 0); ctx.lineTo(e.r * 0.6, e.r * 0.3);
  ctx.fill();
  ctx.restore();

  // Outer Hull
  ctx.shadowColor = colorGlow; ctx.shadowBlur = 16 * pulse;
  ctx.strokeStyle = colorPrimary; ctx.lineWidth = 2;
  ctx.fillStyle = '#0b0d18';

  ctx.beginPath();
  if (e.type === 'kamikaze') {
    ctx.moveTo(-e.r * 1.5, 0);
    ctx.lineTo(e.r * 0.8, -e.r * 0.7);
    ctx.lineTo(e.r * 0.4, 0);
    ctx.lineTo(e.r * 0.8, e.r * 0.7);
  } else if (e.type === 'cruiser') {
    ctx.moveTo(-e.r * 1.3, 0);
    ctx.lineTo(-e.r * 0.7, -e.r * 0.9);
    ctx.lineTo(e.r * 0.9, -e.r * 0.9);
    ctx.lineTo(e.r * 0.6, 0);
    ctx.lineTo(e.r * 0.9, e.r * 0.9);
    ctx.lineTo(-e.r * 0.7, e.r * 0.9);
  } else {
    ctx.moveTo(-e.r * 1.4, 0);
    ctx.lineTo(-e.r * 0.3, -e.r * 0.4);
    ctx.lineTo(e.r * 0.9, -e.r * 0.9);
    ctx.lineTo(e.r * 0.2, -e.r * 0.25);
    ctx.lineTo(e.r * 0.7, 0);
    ctx.lineTo(e.r * 0.2, e.r * 0.25);
    ctx.lineTo(e.r * 0.9, e.r * 0.9);
    ctx.lineTo(-e.r * 0.3, e.r * 0.4);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Cruiser Frontal Arc Shield Plate
  if (e.type === 'cruiser') {
    ctx.save();
    ctx.strokeStyle = getComputedColor('--hazard');
    ctx.shadowColor = getComputedColor('--hazard'); ctx.shadowBlur = 10;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 1.15, Math.PI * 0.7, Math.PI * 1.3);
    ctx.stroke();
    ctx.restore();
  }

  // Glowing Eye/Visor
  ctx.shadowColor = colorCore; ctx.shadowBlur = 10 * pulse;
  ctx.fillStyle = colorCore;
  ctx.beginPath();
  ctx.ellipse(-e.r * 0.35, 0, e.r * 0.3, e.r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Health Bar for Cruisers
  if (e.type === 'cruiser' && isDamaged) {
    ctx.save();
    const bw = e.r * 1.8, bh = 3.5;
    const bx = e.x - bw / 2, by = e.y - e.r - 10;
    ctx.fillStyle = 'rgba(8, 10, 20, 0.8)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = colorPrimary;
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    ctx.restore();
  }
}

/* ---------------------------------------------------------
   Detailed & Threatening LEVIATHAN FLAGSHIP Model
--------------------------------------------------------- */
function drawBoss(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);

  const pulse = Math.sin((b.timer || 0) * 8) * 0.15 + 0.85;

  let coreColor = '#ff1744'; // Phase 1: Crimson Red (Missiles)
  let glowColor = 'rgba(255, 23, 68, 0.85)';
  if (b.phase === 2) {
    coreColor = '#ffb020'; // Phase 2: Amber Yellow (Drones)
    glowColor = 'rgba(255, 176, 32, 0.7)';
  } else if (b.phase === 3) {
    coreColor = '#e040fb'; // Phase 3: Hyper Magenta / Glitch Purple
    glowColor = 'rgba(224, 64, 251, 0.9)';
  }

  // Quad Thruster Plumes
  ctx.save();
  ctx.shadowColor = coreColor; ctx.shadowBlur = 24 * pulse;
  ctx.fillStyle = coreColor;
  const fL = b.r * (0.9 + Math.random() * 0.45);
  ctx.beginPath();
  // Engine 1 & 2 (Upper)
  ctx.moveTo(b.r * 0.8, -b.r * 0.55); ctx.lineTo(b.r * 0.8 + fL, -b.r * 0.45); ctx.lineTo(b.r * 0.8, -b.r * 0.35);
  ctx.moveTo(b.r * 0.8, -b.r * 0.25); ctx.lineTo(b.r * 0.8 + fL * 0.8, -b.r * 0.18); ctx.lineTo(b.r * 0.8, -b.r * 0.12);
  // Engine 3 & 4 (Lower)
  ctx.moveTo(b.r * 0.8, b.r * 0.12); ctx.lineTo(b.r * 0.8 + fL * 0.8, b.r * 0.18); ctx.lineTo(b.r * 0.8, b.r * 0.25);
  ctx.moveTo(b.r * 0.8, b.r * 0.35); ctx.lineTo(b.r * 0.8 + fL, b.r * 0.45); ctx.lineTo(b.r * 0.8, b.r * 0.55);
  ctx.fill();
  ctx.restore();

  // Spiked Multi-Segment Mandibles & Wings Outer Outline
  ctx.shadowColor = glowColor; ctx.shadowBlur = 28 * pulse;
  ctx.strokeStyle = coreColor; ctx.lineWidth = 2.5;
  ctx.fillStyle = '#060712';

  ctx.beginPath();
  ctx.moveTo(-b.r * 1.85, 0);              // Threatening Nose Mandible Blade Tip
  ctx.lineTo(-b.r * 1.1, -b.r * 0.45);
  ctx.lineTo(-b.r * 1.5, -b.r * 0.85);     // Upper Front Mandible Blade
  ctx.lineTo(-b.r * 0.6, -b.r * 0.8);
  ctx.lineTo(-b.r * 1.1, -b.r * 1.25);     // Upper Outer Wing Blade
  ctx.lineTo(b.r * 0.2, -b.r * 1.1);
  ctx.lineTo(b.r * 0.85, -b.r * 0.65);     // Top Rear Wing Pod
  ctx.lineTo(b.r * 0.5, -b.r * 0.3);
  ctx.lineTo(b.r * 0.8, 0);               // Rear Center Exhaust Segment
  ctx.lineTo(b.r * 0.5, b.r * 0.3);
  ctx.lineTo(b.r * 0.85, b.r * 0.65);      // Bottom Rear Wing Pod
  ctx.lineTo(b.r * 0.2, b.r * 1.1);
  ctx.lineTo(-b.r * 1.1, b.r * 1.25);      // Lower Outer Wing Blade
  ctx.lineTo(-b.r * 0.6, b.r * 0.8);
  ctx.lineTo(-b.r * 1.5, b.r * 0.85);      // Lower Front Mandible Blade
  ctx.lineTo(-b.r * 1.1, b.r * 0.45);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Armor Panel Overlays
  ctx.shadowBlur = 0;
  ctx.fillStyle = b.phase === 3 ? '#230e2b' : '#141829';
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(-b.r * 0.8, 0);
  ctx.lineTo(-b.r * 0.2, -b.r * 0.55);
  ctx.lineTo(b.r * 0.4, -b.r * 0.5);
  ctx.lineTo(b.r * 0.2, 0);
  ctx.lineTo(b.r * 0.4, b.r * 0.5);
  ctx.lineTo(-b.r * 0.2, b.r * 0.55);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Phase 1 Hangar Bay Doors
  if (b.phase === 1) {
    ctx.fillStyle = '#ffab00';
    ctx.shadowColor = '#ffab00'; ctx.shadowBlur = 10;
    ctx.fillRect(-b.r * 0.3, -b.r * 0.45, 14, 5);
    ctx.fillRect(-b.r * 0.3, b.r * 0.4, 14, 5);
  }

  // Phase 2 & 3 Missile Launcher Pod Sensors
  if (b.phase >= 2) {
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-b.r * 0.5, -b.r * 0.7, 4, 0, Math.PI * 2);
    ctx.arc(-b.r * 0.5, b.r * 0.7, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dual Glowing Energy Cores
  ctx.shadowColor = coreColor; ctx.shadowBlur = 20 * pulse;
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.ellipse(-b.r * 0.35, -b.r * 0.2, b.r * 0.22, b.r * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(-b.r * 0.35, b.r * 0.2, b.r * 0.22, b.r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hexagonal Void Shield Matrix (when b.invulnerable === true)
  if (b.invulnerable) {
    ctx.save();
    const sPulse = 0.6 + Math.sin((b.timer || 0) * 10) * 0.4;
    ctx.strokeStyle = `rgba(124, 92, 255, ${sPulse})`;
    ctx.shadowColor = '#7c5cff'; ctx.shadowBlur = 26 * sPulse;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    const hexR = b.r * 1.45;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const hx = Math.cos(a) * hexR;
      const hy = Math.sin(a) * hexR;
      if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(124, 92, 255, ${0.08 + sPulse * 0.08})`;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/* ==========================================================================
   DEBUG MODE CONTROLS (Assault Mode)
   ========================================================================== */
if (typeof initAssaultDebugControls === 'function') {
  initAssaultDebugControls();
}
/* ==========================================================================
   END DEBUG MODE CONTROLS
   ========================================================================== */
