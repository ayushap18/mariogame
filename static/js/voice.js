/**
 * AI Voice Helper using Web Speech API (SpeechSynthesis).
 * Speaks AI tips, commentary, and chat responses aloud.
 * No API key required - uses browser built-in text-to-speech.
 */

class VoiceHelper {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.enabled = false;
    this.voice = null;
    this.rate = 0.95;
    this.pitch = 1.15;
    this.volume = 0.8;
    this._voicesLoaded = false;
    this._speaking = false;

    if (this.synth) {
      this._loadVoices();
      this.synth.onvoiceschanged = () => this._loadVoices();
    }

    const saved = localStorage.getItem('voiceEnabled');
    if (saved === 'true') this.enabled = true;
  }

  _loadVoices() {
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;
    this._voicesLoaded = true;

    const preferred =
      voices.find(v => v.name.includes('Samantha')) ||
      voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang.startsWith('en-US')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];

    this.voice = preferred;
  }

  get available() {
    return !!this.synth;
  }

  get isSpeaking() {
    return this.synth ? this.synth.speaking : false;
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('voiceEnabled', this.enabled);
    if (!this.enabled) {
      this.stop();
    }
    return this.enabled;
  }

  speak(text) {
    if (!this.enabled || !this.synth || !text) return;

    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    utterance.onstart = () => { this._speaking = true; };
    utterance.onend = () => { this._speaking = false; };
    utterance.onerror = () => { this._speaking = false; };

    this.synth.speak(utterance);
  }

  speakTip(text) {
    if (text) this.speak('Tip: ' + text);
  }

  speakCommentary(text) {
    if (text) this.speak(text);
  }

  speakStrategy(text) {
    if (text) this.speak(text);
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this._speaking = false;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }
}

const voiceHelper = new VoiceHelper();

export { VoiceHelper, voiceHelper };
