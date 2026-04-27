export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;
  private lastFootstepTime: number = 0;
  private cameraPos: { x: number; y: number } = { x: 0, y: 0 };
  private stormIntensity: number = 0;
  private ambientNodes: OscillatorNode[] = [];
  private ambientGain: GainNode | null = null;
  private ambientPlaying: boolean = false;

  constructor() {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientGain.connect(this.sfxGain);
    } catch {}
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.masterGain) this.masterGain.gain.value = vol;
  }

  setCameraPosition(x: number, y: number) {
    this.cameraPos.x = x;
    this.cameraPos.y = y;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  private calcSpatial(worldX: number, worldY: number, maxDist: number = 1500): { gain: number; pan: number } {
    if (!this.cameraPos) return { gain: 1, pan: 0 };
    const dx = worldX - this.cameraPos.x;
    const dy = worldY - this.cameraPos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const gain = Math.max(0, 1 - d / maxDist);
    const pan = Math.max(-1, Math.min(1, dx / (maxDist * 0.5)));
    return { gain: gain * gain, pan };
  }

  private createPan(gainNode: GainNode, pan: number): StereoPannerNode | null {
    if (!this.ctx) return null;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(gainNode);
    return panner;
  }

  private playSpatialTone(freq: number, duration: number, type: OscillatorType, vol: number, worldX: number, worldY: number) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const spatial = this.calcSpatial(worldX, worldY);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * spatial.gain, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    const panner = this.createPan(gain, spatial.pan);
    const targetNode = panner || gain;
    if (!panner) gain.connect(this.sfxGain);
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.connect(targetNode);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playSpatialNoise(duration: number, vol: number, worldX: number, worldY: number, filterFreq?: number) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const spatial = this.calcSpatial(worldX, worldY);
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * spatial.gain, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    const panner = this.createPan(gain, spatial.pan);
    const targetNode = panner || gain;
    if (!panner) gain.connect(this.sfxGain);
    if (filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      source.connect(filter);
      filter.connect(targetNode);
    } else {
      source.connect(targetNode);
    }
    source.start();
  }

  private playUIOsc(freq: number, duration: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playUINoise(duration: number, vol: number) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  playShoot(type: string, worldX?: number, worldY?: number) {
    const x = worldX ?? this.cameraPos.x;
    const y = worldY ?? this.cameraPos.y;
    switch (type) {
      case 'pistol':
        this.playSpatialTone(900, 0.08, 'square', 0.1, x, y);
        this.playSpatialTone(1200, 0.04, 'sine', 0.06, x, y);
        this.playSpatialNoise(0.06, 0.08, x, y, 3000);
        break;
      case 'ar':
        this.playSpatialTone(700 + Math.random() * 100, 0.06, 'sawtooth', 0.07, x, y);
        this.playSpatialTone(1400, 0.03, 'square', 0.04, x, y);
        this.playSpatialNoise(0.04, 0.06, x, y, 4000);
        break;
      case 'shotgun':
        this.playSpatialNoise(0.25, 0.18, x, y, 1500);
        this.playSpatialTone(200, 0.15, 'sine', 0.12, x, y);
        setTimeout(() => {
          this.playSpatialTone(800, 0.05, 'square', 0.06, x, y);
          this.playSpatialTone(600, 0.08, 'triangle', 0.04, x, y);
        }, 200);
        break;
      case 'sniper':
        this.playSpatialTone(500, 0.35, 'sawtooth', 0.14, x, y);
        this.playSpatialTone(1000, 0.2, 'square', 0.08, x, y);
        this.playSpatialNoise(0.4, 0.12, x, y, 2000);
        setTimeout(() => {
          this.playSpatialTone(300, 0.3, 'sine', 0.05, x, y);
        }, 100);
        break;
      case 'smg':
        this.playSpatialTone(1000 + Math.random() * 200, 0.04, 'square', 0.06, x, y);
        this.playSpatialNoise(0.03, 0.05, x, y, 5000);
        break;
      case 'pickaxe':
        this.playSpatialTone(250, 0.1, 'sawtooth', 0.1, x, y);
        this.playSpatialTone(800, 0.05, 'sine', 0.06, x, y);
        break;
    }
  }

  playImpact(type: 'flesh' | 'metal' | 'wood' | 'ground', worldX: number, worldY: number) {
    switch (type) {
      case 'flesh':
        this.playSpatialTone(200, 0.08, 'sine', 0.08, worldX, worldY);
        this.playSpatialNoise(0.06, 0.06, worldX, worldY, 2000);
        break;
      case 'metal':
        this.playSpatialTone(2000, 0.15, 'sine', 0.1, worldX, worldY);
        this.playSpatialTone(3000, 0.1, 'sine', 0.06, worldX, worldY);
        break;
      case 'wood':
        this.playSpatialTone(400, 0.1, 'triangle', 0.08, worldX, worldY);
        this.playSpatialNoise(0.08, 0.06, worldX, worldY, 1500);
        break;
      case 'ground':
        this.playSpatialNoise(0.1, 0.06, worldX, worldY, 1000);
        this.playSpatialTone(150, 0.06, 'sine', 0.04, worldX, worldY);
        break;
    }
  }

  playExplosion(worldX: number, worldY: number) {
    this.playSpatialNoise(0.5, 0.2, worldX, worldY, 800);
    this.playSpatialTone(80, 0.4, 'sine', 0.15, worldX, worldY);
    this.playSpatialTone(120, 0.3, 'sawtooth', 0.1, worldX, worldY);
    setTimeout(() => {
      this.playSpatialNoise(0.3, 0.08, worldX, worldY, 500);
      this.playSpatialTone(60, 0.5, 'sine', 0.06, worldX, worldY);
    }, 150);
  }

  playBuild(worldX?: number, worldY?: number) {
    const x = worldX ?? this.cameraPos.x;
    const y = worldY ?? this.cameraPos.y;
    this.playSpatialTone(300, 0.12, 'sine', 0.08, x, y);
    this.playSpatialTone(450, 0.08, 'sine', 0.06, x, y);
    this.playSpatialNoise(0.06, 0.04, x, y, 2000);
  }

  playHit() { this.playUIOsc(800, 0.05, 'square', 0.08); }
  playDamage() { this.playUINoise(0.2, 0.08); this.playUIOsc(300, 0.1, 'sawtooth', 0.06); }

  playPickup() {
    this.playUIOsc(600, 0.08, 'sine', 0.07);
    setTimeout(() => this.playUIOsc(900, 0.12, 'sine', 0.06), 80);
  }

  playHeal() {
    this.playUIOsc(400, 0.2, 'sine', 0.06);
    this.playUIOsc(600, 0.3, 'sine', 0.04);
    setTimeout(() => this.playUIOsc(800, 0.2, 'sine', 0.05), 100);
  }

  playShield() {
    this.playUIOsc(500, 0.1, 'square', 0.05);
    this.playUIOsc(700, 0.15, 'sine', 0.06);
    this.playUINoise(0.1, 0.04);
  }

  playElimination() {
    this.playUIOsc(800, 0.1, 'sine', 0.08);
    this.playUIOsc(1000, 0.15, 'sine', 0.06);
    setTimeout(() => {
      this.playUIOsc(1200, 0.2, 'sine', 0.07);
    }, 100);
  }

  playVictory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.playUIOsc(f, 0.3, 'sine', 0.1), i * 150);
    });
  }

  playCountdown() { this.playUIOsc(880, 0.1, 'square', 0.08); }

  playFootstep(worldX: number, worldY: number, isSprinting: boolean) {
    const now = performance.now() / 1000;
    const cadence = isSprinting ? 0.22 : 0.35;
    if (now - this.lastFootstepTime < cadence) return;
    this.lastFootstepTime = now;
    const freq = 100 + Math.random() * 80;
    this.playSpatialTone(freq, 0.06, 'triangle', 0.04, worldX, worldY);
    this.playSpatialNoise(0.04, 0.03, worldX, worldY, 1500);
  }

  playStormWarning() { this.playUIOsc(200, 0.5, 'sine', 0.04); }

  startAmbient(biome?: string) {
    if (this.ambientPlaying || !this.ctx || !this.ambientGain) return;
    this.ambientPlaying = true;
    this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 2);

    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = biome === 'forest' ? 800 : biome === 'water' ? 1200 : 500;
    source.connect(filter);
    filter.connect(this.ambientGain);
    source.start();
  }

  stopAmbient() {
    this.ambientPlaying = false;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
    }
  }

  setStormIntensity(intensity: number) {
    this.stormIntensity = intensity;
    if (this.ambientGain && this.ctx && this.ambientPlaying) {
      const targetVol = 0.03 + intensity * 0.08;
      this.ambientGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 0.5);
    }
  }
}
