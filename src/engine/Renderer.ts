import { lerp, clamp } from '../utils/math.js';

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  falloff: number;
}

export interface WeatherConfig {
  type: 'clear' | 'rain' | 'fog' | 'storm';
  intensity: number;
  windAngle: number;
  windSpeed: number;
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

interface ScreenFlash {
  color: string;
  opacity: number;
  decay: number;
  active: boolean;
}

const BLOOM_SCALE = 0.25;
const BLOOM_THRESHOLD = 180;
const BLOOM_BLUR_PASSES = 3;
const BLOOM_INTENSITY = 0.4;

const DAY_COLORS: { time: number; r: number; g: number; b: number }[] = [
  { time: 0, r: 10, g: 10, b: 30 },
  { time: 5, r: 15, g: 15, b: 45 },
  { time: 6, r: 80, g: 50, b: 40 },
  { time: 7, r: 180, g: 140, b: 90 },
  { time: 8, r: 220, g: 200, b: 160 },
  { time: 12, r: 240, g: 235, b: 220 },
  { time: 16, r: 240, g: 220, b: 170 },
  { time: 18, r: 200, g: 120, b: 60 },
  { time: 19, r: 100, g: 40, b: 50 },
  { time: 20, r: 30, g: 20, b: 50 },
  { time: 21, r: 10, g: 10, b: 30 },
  { time: 24, r: 10, g: 10, b: 30 },
];

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private camera: any;
  private width: number;
  private height: number;

  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private postCanvas: HTMLCanvasElement;
  private postCtx: CanvasRenderingContext2D;
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;

  private lights: Light[] = [];

  private weather: WeatherConfig = {
    type: 'clear',
    intensity: 0,
    windAngle: 0,
    windSpeed: 0,
  };
  private targetWeather: WeatherConfig = {
    type: 'clear',
    intensity: 0,
    windAngle: 0,
    windSpeed: 0,
  };
  private rainDrops: RainDrop[] = [];
  private fogOpacity: number = 0;
  private lightningFlash: number = 0;
  private lightningTimer: number = 0;
  private lightningCooldown: number = 0;
  private lightningRumbleDelay: number = 0;
  private lightningActive: boolean = false;

  private timeOfDay: number = 12;
  private dayNightSpeed: number = 0.5;
  private ambientR: number = 240;
  private ambientG: number = 235;
  private ambientB: number = 220;

  private shakeX: number = 0;
  private shakeY: number = 0;
  private shakeIntensity: number = 0;
  private shakeDecay: number = 0.9;
  private shakeDuration: number = 0;

  private damageFlash: ScreenFlash = { color: 'rgba(255,0,0,1)', opacity: 0, decay: 3, active: false };
  private healFlash: ScreenFlash = { color: 'rgba(0,255,100,1)', opacity: 0, decay: 2, active: false };
  private killFlash: ScreenFlash = { color: 'rgba(255,215,0,1)', opacity: 0, decay: 1.5, active: false };

  private lowHealthPulse: number = 0;

  private vignetteGradient: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement, camera: any) {
    this.canvas = canvas;
    this.camera = camera;
    this.width = canvas.width;
    this.height = canvas.height;

    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d')!;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;
    this.postCanvas = document.createElement('canvas');
    this.postCtx = this.postCanvas.getContext('2d')!;
    this.tempCanvas = document.createElement('canvas');
    this.tempCtx = this.tempCanvas.getContext('2d')!;

    this.resizeBuffers(this.width, this.height);
  }

  private resizeBuffers(w: number, h: number): void {
    this.width = w;
    this.height = h;

    this.lightCanvas.width = w;
    this.lightCanvas.height = h;
    this.postCanvas.width = w;
    this.postCanvas.height = h;
    this.tempCanvas.width = w;
    this.tempCanvas.height = h;

    this.bloomCanvas.width = Math.max(1, Math.floor(w * BLOOM_SCALE));
    this.bloomCanvas.height = Math.max(1, Math.floor(h * BLOOM_SCALE));

    this.rebuildVignette();
  }

  private rebuildVignette(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const outerRadius = Math.sqrt(cx * cx + cy * cy);
    this.vignetteGradient = this.postCtx.createRadialGradient(cx, cy, outerRadius * 0.4, cx, cy, outerRadius);
    this.vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
    this.vignetteGradient.addColorStop(0.5, 'rgba(0,0,0,0.05)');
    this.vignetteGradient.addColorStop(0.8, 'rgba(0,0,0,0.25)');
    this.vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.7)');
  }

  beginFrame(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w !== this.width || h !== this.height) {
      this.resizeBuffers(w, h);
    }
    this.lightCtx.clearRect(0, 0, w, h);
    this.bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
    this.postCtx.clearRect(0, 0, w, h);
  }

  applyPostProcessing(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;

    this.renderBloom(ctx);
    this.renderVignette(ctx);
    this.renderChromaticAberration(ctx);
    this.renderColorGrading(ctx);
  }

  private renderBloom(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    const bw = this.bloomCanvas.width;
    const bh = this.bloomCanvas.height;

    this.bloomCtx.clearRect(0, 0, bw, bh);
    this.bloomCtx.drawImage(this.canvas, 0, 0, bw, bh);

    const imageData = this.bloomCtx.getImageData(0, 0, bw, bh);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = Math.max(data[i], data[i + 1], data[i + 2]);
      if (brightness < BLOOM_THRESHOLD) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      } else {
        const factor = (brightness - BLOOM_THRESHOLD) / (255 - BLOOM_THRESHOLD);
        data[i] = Math.min(255, data[i] * factor * 1.5);
        data[i + 1] = Math.min(255, data[i + 1] * factor * 1.5);
        data[i + 2] = Math.min(255, data[i + 2] * factor * 1.5);
      }
    }
    this.bloomCtx.putImageData(imageData, 0, 0);

    for (let pass = 0; pass < BLOOM_BLUR_PASSES; pass++) {
      const blurAmount = (pass + 1) * 4 * BLOOM_SCALE;
      this.bloomCtx.filter = `blur(${blurAmount}px)`;
      this.bloomCtx.drawImage(this.bloomCanvas, 0, 0);
      this.bloomCtx.filter = 'none';
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = BLOOM_INTENSITY;
    ctx.drawImage(this.bloomCanvas, 0, 0, w, h);
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D): void {
    if (!this.vignetteGradient) return;
    ctx.save();
    ctx.fillStyle = this.vignetteGradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  private renderChromaticAberration(ctx: CanvasRenderingContext2D): void {
    const aberrationStrength = 2;
    const w = this.width;
    const h = this.height;

    this.tempCtx.clearRect(0, 0, w, h);
    this.tempCtx.drawImage(this.canvas, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    ctx.globalAlpha = 0.3;
    ctx.drawImage(this.tempCanvas, -aberrationStrength, -aberrationStrength, w, h);

    ctx.globalAlpha = 0.3;
    ctx.drawImage(this.tempCanvas, aberrationStrength, aberrationStrength, w, h);

    ctx.restore();
  }

  private renderColorGrading(ctx: CanvasRenderingContext2D): void {
    const darkness = this.getDarknessLevel();
    const warmth = 1 - darkness;
    const coolness = darkness;

    if (warmth <= 0.01 && coolness <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.08;

    if (warmth > coolness) {
      ctx.fillStyle = `rgba(255, 200, 100, ${warmth * 0.5})`;
    } else {
      ctx.fillStyle = `rgba(50, 80, 180, ${coolness * 0.5})`;
    }
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.restore();
  }

  addLight(light: Light): void {
    this.lights.push({ ...light });
  }

  removeLight(x: number, y: number): void {
    const threshold = 10;
    this.lights = this.lights.filter(
      (l) => Math.abs(l.x - x) > threshold || Math.abs(l.y - y) > threshold
    );
  }

  clearLights(): void {
    this.lights = [];
  }

  renderLights(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;

    this.lightCtx.clearRect(0, 0, w, h);
    this.lightCtx.globalCompositeOperation = 'lighter';

    const camX = this.camera.pos?.x ?? 0;
    const camY = this.camera.pos?.y ?? 0;

    for (const light of this.lights) {
      const screenX = light.x - camX;
      const screenY = light.y - camY;

      if (
        screenX + light.radius < 0 ||
        screenX - light.radius > w ||
        screenY + light.radius < 0 ||
        screenY - light.radius > h
      ) {
        continue;
      }

      const gradient = this.lightCtx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, light.radius
      );

      const alpha = clamp(light.intensity, 0, 1);
      const innerAlpha = alpha;
      const midAlpha = alpha * Math.pow(0.5, light.falloff);
      const outerAlpha = 0;

      gradient.addColorStop(0, this.colorWithAlpha(light.color, innerAlpha));
      gradient.addColorStop(0.3, this.colorWithAlpha(light.color, midAlpha));
      gradient.addColorStop(1, this.colorWithAlpha(light.color, outerAlpha));

      this.lightCtx.fillStyle = gradient;
      this.lightCtx.beginPath();
      this.lightCtx.arc(screenX, screenY, light.radius, 0, Math.PI * 2);
      this.lightCtx.fill();
    }

    this.lightCtx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.lightCanvas, 0, 0);
    ctx.restore();
  }

  private colorWithAlpha(hexOrRgba: string, alpha: number): string {
    const parsed = this.parseColor(hexOrRgba);
    if (!parsed) return `rgba(255,255,255,${alpha})`;
    return `rgba(${parsed.r},${parsed.g},${parsed.b},${alpha})`;
  }

  private parseColor(color: string): { r: number; g: number; b: number } | null {
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
        };
      }
    }
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
    }
    return null;
  }

  setWeather(config: WeatherConfig): void {
    this.targetWeather = { ...config };
  }

  updateWeather(dt: number): void {
    const transitionSpeed = 0.8 * dt;
    this.weather.intensity = lerp(this.weather.intensity, this.targetWeather.intensity, transitionSpeed);
    this.weather.windAngle = lerpAngle(this.weather.windAngle, this.targetWeather.windAngle, transitionSpeed);
    this.weather.windSpeed = lerp(this.weather.windSpeed, this.targetWeather.windSpeed, transitionSpeed);
    this.weather.type = this.targetWeather.type;

    if (this.weather.type === 'rain' || this.weather.type === 'storm') {
      this.updateRainDrops(dt);
    } else {
      if (this.rainDrops.length > 0) {
        this.rainDrops = this.rainDrops.filter((d) => {
          d.opacity -= dt * 2;
          return d.opacity > 0;
        });
      }
    }

    if (this.weather.type === 'storm') {
      this.updateLightning(dt);
    } else {
      this.lightningFlash = lerp(this.lightningFlash, 0, dt * 5);
    }

    const targetFog = (this.weather.type === 'fog') ? this.weather.intensity * 0.35 : 0;
    this.fogOpacity = lerp(this.fogOpacity, targetFog, dt * 0.5);
  }

  private updateRainDrops(dt: number): void {
    const targetCount = Math.floor(this.weather.intensity * 400);
    const screenArea = this.width * this.height;
    const densityFactor = clamp(screenArea / (1920 * 1080), 0.5, 2);
    const adjustedTarget = Math.floor(targetCount * densityFactor);

    while (this.rainDrops.length < adjustedTarget) {
      this.rainDrops.push(this.createRainDrop());
    }
    while (this.rainDrops.length > adjustedTarget) {
      this.rainDrops.pop();
    }

    const windX = Math.cos(this.weather.windAngle) * this.weather.windSpeed;
    const windY = Math.sin(this.weather.windAngle) * this.weather.windSpeed;

    for (const drop of this.rainDrops) {
      drop.y += drop.speed * dt * 60;
      drop.x += windX * dt * 60;

      drop.opacity = clamp(drop.opacity, 0, 1);

      if (drop.y > this.height + drop.length) {
        drop.y = -drop.length - Math.random() * 100;
        drop.x = Math.random() * (this.width + 200) - 100;
      }
      if (drop.x > this.width + 100) drop.x = -100;
      if (drop.x < -100) drop.x = this.width + 100;
    }
  }

  private createRainDrop(): RainDrop {
    return {
      x: Math.random() * (this.width + 200) - 100,
      y: Math.random() * this.height - this.height,
      speed: 8 + Math.random() * 12,
      length: 10 + Math.random() * 25,
      opacity: 0.15 + Math.random() * 0.35,
    };
  }

  private updateLightning(dt: number): void {
    this.lightningCooldown -= dt;

    if (this.lightningActive) {
      this.lightningRumbleDelay -= dt;
      if (this.lightningRumbleDelay <= 0) {
        this.shakeIntensity = 3 + Math.random() * 5;
        this.shakeDuration = 0.3 + Math.random() * 0.2;
        this.lightningActive = false;
      }
    }

    if (this.lightningTimer <= 0 && this.lightningCooldown <= 0) {
      if (Math.random() < 0.02 * this.weather.intensity) {
        this.lightningFlash = 0.8 + Math.random() * 0.2;
        this.lightningTimer = 0.05 + Math.random() * 0.1;
        this.lightningRumbleDelay = 0.3 + Math.random() * 1.5;
        this.lightningActive = true;
        this.lightningCooldown = 3 + Math.random() * 8;
      }
    } else {
      this.lightningTimer -= dt;
    }

    if (this.lightningTimer > 0) {
      this.lightningFlash *= 0.85;
    } else {
      this.lightningFlash = lerp(this.lightningFlash, 0, dt * 8);
    }
  }

  renderWeather(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    width: number,
    height: number
  ): void {
    if (this.weather.type === 'rain' || this.weather.type === 'storm') {
      this.renderRain(ctx);
    }

    if (this.fogOpacity > 0.005) {
      this.renderFog(ctx, cameraX, cameraY, width, height);
    }

    if (this.lightningFlash > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.lightningFlash;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }

  private renderRain(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const windAngle = this.weather.windAngle + Math.PI * 0.5;
    const windInfluence = this.weather.windSpeed * 0.3;

    for (const drop of this.rainDrops) {
      const endX = drop.x + Math.cos(windAngle) * windInfluence * drop.length;
      const endY = drop.y + drop.length;

      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = `rgba(180, 200, 230, ${drop.opacity * this.weather.intensity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderFog(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    width: number,
    height: number
  ): void {
    ctx.save();

    const fogColor = `rgba(180, 190, 200, ${this.fogOpacity})`;
    ctx.fillStyle = fogColor;
    ctx.fillRect(0, 0, this.width, this.height);

    const patchCount = 6;
    const time = performance.now() * 0.0001;
    for (let i = 0; i < patchCount; i++) {
      const seed = i * 137.5;
      const baseX = ((Math.sin(seed + time * (0.5 + i * 0.1)) * 0.5 + 0.5) * this.width * 1.5) - this.width * 0.25;
      const baseY = ((Math.cos(seed * 0.7 + time * (0.3 + i * 0.05)) * 0.5 + 0.5) * this.height * 1.5) - this.height * 0.25;
      const radius = 200 + Math.sin(seed * 1.3) * 100;

      const gradient = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, radius);
      gradient.addColorStop(0, `rgba(200, 210, 220, ${this.fogOpacity * 0.6})`);
      gradient.addColorStop(0.5, `rgba(200, 210, 220, ${this.fogOpacity * 0.3})`);
      gradient.addColorStop(1, 'rgba(200, 210, 220, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(baseX - radius, baseY - radius, radius * 2, radius * 2);
    }

    ctx.restore();
  }

  updateDayNight(dt: number): void {
    this.timeOfDay += this.dayNightSpeed * dt;
    if (this.timeOfDay >= 24) this.timeOfDay -= 24;
    if (this.timeOfDay < 0) this.timeOfDay += 24;

    let prevColor = DAY_COLORS[0];
    let nextColor = DAY_COLORS[1];

    for (let i = 0; i < DAY_COLORS.length - 1; i++) {
      if (this.timeOfDay >= DAY_COLORS[i].time && this.timeOfDay < DAY_COLORS[i + 1].time) {
        prevColor = DAY_COLORS[i];
        nextColor = DAY_COLORS[i + 1];
        break;
      }
    }

    const t = clamp(
      (this.timeOfDay - prevColor.time) / (nextColor.time - prevColor.time),
      0,
      1
    );

    const smoothT = t * t * (3 - 2 * t);

    this.ambientR = lerp(prevColor.r, nextColor.r, smoothT);
    this.ambientG = lerp(prevColor.g, nextColor.g, smoothT);
    this.ambientB = lerp(prevColor.b, nextColor.b, smoothT);
  }

  getAmbientColor(): string {
    return `rgb(${Math.round(this.ambientR)}, ${Math.round(this.ambientG)}, ${Math.round(this.ambientB)})`;
  }

  getDarknessLevel(): number {
    if (this.timeOfDay >= 8 && this.timeOfDay <= 18) {
      const noonDist = Math.abs(this.timeOfDay - 13) / 5;
      return lerp(0, 0.15, noonDist);
    }

    if (this.timeOfDay >= 21 || this.timeOfDay <= 5) {
      return 1;
    }

    if (this.timeOfDay > 18 && this.timeOfDay < 21) {
      return clamp((this.timeOfDay - 18) / 3, 0, 1);
    }

    if (this.timeOfDay > 5 && this.timeOfDay < 8) {
      return clamp(1 - (this.timeOfDay - 5) / 3, 0, 1);
    }

    return 0;
  }

  setDayNightSpeed(speed: number): void {
    this.dayNightSpeed = speed;
  }

  getTimeOfDay(): number {
    return this.timeOfDay;
  }

  getWeatherConfig(): WeatherConfig {
    return { ...this.weather };
  }

  triggerDamageFlash(): void {
    this.damageFlash.opacity = 0.6;
    this.damageFlash.active = true;
  }

  triggerHealFlash(): void {
    this.healFlash.opacity = 0.4;
    this.healFlash.active = true;
  }

  triggerKillFlash(): void {
    this.killFlash.opacity = 0.5;
    this.killFlash.active = true;
  }

  triggerScreenShake(intensity: number, duration: number = 0.3): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }

  getScreenShake(): { x: number; y: number } {
    return { x: this.shakeX, y: this.shakeY };
  }

  renderScreenEffects(
    ctx: CanvasRenderingContext2D,
    playerHealth: number,
    maxHealth: number
  ): void {
    const dt = 1 / 60;

    this.updateShake(dt);
    this.applyShake(ctx);

    this.renderFlash(ctx, this.damageFlash, dt);
    this.renderFlash(ctx, this.healFlash, dt);
    this.renderFlash(ctx, this.killFlash, dt);

    const healthRatio = playerHealth / maxHealth;
    if (healthRatio < 0.25 && playerHealth > 0) {
      this.renderLowHealthVignette(ctx, healthRatio);
    } else {
      this.lowHealthPulse = 0;
    }

    this.renderDarknessOverlay(ctx);

    if (this.shakeDuration > 0 || this.shakeIntensity > 0.1) {
      ctx.restore();
    }
  }

  private updateShake(dt: number): void {
    if (this.shakeDuration > 0) {
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeDuration -= dt;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeIntensity = 0;
    }
  }

  private applyShake(ctx: CanvasRenderingContext2D): void {
    if (this.shakeDuration > 0 || this.shakeIntensity > 0.1) {
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
    }
  }

  private renderFlash(ctx: CanvasRenderingContext2D, flash: ScreenFlash, dt: number): void {
    if (!flash.active || flash.opacity <= 0.001) {
      flash.active = false;
      return;
    }

    ctx.save();
    ctx.globalAlpha = flash.opacity;
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    flash.opacity -= flash.decay * dt;
    if (flash.opacity <= 0) {
      flash.opacity = 0;
      flash.active = false;
    }
  }

  private renderLowHealthVignette(ctx: CanvasRenderingContext2D, healthRatio: number): void {
    this.lowHealthPulse += 0.06;

    const pulseValue = Math.sin(this.lowHealthPulse) * 0.5 + 0.5;
    const urgency = 1 - healthRatio / 0.25;
    const alpha = (0.15 + pulseValue * 0.25) * urgency;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const outerRadius = Math.sqrt(cx * cx + cy * cy);

    const gradient = ctx.createRadialGradient(cx, cy, outerRadius * 0.3, cx, cy, outerRadius);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(0.5, `rgba(255, 0, 0, ${alpha * 0.2})`);
    gradient.addColorStop(0.8, `rgba(180, 0, 0, ${alpha * 0.5})`);
    gradient.addColorStop(1, `rgba(120, 0, 0, ${alpha})`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  private renderDarknessOverlay(ctx: CanvasRenderingContext2D): void {
    const darkness = this.getDarknessLevel();
    if (darkness < 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${Math.round(255 - darkness * 200)}, ${Math.round(255 - darkness * 200)}, ${Math.round(255 - darkness * 180)})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  renderFlashlight(
    ctx: CanvasRenderingContext2D,
    playerX: number,
    playerY: number,
    angle: number,
    coneAngle: number = 0.6,
    range: number = 400,
    intensity: number = 0.7
  ): void {
    const camX = this.camera.pos?.x ?? 0;
    const camY = this.camera.pos?.y ?? 0;
    const sx = playerX - camX;
    const sy = playerY - camY;

    const segments = 24;
    const startAngle = angle - coneAngle;
    const endAngle = angle + coneAngle;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = lerp(startAngle, endAngle, t);
      const edgeFade = 1 - Math.pow(Math.abs(t - 0.5) * 2, 2);
      const r = range * (0.8 + edgeFade * 0.2);
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();

    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, range);
    gradient.addColorStop(0, `rgba(255, 240, 200, ${intensity})`);
    gradient.addColorStop(0.3, `rgba(255, 230, 180, ${intensity * 0.5})`);
    gradient.addColorStop(0.7, `rgba(255, 220, 160, ${intensity * 0.15})`);
    gradient.addColorStop(1, 'rgba(255, 220, 160, 0)');

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
