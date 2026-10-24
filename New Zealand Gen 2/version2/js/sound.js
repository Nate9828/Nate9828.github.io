    // =========================================================================
    // 1. AUDIO SYNTHESIZER (Procedural Web Audio API sound effects & waves)
    // =========================================================================
    const SoundFX = {
      enabled: false,
      ctx: null,
      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      },
      playTone(freq = 440, duration = 0.18, type = 'sine', gainVal = 0.08) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      },
      playHarvest() {
        this.playTone(523.25, 0.14, 'triangle', 0.09);
        setTimeout(() => this.playTone(659.25, 0.2, 'triangle', 0.09), 70);
      },
      playBuild() {
        this.playTone(220, 0.12, 'square', 0.05);
        setTimeout(() => this.playTone(330, 0.18, 'triangle', 0.07), 90);
      },
      playMilestone() {
        [392, 493.88, 587.33, 783.99].forEach((f, idx) => {
          setTimeout(() => this.playTone(f, 0.32, 'sine', 0.09), idx * 95);
        });
      }
    };

window.SoundFX = SoundFX;
