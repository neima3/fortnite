export interface ReplayFrame {
  time: number;
  playerPos: { x: number; y: number };
  playerHealth: number;
  playerRotation: number;
  bots: Array<{ id: string; x: number; y: number; health: number; alive: boolean }>;
  projectiles: Array<{ x: number; y: number }>;
  events: string[];
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];
const CAMERA_LERP = 0.08;
const PLAYER_RADIUS = 12;
const BOT_RADIUS = 10;
const PROJECTILE_RADIUS = 3;
const HEALTH_BAR_WIDTH = 24;
const HEALTH_BAR_HEIGHT = 4;
const TIMELINE_HEIGHT = 20;
const TIMELINE_WIDTH_RATIO = 0.8;
const SKIP_SECONDS = 5;
const INTERP_MAX_DELTA = 0.2;

export class ReplayPlaybackSystem {
  private frames: ReplayFrame[];
  private currentIndex: number;
  private playing: boolean;
  private speed: number;
  private elapsed: number;
  private cameraX: number;
  private cameraY: number;
  private cameraW: number;
  private cameraH: number;
  private keydownHandler: (e: KeyboardEvent) => void;
  private attachedElement: HTMLElement | null;
  private timelineClickHandler: ((e: MouseEvent) => void) | null;
  private canvasRef: HTMLCanvasElement | null;

  constructor() {
    this.frames = [];
    this.currentIndex = 0;
    this.playing = false;
    this.speed = 1;
    this.elapsed = 0;
    this.cameraX = 0;
    this.cameraY = 0;
    this.cameraW = 0;
    this.cameraH = 0;
    this.attachedElement = null;
    this.timelineClickHandler = null;
    this.canvasRef = null;

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === "ArrowRight") {
        this.skip(SKIP_SECONDS);
      } else if (e.code === "ArrowLeft") {
        this.skip(-SKIP_SECONDS);
      }
    };
  }

  loadFrames(frames: ReplayFrame[]): void {
    this.frames = frames.sort((a, b) => a.time - b.time);
    this.currentIndex = 0;
    this.elapsed = 0;
    this.playing = false;
    if (this.frames.length > 0) {
      this.cameraX = this.frames[0].playerPos.x;
      this.cameraY = this.frames[0].playerPos.y;
    }
  }

  play(): void {
    if (this.frames.length === 0) return;
    if (this.isFinished()) {
      this.elapsed = 0;
      this.currentIndex = 0;
    }
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  togglePlay(): void {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  setSpeed(speed: number): void {
    if (SPEED_OPTIONS.includes(speed)) {
      this.speed = speed;
    }
  }

  cycleSpeed(): number {
    const idx = SPEED_OPTIONS.indexOf(this.speed);
    const next = (idx + 1) % SPEED_OPTIONS.length;
    this.speed = SPEED_OPTIONS[next];
    return this.speed;
  }

  skip(seconds: number): void {
    if (this.frames.length === 0) return;
    this.elapsed = Math.max(0, Math.min(this.getDuration(), this.elapsed + seconds));
    this.currentIndex = this.findFrameIndex(this.elapsed);
  }

  seekTo(progress: number): void {
    if (this.frames.length === 0) return;
    const clamped = Math.max(0, Math.min(1, progress));
    this.elapsed = clamped * this.getDuration();
    this.currentIndex = this.findFrameIndex(this.elapsed);
  }

  update(dt: number): void {
    if (!this.playing || this.frames.length === 0) return;

    this.elapsed += dt * this.speed;

    const duration = this.getDuration();
    if (this.elapsed >= duration) {
      this.elapsed = duration;
      this.playing = false;
      this.currentIndex = this.frames.length - 1;
      return;
    }

    this.currentIndex = this.findFrameIndex(this.elapsed);

    const frame = this.getInterpolatedFrame();
    const targetX = frame.playerPos.x;
    const targetY = frame.playerPos.y;
    this.cameraX += (targetX - this.cameraX) * CAMERA_LERP;
    this.cameraY += (targetY - this.cameraY) * CAMERA_LERP;
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    this.cameraW = canvasWidth;
    this.cameraH = canvasHeight;

    ctx.save();

    ctx.fillStyle = "rgba(0,0,30,0.3)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (this.frames.length === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No replay data loaded", canvasWidth / 2, canvasHeight / 2);
      ctx.restore();
      return;
    }

    const frame = this.getInterpolatedFrame();

    const offsetX = canvasWidth / 2 - this.cameraX;
    const offsetY = canvasHeight / 2 - this.cameraY;

    ctx.translate(offsetX, offsetY);

    this.renderProjectiles(ctx, frame);
    this.renderBots(ctx, frame);
    this.renderPlayer(ctx, frame);

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.renderWatermark(ctx, canvasWidth);
    this.renderHealthOverlay(ctx, frame);
    this.renderTimeCounter(ctx, canvasWidth);
    this.renderTimeline(ctx, canvasWidth, canvasHeight);

    ctx.restore();
  }

  renderControls(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    const y = canvasHeight - 50;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, y - 10, canvasWidth, 60);

    const playIcon = this.playing ? "❚❚" : "▶";
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(playIcon, 20, y + 12);

    ctx.font = "14px monospace";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`Speed: ${this.speed}x`, 60, y + 12);

    ctx.fillText("[0.25x] [0.5x] [1x] [2x] [4x]", 160, y + 12);

    const timeStr = this.formatTime(this.getCurrentTime()) + " / " + this.formatTime(this.getDuration());
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(timeStr, canvasWidth - 20, y + 12);

    ctx.restore();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getSpeed(): number {
    return this.speed;
  }

  getProgress(): number {
    if (this.frames.length === 0) return 0;
    const duration = this.getDuration();
    if (duration === 0) return 0;
    return this.elapsed / duration;
  }

  getDuration(): number {
    if (this.frames.length === 0) return 0;
    return this.frames[this.frames.length - 1].time - this.frames[0].time;
  }

  getCurrentTime(): number {
    if (this.frames.length === 0) return 0;
    return this.elapsed;
  }

  isFinished(): boolean {
    if (this.frames.length === 0) return true;
    return this.elapsed >= this.getDuration();
  }

  getSpeedOptions(): number[] {
    return [...SPEED_OPTIONS];
  }

  cleanup(): void {
    this.detachKeyboard();
    this.detachTimelineClick();
    this.frames = [];
    this.playing = false;
    this.elapsed = 0;
    this.currentIndex = 0;
  }

  attachKeyboard(element: HTMLElement): void {
    this.detachKeyboard();
    this.attachedElement = element;
    element.addEventListener("keydown", this.keydownHandler);
  }

  detachKeyboard(): void {
    if (this.attachedElement) {
      this.attachedElement.removeEventListener("keydown", this.keydownHandler);
      this.attachedElement = null;
    }
  }

  attachTimelineClick(canvas: HTMLCanvasElement): void {
    this.detachTimelineClick();
    this.canvasRef = canvas;
    this.timelineClickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const canvasW = canvas.width;
      const canvasH = canvas.height;

      const tlWidth = canvasW * TIMELINE_WIDTH_RATIO;
      const tlX = (canvasW - tlWidth) / 2;
      const tlY = canvasH - TIMELINE_HEIGHT - 8;

      if (y >= tlY && y <= tlY + TIMELINE_HEIGHT && x >= tlX && x <= tlX + tlWidth) {
        const progress = (x - tlX) / tlWidth;
        this.seekTo(progress);
      }
    };
    canvas.addEventListener("click", this.timelineClickHandler);
  }

  detachTimelineClick(): void {
    if (this.canvasRef && this.timelineClickHandler) {
      this.canvasRef.removeEventListener("click", this.timelineClickHandler);
      this.timelineClickHandler = null;
      this.canvasRef = null;
    }
  }

  private findFrameIndex(time: number): number {
    let low = 0;
    let high = this.frames.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (this.frames[mid].time <= time) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return low;
  }

  private getInterpolatedFrame(): ReplayFrame {
    const idx = this.currentIndex;

    if (idx >= this.frames.length - 1) {
      return { ...this.frames[this.frames.length - 1] };
    }

    const a = this.frames[idx];
    const b = this.frames[idx + 1];

    const timeDelta = b.time - a.time;
    const t = timeDelta > 0 ? Math.min(1, (this.elapsed - a.time) / timeDelta) : 0;

    const interpPos = {
      x: a.playerPos.x + (b.playerPos.x - a.playerPos.x) * t,
      y: a.playerPos.y + (b.playerPos.y - a.playerPos.y) * t,
    };

    const interpHealth = a.playerHealth + (b.playerHealth - a.playerHealth) * t;

    let rotationDelta = b.playerRotation - a.playerRotation;
    while (rotationDelta > Math.PI) rotationDelta -= 2 * Math.PI;
    while (rotationDelta < -Math.PI) rotationDelta += 2 * Math.PI;
    const interpRotation = a.playerRotation + rotationDelta * t;

    const interpBots = this.interpolateBots(a.bots, b.bots, t);

    const interpProjectiles = t < 0.5
      ? a.projectiles.map(p => ({ x: p.x, y: p.y }))
      : b.projectiles.map(p => ({ x: p.x, y: p.y }));

    const events = t < 0.5 ? [...a.events] : [...b.events];

    return {
      time: this.elapsed,
      playerPos: interpPos,
      playerHealth: interpHealth,
      playerRotation: interpRotation,
      bots: interpBots,
      projectiles: interpProjectiles,
      events,
    };
  }

  private interpolateBots(
    aBots: Array<{ id: string; x: number; y: number; health: number; alive: boolean }>,
    bBots: Array<{ id: string; x: number; y: number; health: number; alive: boolean }>,
    t: number
  ): Array<{ id: string; x: number; y: number; health: number; alive: boolean }> {
    const bMap = new Map(bBots.map(b => [b.id, b]));
    const result: Array<{ id: string; x: number; y: number; health: number; alive: boolean }> = [];

    for (const aBot of aBots) {
      const bBot = bMap.get(aBot.id);
      if (bBot) {
        const alive = t < 0.5 ? aBot.alive : bBot.alive;
        result.push({
          id: aBot.id,
          x: aBot.x + (bBot.x - aBot.x) * t,
          y: aBot.y + (bBot.y - aBot.y) * t,
          health: aBot.health + (bBot.health - aBot.health) * t,
          alive,
        });
      } else {
        result.push({ ...aBot });
      }
    }

    const aIds = new Set(aBots.map(b => b.id));
    for (const bBot of bBots) {
      if (!aIds.has(bBot.id)) {
        result.push({ ...bBot });
      }
    }

    return result;
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, frame: ReplayFrame): void {
    const { x, y } = frame.playerPos;

    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#4488ff";
    ctx.fill();
    ctx.strokeStyle = "#6699ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.rotate(frame.playerRotation);
    ctx.beginPath();
    ctx.moveTo(PLAYER_RADIUS + 6, 0);
    ctx.lineTo(PLAYER_RADIUS - 2, -5);
    ctx.lineTo(PLAYER_RADIUS - 2, 5);
    ctx.closePath();
    ctx.fillStyle = "#aaccff";
    ctx.fill();

    ctx.restore();
  }

  private renderBots(ctx: CanvasRenderingContext2D, frame: ReplayFrame): void {
    for (const bot of frame.bots) {
      ctx.save();
      ctx.translate(bot.x, bot.y);

      if (!bot.alive) {
        ctx.globalAlpha = 0.3;
      }

      ctx.beginPath();
      ctx.arc(0, 0, BOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = bot.alive ? "#ff4444" : "#884444";
      ctx.fill();
      ctx.strokeStyle = "#ff6666";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (bot.alive && bot.health < 100) {
        const barX = -HEALTH_BAR_WIDTH / 2;
        const barY = -BOT_RADIUS - 8;

        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(barX, barY, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);

        const healthPct = Math.max(0, bot.health / 100);
        const hpColor = healthPct > 0.5 ? "#44ff44" : healthPct > 0.25 ? "#ffaa00" : "#ff2222";
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, HEALTH_BAR_WIDTH * healthPct, HEALTH_BAR_HEIGHT);
      }

      ctx.restore();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D, frame: ReplayFrame): void {
    ctx.fillStyle = "#ffff44";
    for (const proj of frame.projectiles) {
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderWatermark(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    ctx.save();
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.textAlign = "left";
    ctx.fillText("REPLAY", 16, 36);
    ctx.restore();
  }

  private renderHealthOverlay(ctx: CanvasRenderingContext2D, frame: ReplayFrame): void {
    ctx.save();
    const barWidth = 200;
    const barHeight = 16;
    const x = 16;
    const y = 60;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, 60, barWidth, barHeight);

    const healthPct = Math.max(0, Math.min(1, frame.playerHealth / 100));
    let hpColor: string;
    if (healthPct > 0.6) {
      hpColor = "#44ff44";
    } else if (healthPct > 0.3) {
      hpColor = "#ffaa00";
    } else {
      hpColor = "#ff2222";
    }
    ctx.fillStyle = hpColor;
    ctx.fillRect(x, 60, barWidth * healthPct, barHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, 60, barWidth, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(frame.playerHealth)} HP`, x + barWidth / 2, 60 + barHeight - 3);

    ctx.restore();
  }

  private renderTimeCounter(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    ctx.save();
    ctx.font = "16px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "right";
    const timeStr = this.formatTime(this.getCurrentTime()) + " / " + this.formatTime(this.getDuration());
    ctx.fillText(timeStr, canvasWidth - 16, 30);
    ctx.restore();
  }

  private renderTimeline(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    const tlWidth = canvasWidth * TIMELINE_WIDTH_RATIO;
    const tlX = (canvasWidth - tlWidth) / 2;
    const tlY = canvasHeight - TIMELINE_HEIGHT - 8;
    const progress = this.getProgress();

    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(tlX, tlY, tlWidth, TIMELINE_HEIGHT);

    ctx.fillStyle = "#4488ff";
    ctx.fillRect(tlX, tlY, tlWidth * progress, TIMELINE_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tlX, tlY, tlWidth, TIMELINE_HEIGHT);

    const handleX = tlX + tlWidth * progress;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(handleX - 3, tlY - 3, 6, TIMELINE_HEIGHT + 6);

    this.renderEventMarkers(ctx, tlX, tlY, tlWidth);

    ctx.restore();
  }

  private renderEventMarkers(ctx: CanvasRenderingContext2D, tlX: number, tlY: number, tlWidth: number): void {
    if (this.frames.length === 0) return;
    const startTime = this.frames[0].time;
    const duration = this.getDuration();
    if (duration === 0) return;

    for (const frame of this.frames) {
      for (const event of frame.events) {
        const normalizedTime = (frame.time - startTime) / duration;
        const markerX = tlX + tlWidth * normalizedTime;

        let color = "#ffffff";
        if (event.toLowerCase().includes("kill")) {
          color = "#ff4444";
        } else if (event.toLowerCase().includes("death")) {
          color = "#ff0000";
        } else if (event.toLowerCase().includes("storm")) {
          color = "#aa44ff";
        } else if (event.toLowerCase().includes("pickup") || event.toLowerCase().includes("loot")) {
          color = "#44ff44";
        }

        ctx.fillStyle = color;
        ctx.fillRect(markerX - 1, tlY - 6, 2, 6);
      }
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  }
}
