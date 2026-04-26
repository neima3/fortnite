export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try { this.ctx = new AudioContext(); } catch { /* audio not supported */ }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume: number = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }

  playShoot(type: string) {
    switch (type) {
      case 'pistol': this.playTone(800, 0.1, 'square', 0.08); break;
      case 'ar': this.playTone(600, 0.08, 'sawtooth', 0.06); break;
      case 'shotgun': this.playNoise(0.2, 0.15); break;
      case 'sniper': this.playTone(400, 0.3, 'sawtooth', 0.12); break;
      case 'smg': this.playTone(900, 0.05, 'square', 0.05); break;
      case 'pickaxe': this.playTone(200, 0.15, 'sawtooth', 0.1); break;
    }
  }

  playBuild() { this.playTone(300, 0.15, 'sine', 0.1); this.playTone(450, 0.1, 'sine', 0.08); }
  playHit() { this.playTone(150, 0.1, 'square', 0.1); }
  playDamage() { this.playNoise(0.3, 0.1); }
  playPickup() { this.playTone(600, 0.1, 'sine', 0.08); this.playTone(800, 0.15, 'sine', 0.06); }
  playStormWarning() { this.playTone(200, 0.5, 'sine', 0.05); }
}
