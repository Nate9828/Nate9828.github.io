/* ---------------------------------------------------------
   NOVA SHIFT — Assault Mode Sound Module (sound-assault.js)
   Weapon synthesizers, boss alarms, flares & assault BGM
--------------------------------------------------------- */

(function () {
  // Assault Mode BGM Tracks
  const assaultTracks = {
    normal: 'audio/assault/Perimeter Breach.mp3',
    boss1: 'audio/assault/Leviathan Omega.mp3',
    boss2: 'audio/assault/Boss Music2.mp3',
    boss3: 'audio/assault/Boss Music3.mp3',
    endless1: 'audio/assault/Infinite Overdrive.mp3',
    endless2: 'audio/assault/Infinite Overdrive2.mp3'
  };

  // Assault Mode SFX Cooldowns
  const assaultCooldowns = {
    playerShoot: 40,
    pulseTurretShoot: 40,
    enemyShoot: 45,
    missileLaunch: 80,
    missileBeep: 110,
    hitEnemy: 30,
    upgradeSuccess: 120,
    upgradeFail: 120,
    solarFlareWarning: 300,
    solarFlareBeam: 250,
    bossAlarm: 500,
    bossPhaseTransition: 500,
    waveClear: 600
  };

  function registerAssaultAudio() {
    if (typeof Sound !== 'undefined' && Sound) {
      if (Sound.tracks) Object.assign(Sound.tracks, assaultTracks);
      if (Sound.cooldowns) Object.assign(Sound.cooldowns, assaultCooldowns);
    }
  }

  // Extend NovaAudioEngine prototype with Assault Mode SFX methods
  const proto = typeof NovaAudioEngine !== 'undefined' ? NovaAudioEngine.prototype : (typeof Sound !== 'undefined' ? Sound : {});

  // 1. Player Weapons
  proto.playerShoot = function (style = 'single') {
    if (!this.canPlay('playerShoot') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (style === 'overcharge') {
      // Heavy deep plasma blast
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      sub.type = 'sine';
      sub.frequency.setValueAtTime(180, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.14);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.12);

      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      sub.start(now);
      osc.stop(now + 0.15);
      sub.stop(now + 0.15);
    } else if (style === 'triple') {
      // 3-way spread harmonic laser
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880 + Math.random() * 30, now);
      osc1.frequency.exponentialRampToValueAtTime(240, now + 0.09);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1100 + Math.random() * 40, now);
      osc2.frequency.exponentialRampToValueAtTime(330, now + 0.09);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.1);
      osc2.stop(now + 0.1);
    } else if (style === 'dual') {
      // Dual parallel laser
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(760, now);
      osc1.frequency.exponentialRampToValueAtTime(220, now + 0.08);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(780, now);
      osc2.frequency.exponentialRampToValueAtTime(230, now + 0.08);

      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.09);
      osc2.stop(now + 0.09);
    } else {
      // Standard Single Laser
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const startFreq = 720 + Math.random() * 60;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.075);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.085);
    }
  };

  // 2. Deployable Pulse Turret Shoot
  proto.turretShoot = function () {
    if (!this.canPlay('pulseTurretShoot') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1280 + Math.random() * 50, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  };

  // 3. Enemy Weapons
  proto.enemyShoot = function (type = 'grunt') {
    if (!this.canPlay('enemyShoot') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'cruiser' || type === 'heavy') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.14);
  };

  // 4. Homing Missile Launch & Tracking Beep
  proto.missileLaunch = function () {
    if (!this.canPlay('missileLaunch') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Rocket Whoosh Noise + Low Sine
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.16);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.19);
  };

  proto.missileBeep = function () {
    if (!this.canPlay('missileBeep') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1580, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.045);
  };

  // 5. Combat Hits
  proto.hitEnemy = function () {
    if (!this.canPlay('hitEnemy') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(620 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.045);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.055);
  };

  // 6. Boss Explosions
  proto.bossExplosion = function () {
    if (!this.ensureReady()) return;
    // Multi-stage cascading detonation
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.createExplosion(0.6 + i * 0.1, 400 - i * 40, 35, 0.5);
      }, i * 160);
    }
  };

  // 7. Upgrades & Turret Deploy
  proto.upgradeSuccess = function () {
    if (!this.canPlay('upgradeSuccess') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Major chord affirmation: C5 -> G5 -> C6
    const chord = [523.25, 783.99, 1046.50];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.24);
    });
  };

  proto.upgradeFail = function () {
    if (!this.canPlay('upgradeFail') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Negative 2-tone error buzz
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.setValueAtTime(85, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.18);
  };

  proto.turretDeploy = function () {
    if (!this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Servo lock-in chirp
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.16);
  };

  // 8. Boss & Environmental Hazards
  proto.solarFlareWarning = function () {
    if (!this.canPlay('solarFlareWarning') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.linearRampToValueAtTime(740, now + 0.18);
    osc.frequency.linearRampToValueAtTime(540, now + 0.36);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.4);
  };

  proto.solarFlareBeam = function () {
    if (!this.canPlay('solarFlareBeam') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Sizzling plasma roar
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.42);
  };

  proto.bossAlarm = function () {
    if (!this.canPlay('bossAlarm') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Ominous 2-tone alarm
    [0, 0.2].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + offset;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(idx === 0 ? 220 : 185, t);

      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  };

  proto.bossPhaseTransition = function () {
    if (!this.canPlay('bossPhaseTransition') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // EMP Shockwave Surge
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.55);

    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.62);
    sub.stop(now + 0.62);
  };

  // 9. Fanfares
  proto.waveClear = function () {
    if (!this.canPlay('waveClear') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Sci-fi victory fanfare
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.3);
    });
  };

  // Register immediately or on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerAssaultAudio);
  } else {
    registerAssaultAudio();
  }
})();
