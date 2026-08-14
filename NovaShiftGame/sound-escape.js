/* ---------------------------------------------------------
   NOVA SHIFT — Escape Mode Sound Module (sound-escape.js)
   Hypergate warp synthesizers, hazard alerts, laser SFX & escape BGM
--------------------------------------------------------- */

(function () {
  // Escape Mode BGM Tracks
  const escapeTracks = {
    escape_zone1: 'audio/escape/Asteroid Belt.mp3',
    escape_zone2: 'audio/escape/Plasma Nebula.mp3',
    escape_zone3: 'audio/escape/Cyber Laser Grid.mp3',
    escape_zone4: 'audio/escape/Black Hole Singularity.mp3',
    escape_zone5: 'audio/escape/Meteor Cavern.mp3',
    escape_overclocked: 'audio/escape/Overclocked Void.mp3',

    // Direct Theme Key Aliases
    asteroid: 'audio/escape/Asteroid Belt.mp3',
    plasma: 'audio/escape/Plasma Nebula.mp3',
    cyber: 'audio/escape/Cyber Laser Grid.mp3',
    blackhole: 'audio/escape/Black Hole Singularity.mp3',
    cavern: 'audio/escape/Meteor Cavern.mp3',
    overclocked: 'audio/escape/Overclocked Void.mp3'
  };

  // Escape Mode SFX Cooldowns
  const escapeCooldowns = {
    hypergateWarp: 700,
    hypergateExit: 500,
    laserWarning: 200,
    laserFire: 180,
    geyserWarning: 350,
    geyserErupt: 250,
    nearExitAlert: 1200,
    criticalHeartbeat: 800
  };

  function registerEscapeAudio() {
    if (typeof Sound !== 'undefined' && Sound) {
      if (Sound.tracks) Object.assign(Sound.tracks, escapeTracks);
      if (Sound.cooldowns) Object.assign(Sound.cooldowns, escapeCooldowns);
    }
  }

  // Extend NovaAudioEngine prototype with Escape Mode SFX methods
  const proto = typeof NovaAudioEngine !== 'undefined' ? NovaAudioEngine.prototype : (typeof Sound !== 'undefined' ? Sound : {});

  // 1. Hypergate & Warp SFX
  proto.hypergateWarp = function () {
    if (!this.canPlay('hypergateWarp') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Sub-bass ignition boom (140Hz -> 32Hz)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.6);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.65);

    // 2. Ascending hyper-acceleration sweep (120Hz -> 2400Hz)
    const sweep = ctx.createOscillator();
    const sweepFilter = ctx.createBiquadFilter();
    const sweepGain = ctx.createGain();

    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(120, now);
    sweep.frequency.exponentialRampToValueAtTime(2400, now + 0.7);

    sweepFilter.type = 'lowpass';
    sweepFilter.frequency.setValueAtTime(300, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(4500, now + 0.7);

    sweepGain.gain.setValueAtTime(0.35, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    sweep.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(this.sfxGain);
    sweep.start(now);
    sweep.stop(now + 0.78);

    // 3. Shimmering cosmic chords (E5 -> G#5 -> B5 -> E6)
    const chimeNotes = [659.25, 830.61, 987.77, 1318.51];
    chimeNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + 0.1 + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.48);
    });
  };

  proto.hypergateExit = function () {
    if (!this.canPlay('hypergateExit') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Deceleration down-sweep (2200Hz -> 280Hz)
    const sweep = ctx.createOscillator();
    const gain = ctx.createGain();

    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(2200, now);
    sweep.frequency.exponentialRampToValueAtTime(280, now + 0.4);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    sweep.connect(gain);
    gain.connect(this.sfxGain);
    sweep.start(now);
    sweep.stop(now + 0.45);

    // Major resolution chord (C5 -> G5 -> C6)
    const chord = [523.25, 783.99, 1046.50];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const cGain = ctx.createGain();
      const t = now + 0.05 + idx * 0.04;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      cGain.gain.setValueAtTime(0.22, t);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(cGain);
      cGain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.38);
    });
  };

  // 2. Hazard Warnings & Discharges
  proto.laserWarning = function () {
    if (!this.canPlay('laserWarning') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // High tech warning blip (dual short pulses 1760Hz / 2349Hz)
    [0, 0.06].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + offset;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 1760 : 2349, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.05);
    });
  };

  proto.laserFire = function () {
    if (!this.canPlay('laserFire') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Energized beam zap: modulated saw + bandpass sizzle
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(5, now);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.26);
  };

  proto.geyserWarning = function () {
    if (!this.canPlay('geyserWarning') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Molten magma bubbling hiss
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(260, now + 0.15);
    osc.frequency.linearRampToValueAtTime(140, now + 0.3);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.34);
  };

  proto.geyserErupt = function () {
    if (!this.canPlay('geyserErupt') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Roaring plasma magma eruption
    const duration = 0.35;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, now);
    filter.Q.setValueAtTime(2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + duration + 0.02);
  };

  // 3. Situational Alerts & Heartbeat
  proto.nearExitAlert = function () {
    if (!this.canPlay('nearExitAlert') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // High-tech double sonar alert (D6 -> F#6)
    [0, 0.12].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + offset;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 1174.66 : 1479.98, t);

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.1);
    });
  };

  proto.criticalHeartbeat = function () {
    if (!this.canPlay('criticalHeartbeat') || !this.ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Lub-dub low-frequency heartbeat thuds
    [0, 0.18].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + offset;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 75 : 60, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

      gain.gain.setValueAtTime(idx === 0 ? 0.45 : 0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.16);
    });
  };

  // Register immediately or on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerEscapeAudio);
  } else {
    registerEscapeAudio();
  }
})();
