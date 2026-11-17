// Frostline — synthesized sound. No audio files: every sound is made with the
// Web Audio API, so the game stays offline and self-contained.
// Engine hum follows speed, wind howls in a blizzard, sirens wail at wanted 2+,
// and short blips mark pickups, punches and mission wins.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
  }

  // Must be called from a user gesture (key or click) at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    // Engine: a sawtooth through a low-pass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();

    // Wind: looped noise through a low-pass, louder in a blizzard.
    const noiseLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 320;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.015;
    noise.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    noise.start();

    // Siren: a square wave that alternates between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.ctx.destination.gain = this.muted ? 0 : 1;
    return this.muted;
  }

  // Called every frame: speed in px/s, wanted 0-5, blizzard 0-1, inCar bool.
  update(speed, wanted, blizzard, inCar) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const target = inCar ? 0.05 + Math.min(0.06, Math.abs(speed) / 6000) : 0;
    this.engineGain.gain.setTargetAtTime(target, now, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 0.16, now, 0.08);
    this.windGain.gain.setTargetAtTime(0.012 + blizzard * 0.075, now, 0.2);
    if (wanted >= 2) {
      this.sirenGain.gain.setTargetAtTime(0.02, now, 0.1);
      this.sirenPhase += 0.016;
      const tone = Math.sin(this.sirenPhase * 3.2) > 0 ? 760 : 950;
      this.sirenOsc.frequency.setTargetAtTime(tone, now, 0.03);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
    }
  }

  blip(freq, dur = 0.09, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  thud() {
    this.blip(70, 0.16, 'triangle', 0.22);
  }

  crash() {
    this.blip(48, 0.25, 'sawtooth', 0.2);
  }

  // Little rising arpeggio for a finished mission.
  jingle() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.16, 'triangle', 0.14), i * 110);
    });
  }

  // Two-note fail sting for busted / wasted.
  sting() {
    if (!this.ctx || this.muted) return;
    setTimeout(() => this.blip(220, 0.3, 'sawtooth', 0.12), 0);
    setTimeout(() => this.blip(165, 0.45, 'sawtooth', 0.12), 220);
  }
}
