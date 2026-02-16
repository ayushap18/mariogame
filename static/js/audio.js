/**
 * Procedural audio using Web Audio API.
 * Generates retro-style sound effects without any audio files.
 */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _playTone(freq, duration, type, volumeMult) {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const vol = this.volume * (volumeMult || 1);

    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  jump() {
    if (!this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(this.volume * 0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  coin() {
    this._playTone(988, 0.05, 'square', 0.4);
    setTimeout(() => this._playTone(1319, 0.15, 'square', 0.4), 50);
  }

  stomp() {
    this._playTone(400, 0.08, 'square', 0.5);
    setTimeout(() => this._playTone(500, 0.1, 'square', 0.3), 60);
  }

  powerup() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.1, 'square', 0.3), i * 80);
    });
  }

  death() {
    const notes = [500, 400, 350, 300, 250, 200];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.15, 'triangle', 0.4), i * 100);
    });
  }

  levelComplete() {
    const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.12, 'square', 0.3), i * 80);
    });
  }

  blockHit() {
    this._playTone(200, 0.08, 'square', 0.3);
  }

  gameOver() {
    const notes = [392, 330, 262, 220, 185, 165];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.25, 'triangle', 0.4), i * 150);
    });
  }

  star() {
    const notes = [784, 988, 1175, 1319, 1568, 1760, 1976, 2093];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.08, 'square', 0.25), i * 60);
    });
  }

  voiceReady() {
    this._playTone(880, 0.06, 'sine', 0.2);
    setTimeout(() => this._playTone(1100, 0.08, 'sine', 0.2), 70);
  }

  menuSelect() {
    this._playTone(660, 0.08, 'square', 0.2);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

const audioManager = new AudioManager();

export { AudioManager, audioManager };
