export class WeaponSwitchAnimation {
  private switching: boolean = false;
  private switchProgress: number = 0;
  private switchDuration: number = 0.3;
  private oldSlot: number = 0;
  private newSlot: number = 0;
  private displayName: string = "";
  private displayNameTimer: number = 0;
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
  }> = [];
  private slotHighlightTimers: number[] = [0, 0, 0, 0, 0];
  private slotRarityColors: string[] = [
    "#b0b0b0",
    "#30b42c",
    "#2ea4d4",
    "#9b2ed6",
    "#e68a1a",
  ];
  private currentWeaponType: string = "pickaxe";

  constructor() {}

  startSwitch(oldSlot: number, newSlot: number, weaponName: string): void {
    if (oldSlot === newSlot) return;
    this.switching = true;
    this.switchProgress = 0;
    this.oldSlot = oldSlot;
    this.newSlot = newSlot;
    this.displayName = weaponName;
    this.displayNameTimer = 1.5;
    this.currentWeaponType = this.getWeaponTypeFromSlot(newSlot);
    this.spawnParticles(0, 0);
    if (newSlot >= 0 && newSlot < 5) {
      this.slotHighlightTimers[newSlot] = 0.4;
    }
  }

  private getWeaponTypeFromSlot(slot: number): string {
    const types = ["pickaxe", "pistol", "ar", "shotgun", "sniper"];
    if (slot >= 0 && slot < types.length) return types[slot];
    return "pickaxe";
  }

  private spawnParticles(posX: number, posY: number): void {
    const color =
      this.slotRarityColors[this.newSlot] || this.slotRarityColors[0];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x: posX,
        y: posY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.4 + Math.random() * 0.2,
        color: color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  update(dt: number): void {
    if (this.switching) {
      this.switchProgress += dt / this.switchDuration;
      if (this.switchProgress >= 1) {
        this.switchProgress = 1;
        this.switching = false;
      }
    }

    if (this.displayNameTimer > 0) {
      this.displayNameTimer -= dt;
      if (this.displayNameTimer < 0) {
        this.displayNameTimer = 0;
      }
    }

    for (let i = 0; i < this.slotHighlightTimers.length; i++) {
      if (this.slotHighlightTimers[i] > 0) {
        this.slotHighlightTimers[i] -= dt;
        if (this.slotHighlightTimers[i] < 0) {
          this.slotHighlightTimers[i] = 0;
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    if (this.switching) {
      const progress = this.switchProgress;
      const halfDuration = 0.5;

      if (progress < halfDuration) {
        const t = progress / halfDuration;
        const slideY = t * 80;
        const alpha = 1 - t;
        const rotation = t * 0.3;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(centerX + 120, centerY + 40);
        ctx.rotate(rotation);
        this.renderWeaponModel(
          ctx,
          this.getWeaponTypeFromSlot(this.oldSlot),
          0,
          slideY,
          1,
          alpha
        );
        ctx.restore();
      }

      if (progress >= halfDuration) {
        const t = (progress - halfDuration) / halfDuration;
        const slideY = (1 - t) * -80;
        const alpha = t;
        const rotation = (1 - t) * -0.3;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(centerX + 120, centerY + 40);
        ctx.rotate(rotation);
        this.renderWeaponModel(
          ctx,
          this.getWeaponTypeFromSlot(this.newSlot),
          0,
          slideY,
          1,
          alpha
        );
        ctx.restore();
      }
    }

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.displayNameTimer > 0) {
      const nameAlpha = Math.min(1, this.displayNameTimer / 0.3);
      ctx.save();
      ctx.globalAlpha = nameAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(this.displayName, centerX, centerY - 40);
      ctx.restore();
    }

    this.renderSlotHighlights(ctx, canvasWidth, canvasHeight);
  }

  private renderSlotHighlights(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const slotWidth = 60;
    const slotHeight = 60;
    const slotGap = 6;
    const totalWidth = 5 * slotWidth + 4 * slotGap;
    const startX = (canvasWidth - totalWidth) / 2;
    const startY = canvasHeight - slotHeight - 20;

    for (let i = 0; i < 5; i++) {
      if (this.slotHighlightTimers[i] > 0) {
        const alpha = this.slotHighlightTimers[i] / 0.4;
        const color = this.slotRarityColors[i] || this.slotRarityColors[0];
        const x = startX + i * (slotWidth + slotGap);

        ctx.save();
        ctx.globalAlpha = alpha * 0.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15 * alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 2, startY - 2, slotWidth + 4, slotHeight + 4);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = alpha * 0.15;
        ctx.fillStyle = color;
        ctx.fillRect(x, startY, slotWidth, slotHeight);
        ctx.restore();
      }
    }
  }

  renderWeaponModel(
    ctx: CanvasRenderingContext2D,
    weaponType: string,
    x: number,
    y: number,
    scale: number,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#888888";
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 1.5;

    switch (weaponType) {
      case "pickaxe": {
        ctx.fillStyle = "#a0784c";
        ctx.fillRect(-3, -20, 6, 28);
        ctx.fillStyle = "#888888";
        ctx.fillRect(-10, -24, 20, 6);
        ctx.strokeRect(-10, -24, 20, 6);
        ctx.strokeRect(-3, -20, 6, 28);
        break;
      }
      case "pistol": {
        ctx.fillStyle = "#666666";
        ctx.fillRect(-4, -6, 22, 8);
        ctx.fillRect(-2, 2, 8, 14);
        ctx.strokeRect(-4, -6, 22, 8);
        ctx.strokeRect(-2, 2, 8, 14);
        ctx.fillStyle = "#444444";
        ctx.fillRect(14, -5, 6, 6);
        break;
      }
      case "ar": {
        ctx.fillStyle = "#555555";
        ctx.fillRect(-10, -4, 40, 8);
        ctx.fillStyle = "#666666";
        ctx.fillRect(-12, -2, 12, 5);
        ctx.fillRect(-4, 4, 6, 10);
        ctx.fillRect(16, 4, 6, 8);
        ctx.strokeRect(-10, -4, 40, 8);
        ctx.strokeRect(-12, -2, 12, 5);
        ctx.strokeRect(-4, 4, 6, 10);
        ctx.strokeRect(16, 4, 6, 8);
        ctx.fillStyle = "#444444";
        ctx.fillRect(26, -3, 6, 6);
        break;
      }
      case "shotgun": {
        ctx.fillStyle = "#6b4c2a";
        ctx.fillRect(-8, -5, 30, 10);
        ctx.fillStyle = "#555555";
        ctx.fillRect(-2, 5, 8, 12);
        ctx.strokeRect(-8, -5, 30, 10);
        ctx.strokeRect(-2, 5, 8, 12);
        ctx.fillStyle = "#444444";
        ctx.fillRect(18, -4, 6, 8);
        break;
      }
      case "sniper": {
        ctx.fillStyle = "#4a5a3a";
        ctx.fillRect(-14, -3, 52, 6);
        ctx.fillStyle = "#666666";
        ctx.fillRect(-2, -10, 6, 7);
        ctx.fillRect(-4, 3, 6, 12);
        ctx.fillRect(20, 3, 6, 8);
        ctx.strokeRect(-14, -3, 52, 6);
        ctx.strokeRect(-2, -10, 6, 7);
        ctx.strokeRect(-4, 3, 6, 12);
        ctx.strokeRect(20, 3, 6, 8);
        ctx.fillStyle = "#3388cc";
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(1, -11, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "smg": {
        ctx.fillStyle = "#5a5a5a";
        ctx.fillRect(-6, -4, 26, 8);
        ctx.fillStyle = "#666666";
        ctx.fillRect(-2, 4, 8, 10);
        ctx.fillRect(12, 4, 6, 6);
        ctx.strokeRect(-6, -4, 26, 8);
        ctx.strokeRect(-2, 4, 8, 10);
        ctx.strokeRect(12, 4, 6, 6);
        ctx.fillStyle = "#444444";
        ctx.fillRect(16, -3, 6, 6);
        break;
      }
      case "rocket": {
        ctx.fillStyle = "#5c6b3a";
        ctx.fillRect(-8, -6, 36, 12);
        ctx.fillStyle = "#666666";
        ctx.fillRect(-4, 6, 8, 10);
        ctx.fillRect(16, 6, 6, 8);
        ctx.strokeRect(-8, -6, 36, 12);
        ctx.strokeRect(-4, 6, 8, 10);
        ctx.strokeRect(16, 6, 6, 8);
        ctx.fillStyle = "#333333";
        ctx.beginPath();
        ctx.arc(28, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      default: {
        ctx.fillStyle = "#888888";
        ctx.fillRect(-5, -5, 10, 10);
        break;
      }
    }

    ctx.restore();
  }

  isSwitching(): boolean {
    return this.switching;
  }

  getDisplayNameTimer(): number {
    return this.displayNameTimer;
  }

  spawnParticlesAt(
    playerX: number,
    playerY: number,
    slot: number
  ): void {
    const color =
      this.slotRarityColors[slot] || this.slotRarityColors[0];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x: playerX,
        y: playerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.4 + Math.random() * 0.2,
        color: color,
        size: 2 + Math.random() * 3,
      });
    }
  }
}
