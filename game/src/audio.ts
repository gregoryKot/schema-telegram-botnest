// Procedural audio via WebAudio — no asset files needed.
// A slow melancholic minor arpeggio + synth SFX. Must start on a user gesture.

type Osc = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private playing = false;
  private step = 0;
  private timer: number | null = null;
  private musicEnabled = true;
  private sfxEnabled = true;
  private mode: 'day' | 'home' = 'day';

  // Мобилки: тач-кнопки — это HTML-оверлей вне канваса Phaser, поэтому
  // this.input.once('pointerdown') внутри сцен на них не срабатывает и звук
  // никогда не разблокируется. Ловим ПЕРВЫЙ жест на уровне документа.
  private unlocked = false;
  unlockOnFirstGesture() {
    const go = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.ensure();      // resume() обязан случиться внутри жеста — иначе iOS держит ctx suspended
      this.startMusic();
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('touchend', go);
      window.removeEventListener('keydown', go);
    };
    window.addEventListener('pointerdown', go);
    window.addEventListener('touchend', go);
    window.addEventListener('keydown', go);
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 1 : 0;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ── Settings (menu) ─────────────────────────────────────────────────────────
  isMusicEnabled() { return this.musicEnabled; }
  isSfxEnabled()   { return this.sfxEnabled; }
  setMusicEnabled(b: boolean) {
    this.musicEnabled = b;
    if (!b) this.stopMusic();
    else { this.ensure(); this.startMusic(); }
  }
  setSfxEnabled(b: boolean) {
    this.sfxEnabled = b;
    if (this.sfxGain) this.sfxGain.gain.value = b ? 1 : 0;
  }

  private tone(freq: number, dur: number, type: Osc, vol: number, dest: AudioNode, slideTo?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // ── SFX ───────────────────────────────────────────────────────────────────
  private sfx(fn: (d: AudioNode) => void) { if (!this.sfxEnabled) return; this.ensure(); fn(this.sfxGain!); }
  jump()   { this.sfx(d => this.tone(300, 0.15, 'triangle', 0.22, d, 540)); }
  dash()   { this.sfx(d => this.tone(200, 0.18, 'sawtooth', 0.16, d, 80)); }
  hit()    { this.sfx(d => { this.tone(240, 0.09, 'square', 0.20, d, 120); this.tone(150, 0.12, 'triangle', 0.18, d); }); }
  split()  { this.sfx(d => this.tone(520, 0.13, 'square', 0.15, d, 940)); }
  hurt()   { this.sfx(d => this.tone(210, 0.30, 'sawtooth', 0.26, d, 70)); }
  freeze() { this.sfx(d => this.tone(680, 0.45, 'sine', 0.12, d, 430)); }
  anx()    { this.sfx(d => this.tone(120, 0.22, 'square', 0.15, d, 320)); }
  pickup() { this.sfx(d => { this.tone(660, 0.10, 'triangle', 0.20, d, 990); this.tone(990, 0.14, 'sine', 0.14, d); }); }
  toll()   { this.sfx(d => this.tone(110, 1.6, 'sine', 0.20, d, 90)); } // deep realization bell
  gate()   { this.sfx(d => { this.tone(520, 0.5, 'sine', 0.16, d, 130); this.tone(780, 0.35, 'triangle', 0.12, d, 260); }); } // стена растворяется

  // ── Music — per-chapter mood ────────────────────────────────────────────────
  // day:  slow melancholic A-minor arpeggio (Am · F · C · G)
  // home: lower, slower, heavier — D-minor an octave down (Dm · B♭ · Gm · A)
  setMode(m: 'day' | 'home') {
    if (this.mode === m) return;
    this.mode = m;
    this.step = 0;
  }

  startMusic() {
    if (!this.musicEnabled) return;
    this.ensure();
    if (this.playing || !this.ctx) return;
    this.playing = true;
    this.musicGain!.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 2.5);
    this.loop();
  }
  stopMusic() {
    this.playing = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.musicGain && this.ctx) this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
  }
  setIntensity(x: number) {
    // x 0..1 — music swells as overwhelm builds
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(0.5 + x * 0.35, this.ctx.currentTime, 0.6);
  }
  private loop() {
    if (!this.playing || !this.ctx || !this.musicGain) return;
    const MODES = {
      day: {
        chords: [
          [220.00, 261.63, 329.63, 261.63], // Am
          [174.61, 220.00, 261.63, 220.00], // F
          [261.63, 329.63, 392.00, 329.63], // C
          [196.00, 246.94, 293.66, 246.94], // G
        ],
        tempo: 470,
      },
      home: {
        chords: [
          [146.83, 174.61, 220.00, 174.61], // Dm
          [116.54, 146.83, 174.61, 146.83], // B♭
          [98.00,  116.54, 146.83, 116.54], // Gm
          [110.00, 138.59, 164.81, 138.59], // A
        ],
        tempo: 560,
      },
    };
    const { chords, tempo } = MODES[this.mode];
    const ci = Math.floor(this.step / 4) % chords.length;
    const ni = this.step % 4;
    this.tone(chords[ci][ni], 1.5, 'triangle', 0.15, this.musicGain);
    if (ni === 0) this.tone(chords[ci][0] / 2, 2.4, 'sine', 0.13, this.musicGain); // soft bass
    this.step++;
    this.timer = window.setTimeout(() => this.loop(), tempo);
  }
}

export const audio = new AudioEngine();
