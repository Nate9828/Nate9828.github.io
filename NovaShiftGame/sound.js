/* ---------------------------------------------------------
   NOVA SHIFT — Core Hybrid Sound & Audio Engine (sound.js)
   Web Audio API Procedural SFX Synthesizer + Custom Audio/BGM Loader
--------------------------------------------------------- */

class NovaAudioEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.masterVolume = 0.75;
    this.sfxVolume = 1.0;
    this.musicVolume = 0.60;
    this.musicVolumeScale = 0.60; // Max 100% music volume is capped 20% lower (0.80 ceiling)

    // Nodes
    this.masterGain = null;
    this.compressor = null;
    this.sfxGain = null;
    this.musicGain = null;

    // Active BGM & Themes (Populated by sound modules: sound-assault.js & sound-escape.js)
    this.tracks = {};
    this.currentTheme = null;
    this.pendingTheme = null;
    this.bgmAudio = null;
    this.fadingBgmAudio = null;
    this.bgmSource = null;
    this.bgmFadeInterval = null;
    this.bgmLoopCheckTimer = null;
    this.loopCrossfadeDuration = 2.5; // Seconds of seamless overlap when looping back into itself

    // Throttle tracker to prevent rapid polyphony clipping
    this.lastPlayed = {};
    this.cooldowns = {
      hitShield: 50,
      hitHull: 60,
      shieldBreak: 100,
      explosionSmall: 45,
      explosionMedium: 60,
      explosionLarge: 80,
      pickup: 60,
      gameOver: 800,
      uiClick: 60
    };

    // Load saved settings if available
    this.loadSettings();

    // Auto-unlock on first user interaction
    this.setupUnlockListeners();
  }

  loadSettings() {
    try {
      if (typeof loadSecure === 'function') {
        this.muted = loadSecure('novashift_sound_muted', false);
        this.masterVolume = loadSecure('novashift_master_vol', 0.75);
        this.sfxVolume = loadSecure('novashift_sfx_vol', 1.0);
        const savedMusic = loadSecure('novashift_music_vol', null);
        this.musicVolume = savedMusic !== null ? savedMusic : 0.60;
      } else {
        const m = localStorage.getItem('novashift_sound_muted');
        if (m !== null) this.muted = m === 'true';
        const v = localStorage.getItem('novashift_master_vol');
        if (v !== null) this.masterVolume = parseFloat(v) || 0.75;
        const mv = localStorage.getItem('novashift_music_vol');
        if (mv !== null) this.musicVolume = parseFloat(mv) || 0.60;
        const sv = localStorage.getItem('novashift_sfx_vol');
        if (sv !== null) this.sfxVolume = parseFloat(sv) || 1.0;
      }
    } catch (e) { }
  }

  saveSettings() {
    try {
      if (typeof saveSecure === 'function') {
        saveSecure('novashift_sound_muted', this.muted);
        saveSecure('novashift_master_vol', this.masterVolume);
        saveSecure('novashift_sfx_vol', this.sfxVolume);
        saveSecure('novashift_music_vol', this.musicVolume);
      } else {
        localStorage.setItem('novashift_sound_muted', String(this.muted));
        localStorage.setItem('novashift_master_vol', String(this.masterVolume));
      }
    } catch (e) { }
  }

  initContext() {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => { });
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master Compressor to prevent any sound clipping or distortion
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);

      // SFX Gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

      // Music Gain (scaled with music volume ceiling)
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume * this.musicVolumeScale, this.ctx.currentTime);

      // Routing: SFX -> Master -> Compressor -> Destination
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.initialized = true;
    } catch (e) {
      console.warn('NovaShift AudioContext initialization error:', e);
    }
  }

  setupUnlockListeners() {
    const unlock = () => {
      this.initContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => { });
      }
      this.updateUI();
      if (this.pendingTheme) {
        const theme = this.pendingTheme;
        this.pendingTheme = null;
        this.playTheme(theme);
      }
    };

    ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(evt => {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });
  }

  ensureReady() {
    if (!this.ctx || this.ctx.state === 'suspended') {
      this.initContext();
    }
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  canPlay(key) {
    if (this.muted) return false;
    const now = performance.now();
    const cooldown = this.cooldowns[key] || 30;
    if (this.lastPlayed[key] && now - this.lastPlayed[key] < cooldown) {
      return false;
    }
    this.lastPlayed[key] = now;
    return true;
  }

  /* ---------------------------------------------------------
     Sound Controls (Mute, Volumes, UI)
  --------------------------------------------------------- */
  getEffectiveMusicVolume() {
    if (this.muted) return 0;
    return Math.max(0, Math.min(1, this.masterVolume * this.musicVolume * this.musicVolumeScale));
  }

  syncBGMVolume() {
    const vol = this.getEffectiveMusicVolume();
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.muted;
      if (!this.bgmFadeInterval) {
        this.bgmAudio.volume = vol;
      }
    }
    if (this.fadingBgmAudio) {
      this.fadingBgmAudio.muted = this.muted;
    }
  }

  toggleMute() {
    this.initContext();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, now, 0.03);
    }
    this.syncBGMVolume();
    this.saveSettings();
    this.updateUI();
    if (!this.muted) {
      this.play('uiClick');
    }
    return this.muted;
  }

  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.03);
    }
    this.syncBGMVolume();
    this.saveSettings();
  }

  setSFXVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
    }
    this.saveSettings();
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * this.musicVolumeScale, this.ctx.currentTime, 0.03);
    }
    this.syncBGMVolume();
    this.saveSettings();
  }

  updateUI() {
    const btn = document.getElementById('btn-sound');
    if (!btn) return;
    const icon = btn.querySelector('.sound-icon') || btn.querySelector('span');
    if (icon) {
      icon.textContent = this.muted ? '🔇' : '🔊';
    }
    btn.setAttribute('title', this.muted ? 'Unmute Sound (M)' : 'Mute Sound (M)');
    if (this.muted) {
      btn.classList.add('muted');
    } else {
      btn.classList.remove('muted');
    }
  }

  /* ---------------------------------------------------------
     Universal Dispatcher: Sound.play(name, ...args)
  --------------------------------------------------------- */
  play(name, ...args) {
    if (this.muted) return;
    if (typeof this[name] === 'function') {
      try {
        this[name](...args);
      } catch (e) {
        console.warn('Audio play error:', name, e);
      }
    }
  }

  /* ---------------------------------------------------------
     Shared Procedural Sound Generators (Both Modes)
  --------------------------------------------------------- */

  // 1. Shield Impacts & Defense
  hitShield() {
    if (!this.canPlay('hitShield') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  shieldBreak() {
    if (!this.canPlay('shieldBreak') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Power-down descending tone + glass shatter
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(4, now);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  // 2. Hull Damage
  hitHull() {
    if (!this.canPlay('hitHull') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low crunch impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  // 3. Explosions (Small, Medium, Large)
  explosionSmall() {
    if (!this.canPlay('explosionSmall') || !this.ensureReady()) return;
    this.createExplosion(0.2, 800, 120, 0.28);
  }

  explosionMedium() {
    if (!this.canPlay('explosionMedium') || !this.ensureReady()) return;
    this.createExplosion(0.35, 600, 80, 0.36);
  }

  explosionLarge() {
    if (!this.canPlay('explosionLarge') || !this.ensureReady()) return;
    this.createExplosion(0.55, 450, 45, 0.48);
  }

  createExplosion(duration, filterStart, filterEnd, peakVol) {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterStart, now);
    filter.frequency.exponentialRampToValueAtTime(filterEnd, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Sub-bass thud for weight
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(130, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + duration * 0.8);

    subGain.gain.setValueAtTime(peakVol * 0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);

    noise.start(now);
    sub.start(now);
    noise.stop(now + duration + 0.02);
    sub.stop(now + duration + 0.02);
  }

  // 4. Power-ups, Crystals & Pickups
  pickup(type = 'overcharge') {
    if (!this.canPlay('pickup') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (type === 'nanite' || type === 'repair') {
      // Ascending healing chime (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.15);
      });
    } else if (type === 'shield') {
      // Crystalline power sound (E5 -> B5)
      const notes = [659.25, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.19);
      });
    } else if (type === 'chrono') {
      // High-tech chronoshift sparkle (G5 -> C6 -> E6 -> B6 fast arpeggio)
      const notes = [783.99, 1046.50, 1318.51, 1975.53];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.035;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.15);
      });
    } else if (type === 'energy' || type === 'crystal') {
      // Crisp neon crystal chime (A5 -> E6)
      const notes = [880, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.04;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.17);
      });
    } else {
      // Overcharge rising energetic chirp
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(1250, now + 0.16);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.19);
    }
  }

  // 5. Game Over Stinger
  gameOver() {
    if (!this.canPlay('gameOver') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Dark descending stinger
    const notes = [330, 293.66, 246.94, 185];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.12;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  // 6. UI Interaction
  uiClick() {
    if (!this.canPlay('uiClick') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /* ---------------------------------------------------------
     Theme & BGM Audio Track Player, Looper & Self-Crossfader
  --------------------------------------------------------- */
  clearBgmTimers() {
    if (this.bgmFadeInterval) {
      clearInterval(this.bgmFadeInterval);
      this.bgmFadeInterval = null;
    }
    if (this.bgmLoopCheckTimer) {
      clearInterval(this.bgmLoopCheckTimer);
      this.bgmLoopCheckTimer = null;
    }
  }

  setupLoopMonitor(audio, url) {
    if (!audio) return;

    const checkLoop = () => {
      if (!audio || audio.paused || audio.ended || audio._crossfadingLoop) return;
      if (this.bgmAudio !== audio) return;
      if (isNaN(audio.duration) || audio.duration <= 0) return;

      const crossfadeSec = Math.min(this.loopCrossfadeDuration, Math.max(1.0, audio.duration * 0.2));
      const triggerTime = audio.duration - crossfadeSec;

      if (audio.currentTime >= triggerTime) {
        this.performLoopCrossfade(audio, url, crossfadeSec);
      }
    };

    audio.addEventListener('timeupdate', checkLoop);

    if (this.bgmLoopCheckTimer) clearInterval(this.bgmLoopCheckTimer);
    this.bgmLoopCheckTimer = setInterval(checkLoop, 150);
  }

  performLoopCrossfade(outgoingAudio, url, crossfadeSec) {
    if (outgoingAudio._crossfadingLoop || this.bgmAudio !== outgoingAudio) return;
    outgoingAudio._crossfadingLoop = true;

    try {
      const nextAudio = new Audio(url);
      nextAudio.loop = false;
      nextAudio.muted = this.muted;
      nextAudio.volume = 0;

      const playPromise = nextAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (this.fadingBgmAudio && this.fadingBgmAudio !== outgoingAudio) {
            try {
              this.fadingBgmAudio.pause();
              this.fadingBgmAudio.currentTime = 0;
            } catch (e) { }
          }

          this.fadingBgmAudio = outgoingAudio;
          this.bgmAudio = nextAudio;
          this.setupLoopMonitor(nextAudio, url);

          const steps = 25;
          const interval = (crossfadeSec * 1000) / steps;
          let step = 0;
          const startOutgoingVol = outgoingAudio.volume;

          const crossfadeInterval = setInterval(() => {
            step++;
            const progress = Math.min(1, step / steps);
            const targetVol = this.getEffectiveMusicVolume();

            if (this.fadingBgmAudio === outgoingAudio) {
              outgoingAudio.volume = Math.max(0, startOutgoingVol * (1 - progress));
            }
            if (this.bgmAudio === nextAudio && !this.muted) {
              nextAudio.volume = Math.min(targetVol, targetVol * progress);
            }

            if (step >= steps || progress >= 1) {
              clearInterval(crossfadeInterval);
              outgoingAudio._crossfadingLoop = false;
              if (this.fadingBgmAudio === outgoingAudio) {
                try {
                  this.fadingBgmAudio.pause();
                  this.fadingBgmAudio.currentTime = 0;
                } catch (e) { }
                this.fadingBgmAudio = null;
              }
              if (this.bgmAudio && !this.muted) {
                this.bgmAudio.volume = this.getEffectiveMusicVolume();
              }
            }
          }, interval);
        }).catch(() => {
          outgoingAudio.loop = true;
          outgoingAudio._crossfadingLoop = false;
        });
      }
    } catch (e) {
      outgoingAudio.loop = true;
      outgoingAudio._crossfadingLoop = false;
    }
  }

  playTheme(themeName, crossfade = true) {
    if (!themeName) return;
    const resolvedTheme = (themeName === 'boss') ? 'boss1' : ((themeName === 'endless') ? 'endless1' : themeName);
    const url = this.tracks[resolvedTheme] || this.tracks[themeName] || themeName;

    // If already playing the same theme and audio is active, sync volume and return
    if (this.currentTheme === resolvedTheme && this.bgmAudio && !this.bgmAudio.paused && !this.bgmAudio.ended) {
      this.syncBGMVolume();
      return;
    }

    this.currentTheme = resolvedTheme;
    const targetVol = this.getEffectiveMusicVolume();

    try {
      this.clearBgmTimers();
      if (this.fadingBgmAudio) {
        try {
          this.fadingBgmAudio.pause();
          this.fadingBgmAudio.currentTime = 0;
        } catch (e) { }
        this.fadingBgmAudio = null;
      }

      const newAudio = new Audio(url);
      newAudio.loop = false;
      newAudio.muted = this.muted;

      // Handle Crossfade with currently playing audio
      if (crossfade && this.bgmAudio && !this.bgmAudio.paused) {
        const oldAudio = this.bgmAudio;
        this.fadingBgmAudio = oldAudio;
        this.bgmAudio = newAudio;
        newAudio.volume = 0;

        const playPromise = newAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            this.setupLoopMonitor(newAudio, url);
            const steps = 20;
            const duration = 800; // ms
            const interval = duration / steps;
            let step = 0;
            const startOldVol = oldAudio.volume;

            this.bgmFadeInterval = setInterval(() => {
              step++;
              const progress = Math.min(1, step / steps);
              const currTargetVol = this.getEffectiveMusicVolume();
              if (this.fadingBgmAudio) {
                this.fadingBgmAudio.volume = Math.max(0, startOldVol * (1 - progress));
              }
              if (newAudio && !this.muted) {
                newAudio.volume = Math.min(currTargetVol, currTargetVol * progress);
              }

              if (step >= steps || progress >= 1) {
                clearInterval(this.bgmFadeInterval);
                this.bgmFadeInterval = null;
                if (this.fadingBgmAudio) {
                  try {
                    this.fadingBgmAudio.pause();
                    this.fadingBgmAudio.currentTime = 0;
                  } catch (err) { }
                  this.fadingBgmAudio = null;
                }
                if (newAudio && !this.muted) newAudio.volume = this.getEffectiveMusicVolume();
              }
            }, interval);
          }).catch(e => {
            this.pendingTheme = themeName;
          });
        }
      } else {
        // Immediate play / replace
        if (this.bgmAudio) {
          try {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
          } catch (e) { }
        }
        this.bgmAudio = newAudio;
        this.bgmAudio.volume = targetVol;
        this.setupLoopMonitor(newAudio, url);
        const playPromise = this.bgmAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            this.pendingTheme = themeName;
          });
        }
      }
    } catch (e) {
      console.warn('BGM theme play error:', themeName, e);
    }
  }

  playBGM(url, loop = true) {
    if (this.tracks[url]) {
      this.playTheme(url);
    } else {
      this.playTheme(url);
    }
  }

  fadeOutBGM(duration = 600) {
    this.currentTheme = null;
    this.pendingTheme = null;
    this.clearBgmTimers();

    const audiosToFade = [];
    if (this.bgmAudio && !this.bgmAudio.paused) audiosToFade.push(this.bgmAudio);
    if (this.fadingBgmAudio && !this.fadingBgmAudio.paused) audiosToFade.push(this.fadingBgmAudio);
    this.bgmAudio = null;
    this.fadingBgmAudio = null;

    if (audiosToFade.length === 0) return;

    const startVolumes = audiosToFade.map(a => a.volume);
    const steps = 15;
    const interval = duration / steps;
    let step = 0;

    const fadeTimer = setInterval(() => {
      step++;
      const progress = Math.min(1, step / steps);
      audiosToFade.forEach((audio, idx) => {
        audio.volume = Math.max(0, startVolumes[idx] * (1 - progress));
      });
      if (step >= steps || progress >= 1) {
        clearInterval(fadeTimer);
        audiosToFade.forEach(audio => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (e) { }
        });
      }
    }, interval);
  }

  pauseBGM() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      try {
        this.bgmAudio.pause();
      } catch (e) { }
    }
    if (this.fadingBgmAudio && !this.fadingBgmAudio.paused) {
      try {
        this.fadingBgmAudio.pause();
      } catch (e) { }
    }
  }

  resumeBGM() {
    if (!this.muted) {
      if (this.bgmAudio && this.bgmAudio.paused) {
        try {
          this.bgmAudio.play().catch(() => { });
        } catch (e) { }
      }
      if (this.fadingBgmAudio && this.fadingBgmAudio.paused) {
        try {
          this.fadingBgmAudio.play().catch(() => { });
        } catch (e) { }
      }
    }
  }

  stopBGM() {
    this.currentTheme = null;
    this.pendingTheme = null;
    this.clearBgmTimers();
    if (this.fadingBgmAudio) {
      try {
        this.fadingBgmAudio.pause();
        this.fadingBgmAudio.currentTime = 0;
      } catch (e) { }
      this.fadingBgmAudio = null;
    }
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch (e) { }
      this.bgmAudio = null;
    }
  }
}

// Global Singleton instance
window.Sound = new NovaAudioEngine();
window.AudioEngine = window.Sound;
