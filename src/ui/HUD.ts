import { lerp } from '../utils/math.js';

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  color: string;
  life: number;
  maxLife: number;
  isShield: boolean;
  isCrit: boolean;
}

export interface KillFeedEntry {
  text: string;
  time: number;
  isPlayerKill: boolean;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#8d8d8d',
  uncommon: '#30b42d',
  rare: '#3caceb',
  epic: '#b44ceb',
  legendary: '#eb9b3c',
  mythic: '#eb3c8d',
};

const WEAPON_ICONS: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void> = {
  ar: (ctx, x, y, s) => {
    ctx.fillRect(x - s * 0.6, y - s * 0.12, s * 1.2, s * 0.24);
    ctx.fillRect(x - s * 0.15, y + s * 0.12, s * 0.12, s * 0.35);
    ctx.fillRect(x + s * 0.2, y + s * 0.12, s * 0.12, s * 0.35);
  },
  shotgun: (ctx, x, y, s) => {
    ctx.fillRect(x - s * 0.6, y - s * 0.18, s * 1.2, s * 0.36);
    ctx.fillRect(x + s * 0.5, y - s * 0.26, s * 0.22, s * 0.52);
    ctx.fillRect(x - s * 0.1, y + s * 0.18, s * 0.12, s * 0.3);
    ctx.fillRect(x + s * 0.2, y + s * 0.18, s * 0.12, s * 0.3);
  },
  smg: (ctx, x, y, s) => {
    ctx.fillRect(x - s * 0.5, y - s * 0.1, s * 1.0, s * 0.2);
    ctx.fillRect(x - s * 0.1, y + s * 0.1, s * 0.08, s * 0.3);
    ctx.fillRect(x + s * 0.15, y + s * 0.1, s * 0.08, s * 0.3);
  },
  pistol: (ctx, x, y, s) => {
    ctx.fillRect(x - s * 0.35, y - s * 0.1, s * 0.7, s * 0.2);
    ctx.fillRect(x - s * 0.05, y + s * 0.1, s * 0.1, s * 0.35);
  },
  sniper: (ctx, x, y, s) => {
    ctx.fillRect(x - s * 0.7, y - s * 0.07, s * 1.4, s * 0.14);
    ctx.fillRect(x - s * 0.05, y + s * 0.07, s * 0.1, s * 0.4);
    ctx.fillRect(x + s * 0.6, y - s * 0.2, s * 0.15, s * 0.12);
  },
  rocket: (ctx, x, y, s) => {
    ctx.fillRect(x - s * 0.55, y - s * 0.15, s * 1.1, s * 0.3);
    ctx.beginPath();
    ctx.arc(x + s * 0.55, y, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - s * 0.1, y + s * 0.15, s * 0.08, s * 0.3);
    ctx.fillRect(x + s * 0.2, y + s * 0.15, s * 0.08, s * 0.3);
  },
  default: (ctx, x, y, s) => {
    ctx.fillRect(x - s * 0.4, y - s * 0.1, s * 0.8, s * 0.2);
    ctx.fillRect(x - s * 0.05, y + s * 0.1, s * 0.1, s * 0.3);
  },
};

export class HUDRenderer {
  private animatedHealth: number = 100;
  private animatedShield: number = 0;
  private damageNumbers: DamageNumber[] = [];
  private killFeed: KillFeedEntry[] = [];
  private killFeedSlide: Map<number, number> = new Map();
  private lowHealthPulse: number = 0;
  private lowHealthPulseDir: number = 1;
  private victoryAnimTime: number = 0;
  private elimAnimTime: number = 0;
  private crosshairSpread: number = 0;
  private stormWarningPulse: number = 0;
  private stormWarningPulseDir: number = 1;

  constructor() {}

  addDamageNumber(x: number, y: number, value: number, isShield: boolean, isCrit: boolean): void {
    let color = '#ffffff';
    if (value < 0) {
      const abs = Math.abs(value);
      if (isShield) {
        color = '#5bc0eb';
      } else if (abs >= 90) {
        color = '#ff3333';
      } else if (abs >= 60) {
        color = '#ff8c00';
      } else if (abs >= 30) {
        color = '#ffd700';
      }
    } else {
      color = '#33ff77';
    }

    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y - 10,
      value,
      color,
      life: 1.0,
      maxLife: 1.0,
      isShield,
      isCrit,
    });
  }

  addKillFeedEntry(text: string, isPlayerKill: boolean): void {
    const entry: KillFeedEntry = {
      text,
      time: Date.now(),
      isPlayerKill,
    };
    this.killFeed.unshift(entry);
    this.killFeedSlide.set(this.killFeed.indexOf(entry), 0);
    if (this.killFeed.length > 5) {
      this.killFeed.pop();
    }
  }

  update(dt: number): void {
    const speed = 5;
    this.animatedHealth = lerp(this.animatedHealth, 100, 1 - Math.pow(1 - 0.01, dt * speed));
    this.animatedShield = lerp(this.animatedShield, 0, 1 - Math.pow(1 - 0.01, dt * speed));

    if (this.animatedHealth < 30) {
      this.lowHealthPulse += this.lowHealthPulseDir * dt * 3;
      if (this.lowHealthPulse > 1) { this.lowHealthPulse = 1; this.lowHealthPulseDir = -1; }
      if (this.lowHealthPulse < 0) { this.lowHealthPulse = 0; this.lowHealthPulseDir = 1; }
    } else {
      this.lowHealthPulse = lerp(this.lowHealthPulse, 0, dt * 3);
    }

    this.stormWarningPulse += this.stormWarningPulseDir * dt * 2;
    if (this.stormWarningPulse > 1) { this.stormWarningPulse = 1; this.stormWarningPulseDir = -1; }
    if (this.stormWarningPulse < 0) { this.stormWarningPulse = 0; this.stormWarningPulseDir = 1; }

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.life -= dt * 0.8;
      dn.y -= dt * 60;
      dn.x += Math.sin(dn.life * 4) * dt * 8;
      if (dn.life <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }

    const now = Date.now();
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      if (now - this.killFeed[i].time > 5000) {
        this.killFeed.splice(i, 1);
        this.killFeedSlide.delete(i);
      }
    }

    this.killFeedSlide.forEach((val, key) => {
      const newVal = lerp(val, 1, dt * 5);
      this.killFeedSlide.set(key, newVal);
    });

    this.crosshairSpread = lerp(this.crosshairSpread, 0, dt * 8);
    this.victoryAnimTime += dt;
    this.elimAnimTime += dt;
  }

  render(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    player: any,
    gameState: any,
    camera: any,
    buildingMode: string | null,
    buildingMaterial: string,
    nearbyLoot: any[],
  ): void {
    if (!player || !gameState) return;

    const targetHealth = player.health ?? 100;
    const targetShield = player.shield ?? 0;
    this.animatedHealth = lerp(this.animatedHealth, targetHealth, 0.08);
    this.animatedShield = lerp(this.animatedShield, targetShield, 0.08);

    ctx.save();

    if (player.alive !== false) {
      this.renderHealthShieldBars(ctx, canvasWidth, canvasHeight, player);
      this.renderWeaponSlots(ctx, canvasWidth, canvasHeight, player);
      this.renderMinimap(ctx, canvasWidth, canvasHeight, player, gameState, camera);
      this.renderKillFeed(ctx, canvasWidth, canvasHeight);
      this.renderDamageNumbers(ctx, camera);
      this.renderMatchInfo(ctx, canvasWidth, canvasHeight, gameState, player);
      this.renderMaterials(ctx, canvasWidth, canvasHeight, player, buildingMode, buildingMaterial);
      this.renderPickupPrompt(ctx, canvasWidth, canvasHeight, nearbyLoot);

      if (this.isInStorm(player, gameState)) {
        this.renderStormWarning(ctx, canvasWidth, canvasHeight, player, gameState);
      }

      if (buildingMode) {
        this.renderBuildingModeIndicator(ctx, canvasWidth, canvasHeight, buildingMode, buildingMaterial);
      }
    } else {
      this.renderEliminationScreen(ctx, canvasWidth, canvasHeight, gameState, player);
    }

    if (gameState.matchPhase === 'ended' && player.alive !== false) {
      this.renderVictoryScreen(ctx, canvasWidth, canvasHeight, gameState, player);
    }

    ctx.restore();
  }

  renderCrosshair(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    spread: number,
    onTarget: boolean,
    isSniper: boolean,
  ): void {
    this.crosshairSpread = spread;

    if (isSniper) {
      this.renderSniperScope(ctx, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x - 5, y);
      ctx.moveTo(x + 5, y);
      ctx.lineTo(x + 20, y);
      ctx.moveTo(x, y - 20);
      ctx.lineTo(x, y - 5);
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x, y + 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.fill();
      return;
    }

    const color = onTarget ? '#ff4444' : '#ffffff';
    const gap = 4 + spread * 20;
    const len = 8 + spread * 5;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = onTarget ? 6 : 2;

    ctx.beginPath();
    ctx.moveTo(x - gap - len, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + len, y);
    ctx.moveTo(x, y - gap - len);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + len);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (onTarget) {
      ctx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, gap + len + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private renderHealthShieldBars(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    player: any,
  ): void {
    const maxHealth = player.maxHealth ?? 100;
    const maxShield = player.maxShield ?? 100;
    const barWidth = 280;
    const barHeight = 16;
    const barX = cw / 2 - barWidth / 2;
    const shieldY = ch - 95;
    const healthY = ch - 72;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.roundRect(ctx, barX - 6, shieldY - 4, barWidth + 12, (barHeight + 6) * 2 + 4, 8);
    ctx.fill();

    const shieldPct = Math.max(0, this.animatedShield / maxShield);
    const healthPct = Math.max(0, this.animatedHealth / maxHealth);

    ctx.fillStyle = 'rgba(20, 20, 40, 0.8)';
    this.roundRect(ctx, barX, shieldY, barWidth, barHeight, 4);
    ctx.fill();

    if (shieldPct > 0.001) {
      ctx.save();
      ctx.beginPath();
      this.roundRect(ctx, barX, shieldY, barWidth, barHeight, 4);
      ctx.clip();

      const shieldGrad = ctx.createLinearGradient(barX, 0, barX + barWidth * shieldPct, 0);
      shieldGrad.addColorStop(0, '#1a6bff');
      shieldGrad.addColorStop(0.5, '#3cacff');
      shieldGrad.addColorStop(1, '#6fd4ff');
      ctx.fillStyle = shieldGrad;
      ctx.fillRect(barX, shieldY, barWidth * shieldPct, barHeight);

      ctx.shadowColor = '#3cacff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.fillRect(barX, shieldY, barWidth * shieldPct, barHeight / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
    this.roundRect(ctx, barX, healthY, barWidth, barHeight, 4);
    ctx.fill();

    if (healthPct > 0.001) {
      ctx.save();
      ctx.beginPath();
      this.roundRect(ctx, barX, healthY, barWidth, barHeight, 4);
      ctx.clip();

      const hGrad = ctx.createLinearGradient(barX, 0, barX + barWidth * healthPct, 0);
      if (healthPct > 0.5) {
        hGrad.addColorStop(0, '#2ecc40');
        hGrad.addColorStop(1, '#5aff6e');
      } else if (healthPct > 0.25) {
        hGrad.addColorStop(0, '#f1c40f');
        hGrad.addColorStop(1, '#ffdd57');
      } else {
        hGrad.addColorStop(0, '#e74c3c');
        hGrad.addColorStop(1, '#ff6b6b');
      }
      ctx.fillStyle = hGrad;
      ctx.fillRect(barX, healthY, barWidth * healthPct, barHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(barX, healthY, barWidth * healthPct, barHeight / 2);
      ctx.restore();
    }

    if (this.animatedHealth < 30) {
      const pulseAlpha = this.lowHealthPulse * 0.25;
      ctx.fillStyle = `rgba(255, 50, 50, ${pulseAlpha})`;
      this.roundRect(ctx, barX - 2, healthY - 2, barWidth + 4, barHeight + 4, 6);
      ctx.fill();

      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 15 * this.lowHealthPulse;
      ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 * this.lowHealthPulse})`;
      ctx.lineWidth = 2;
      this.roundRect(ctx, barX, healthY, barWidth, barHeight, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.round(player.shield ?? 0)} / ${maxShield}`, cw / 2, shieldY + barHeight / 2);
    ctx.fillText(`${Math.round(player.health ?? 100)} / ${maxHealth}`, cw / 2, healthY + barHeight / 2);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#7ab8ff';
    ctx.textAlign = 'right';
    ctx.fillText('SHIELD', barX - 10, shieldY + barHeight / 2);
    ctx.fillStyle = healthPct > 0.5 ? '#5aff6e' : healthPct > 0.25 ? '#ffdd57' : '#ff6b6b';
    ctx.fillText('HP', barX - 10, healthY + barHeight / 2);

    ctx.restore();
  }

  private renderWeaponSlots(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    player: any,
  ): void {
    const inventory: any[] = player.inventory ?? [];
    const selectedSlot: number = player.selectedSlot ?? 0;
    const slotCount = 5;
    const slotSize = 56;
    const gap = 4;
    const totalWidth = slotCount * slotSize + (slotCount - 1) * gap;
    const startX = cw / 2 - totalWidth / 2;
    const slotY = ch - 36;

    ctx.save();

    for (let i = 0; i < slotCount; i++) {
      const x = startX + i * (slotSize + gap);
      const weapon = inventory[i];
      const isSelected = i === selectedSlot;

      ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.45)';
      this.roundRect(ctx, x, slotY, slotSize, slotSize, 6);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 8;
        this.roundRect(ctx, x, slotY, slotSize, slotSize, 6);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${i + 1}`, x + 4, slotY + 3);

      if (weapon) {
        const rarity = weapon.rarity ?? 'common';
        const rarityColor = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;

        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        if (isSelected) {
          ctx.shadowColor = rarityColor;
          ctx.shadowBlur = 10;
        }
        this.roundRect(ctx, x + 1, slotY + 1, slotSize - 2, slotSize - 2, 5);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = rarityColor;
        ctx.globalAlpha = 0.15;
        this.roundRect(ctx, x + 1, slotY + 1, slotSize - 2, slotSize - 2, 5);
        ctx.fill();
        ctx.globalAlpha = 1;

        const iconFn = WEAPON_ICONS[weapon.type] ?? WEAPON_ICONS.default;
        ctx.fillStyle = '#fff';
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, slotY, slotSize, slotSize);
        ctx.clip();
        iconFn(ctx, x + slotSize / 2, slotY + slotSize / 2 - 4, slotSize * 0.45);
        ctx.restore();

        if (weapon.maxAmmo !== undefined) {
          const ammoText = `${weapon.ammo ?? 0}`;
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(ammoText, x + slotSize - 4, slotY + slotSize - 3);
        }

        if (weapon.reloading) {
          const reloadPct = weapon.reloadProgress ?? 0;
          const barH = 3;
          const barY = slotY + slotSize - barH - 1;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(x + 3, barY, slotSize - 6, barH);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(x + 3, barY, (slotSize - 6) * reloadPct, barH);
        }

        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const displayName = weapon.name ?? weapon.type ?? '';
        const shortName = displayName.length > 6 ? displayName.substring(0, 6) : displayName;
        ctx.fillText(shortName, x + slotSize / 2, slotY + 3);
      }
    }

    ctx.restore();
  }

  private renderMinimap(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    player: any,
    gameState: any,
    camera: any,
  ): void {
    const size = 160;
    const radius = size / 2;
    const cx = cw - radius - 16;
    const cy = radius + 16;

    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 160, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(100, 160, 255, 0.3)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(10, 15, 30, 0.8)';
    ctx.fillRect(cx - radius, cy - radius, size, size);

    const mapSize = gameState.mapSize ?? 4000;
    const scale = size / mapSize;

    const gridSpacing = mapSize / 8;
    ctx.strokeStyle = 'rgba(60, 80, 120, 0.3)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= mapSize; gx += gridSpacing) {
      const sx = cx - radius + gx * scale;
      ctx.beginPath();
      ctx.moveTo(sx, cy - radius);
      ctx.lineTo(sx, cy + radius);
      ctx.stroke();
    }
    for (let gy = 0; gy <= mapSize; gy += gridSpacing) {
      const sy = cy - radius + gy * scale;
      ctx.beginPath();
      ctx.moveTo(cx - radius, sy);
      ctx.lineTo(cx + radius, sy);
      ctx.stroke();
    }

    const stormCenter = gameState.stormCenter ?? { x: mapSize / 2, y: mapSize / 2 };
    const stormRadius = gameState.stormRadius ?? mapSize;
    const scx = cx - radius + stormCenter.x * scale;
    const scy = cy - radius + stormCenter.y * scale;
    const sr = stormRadius * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - radius, cy - radius, size, size);
    ctx.clip();
    ctx.arc(scx, scy, sr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(80, 30, 120, 0.25)';
    ctx.fillRect(cx - radius, cy - radius, size, size);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.beginPath();
    ctx.arc(scx, scy, sr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(140, 60, 220, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(140, 60, 220, 0.5)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const nextCenter = gameState.nextStormCenter ?? stormCenter;
    const nextRadius = gameState.nextStormRadius ?? stormRadius * 0.5;
    const ncx = cx - radius + nextCenter.x * scale;
    const ncy = cy - radius + nextCenter.y * scale;
    const nr = nextRadius * scale;

    ctx.beginPath();
    ctx.arc(ncx, ncy, nr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (camera) {
      const buildings: any[] = gameState.buildings ?? [];
      ctx.fillStyle = 'rgba(180, 160, 130, 0.5)';
      for (const b of buildings) {
        const bx = cx - radius + b.pos.x * scale - 1.5;
        const by = cy - radius + b.pos.y * scale - 1.5;
        ctx.fillRect(bx, by, 3, 3);
      }
    }

    if (player.pos) {
      const px = cx - radius + player.pos.x * scale;
      const py = cy - radius + player.pos.y * scale;
      const rot = player.rotation ?? 0;

      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(rot) * 10, py + Math.sin(rot) * 10);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const bots: any[] = gameState.bots ?? [];
    for (const bot of bots) {
      if (!bot.alive) continue;
      if (!player.pos) continue;
      const dx = bot.pos.x - player.pos.x;
      const dy = bot.pos.y - player.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 800) continue;

      const ex = cx - radius + bot.pos.x * scale;
      const ey = cy - radius + bot.pos.y * scale;
      const alpha = Math.max(0.2, 1 - d / 800);

      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.shadowColor = `rgba(255, 60, 60, ${alpha * 0.5})`;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', cx, cy - radius + 2);

    ctx.beginPath();
    ctx.moveTo(cx, cy - radius + 3);
    ctx.lineTo(cx - 3, cy - radius + 8);
    ctx.lineTo(cx + 3, cy - radius + 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 80, 80, 0.7)';
    ctx.fill();

    ctx.restore();
  }

  private renderKillFeed(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
  ): void {
    const feedX = cw - 176;
    const feedY = 192;
    const entryH = 22;

    ctx.save();

    for (let i = 0; i < this.killFeed.length; i++) {
      const entry = this.killFeed[i];
      const age = (Date.now() - entry.time) / 1000;
      let alpha = 1;
      if (age > 3.5) alpha = Math.max(0, 1 - (age - 3.5) / 1.5);

      const slideProgress = this.killFeedSlide.get(i) ?? 1;
      const slideOffset = (1 - Math.min(slideProgress, 1)) * 80;

      const ey = feedY + i * (entryH + 3);

      ctx.globalAlpha = alpha;

      ctx.fillStyle = entry.isPlayerKill
        ? 'rgba(200, 160, 40, 0.35)'
        : 'rgba(30, 30, 40, 0.55)';
      this.roundRect(ctx, feedX - slideOffset, ey, 160, entryH, 4);
      ctx.fill();

      if (entry.isPlayerKill) {
        ctx.strokeStyle = 'rgba(241, 196, 15, 0.5)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, feedX - slideOffset, ey, 160, entryH, 4);
        ctx.stroke();
      }

      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = entry.isPlayerKill ? '#f1c40f' : '#ccc';
      ctx.fillText(entry.text, feedX - slideOffset + 8, ey + entryH / 2);

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private renderDamageNumbers(
    ctx: CanvasRenderingContext2D,
    camera: any,
  ): void {
    ctx.save();

    for (const dn of this.damageNumbers) {
      const alpha = Math.max(0, dn.life / dn.maxLife);
      const screenX = dn.x - (camera?.pos?.x ?? 0);
      const screenY = dn.y - (camera?.pos?.y ?? 0);

      if (camera) {
        const sx = (camera.width ?? 0) / 2;
        const sy = (camera.height ?? 0) / 2;
      }

      ctx.globalAlpha = alpha;

      const fontSize = dn.isCrit ? 22 : dn.value >= 0 ? 16 : 15;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#000';
      ctx.fillText(`${Math.abs(Math.round(dn.value))}`, screenX + 1, screenY + 1);

      ctx.shadowBlur = 0;
      ctx.fillStyle = dn.color;
      if (dn.isCrit) {
        ctx.shadowColor = dn.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillText(`${Math.abs(Math.round(dn.value))}`, screenX, screenY);
      if (dn.isCrit) {
        ctx.shadowBlur = 0;
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('!', screenX + ctx.measureText(`${Math.abs(Math.round(dn.value))}`).width / 2 + 8, screenY - 8);
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private renderMatchInfo(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    gameState: any,
    player: any,
  ): void {
    const cx = cw / 2;
    const y = 12;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.roundRect(ctx, cx - 160, y, 320, 32, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, cx - 160, y, 320, 32, 8);
    ctx.stroke();

    const minutes = Math.floor((gameState.matchTime ?? 0) / 60);
    const seconds = Math.floor((gameState.matchTime ?? 0) % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const alive = gameState.playersAlive ?? 0;
    ctx.fillStyle = '#ddd';
    ctx.fillText(`\u2694 ${alive}`, cx - 110, y + 16);

    const kills = player.kills ?? 0;
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`\u2620 ${kills}`, cx - 50, y + 16);

    const phase = gameState.stormPhase ?? 0;
    ctx.fillStyle = '#c87aff';
    ctx.fillText(`Storm ${phase}`, cx + 30, y + 16);

    ctx.fillStyle = '#aaa';
    ctx.fillText(timeStr, cx + 110, y + 16);

    ctx.restore();
  }

  private renderMaterials(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    player: any,
    buildingMode: string | null,
    buildingMaterial: string,
  ): void {
    const materials = player.materials ?? { wood: 0, brick: 0, metal: 0 };
    const startX = cw - 140;
    const startY = ch - 55;
    const slotW = 42;
    const slotH = 36;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.roundRect(ctx, startX - 6, startY - 4, slotW * 3 + 12 + 8, slotH + 8, 6);
    ctx.fill();

    const matDefs = [
      { key: 'wood', color: '#c4873b', label: 'W', activeColor: '#e8a84c' },
      { key: 'brick', color: '#b84c3b', label: 'B', activeColor: '#e06050' },
      { key: 'metal', color: '#8a8a8a', label: 'M', activeColor: '#b0b0b0' },
    ];

    for (let i = 0; i < matDefs.length; i++) {
      const mat = matDefs[i];
      const mx = startX + i * (slotW + 4);
      const count: number = materials[mat.key] ?? 0;
      const isActive = buildingMode && buildingMaterial === mat.key;

      if (isActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.roundRect(ctx, mx, startY, slotW, slotH, 4);
        ctx.fill();
        ctx.strokeStyle = mat.activeColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = mat.activeColor;
        ctx.shadowBlur = 6;
        this.roundRect(ctx, mx, startY, slotW, slotH, 4);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = mat.color;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(mx + 4, startY + 4, 10, 10);
      ctx.globalAlpha = 1;
      ctx.fillStyle = mat.color;
      ctx.fillRect(mx + 4, startY + 4, 10, 10);

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${count}`, mx + slotW / 2, startY + slotH - 3);

      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(mat.label, mx + slotW / 2 + 8, startY + 5);
    }

    ctx.restore();
  }

  private renderPickupPrompt(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    nearbyLoot: any[],
  ): void {
    if (!nearbyLoot || nearbyLoot.length === 0) return;

    const loot = nearbyLoot[0];
    const itemName = typeof loot.item === 'string' ? loot.item : loot.item?.name ?? 'Item';
    const rarity = typeof loot.item === 'string' ? 'common' : loot.item?.rarity ?? 'common';
    const rarityColor = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;

    const promptY = ch - 115;
    const promptText = `[F] ${itemName}`;
    const textWidth = ctx.measureText?.(promptText)?.width ?? 100;

    ctx.save();

    ctx.font = 'bold 13px monospace';
    const tw = ctx.measureText(promptText).width;
    const pw = tw + 30;
    const px = cw / 2 - pw / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.roundRect(ctx, px, promptY, pw, 28, 6);
    ctx.fill();

    ctx.strokeStyle = rarityColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = rarityColor;
    ctx.shadowBlur = 8;
    this.roundRect(ctx, px, promptY, pw, 28, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = rarityColor;
    ctx.globalAlpha = 0.1;
    this.roundRect(ctx, px, promptY, pw, 28, 6);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(promptText, cw / 2, promptY + 14);

    ctx.restore();
  }

  private renderStormWarning(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    player: any,
    gameState: any,
  ): void {
    const pulseAlpha = 0.12 + this.stormWarningPulse * 0.12;

    ctx.save();

    const grad = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    grad.addColorStop(0, 'rgba(100, 30, 150, 0)');
    grad.addColorStop(1, `rgba(100, 30, 150, ${pulseAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(200, 100, 255, ${0.7 + this.stormWarningPulse * 0.3})`;
    ctx.shadowColor = 'rgba(200, 100, 255, 0.6)';
    ctx.shadowBlur = 15;
    ctx.fillText('IN STORM', cw / 2, ch / 2 - 40);

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
    ctx.shadowColor = 'rgba(255, 100, 100, 0.5)';
    ctx.shadowBlur = 8;
    const dmg = gameState.stormDamage ?? 1;
    ctx.fillText(`-${dmg} HP/s`, cw / 2, ch / 2 - 15);
    ctx.shadowBlur = 0;

    if (player.pos && gameState.stormCenter) {
      const dx = gameState.stormCenter.x - player.pos.x;
      const dy = gameState.stormCenter.y - player.pos.y;
      const angle = Math.atan2(dy, dx);

      const arrowDist = 50;
      const arrowX = cw / 2 + Math.cos(angle) * arrowDist;
      const arrowY = ch / 2 + Math.sin(angle) * arrowDist + 15;

      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 6;
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  private renderSniperScope(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
  ): void {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = 'rgba(50, 50, 50, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cw / 2, 0);
    ctx.lineTo(cw / 2, ch);
    ctx.moveTo(0, ch / 2);
    ctx.lineTo(cw, ch / 2);
    ctx.stroke();

    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, Math.min(cw, ch) * 0.1 * i, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.2 - i * 0.05})`;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderVictoryScreen(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    gameState: any,
    player: any,
  ): void {
    const t = this.victoryAnimTime;

    ctx.save();

    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.6, t * 0.5)})`;
    ctx.fillRect(0, 0, cw, ch);

    const scale = Math.min(1, t * 2);
    const bounce = t < 0.5 ? (1 + Math.sin(t * Math.PI) * 0.2) : 1;

    ctx.translate(cw / 2, ch / 2 - 60);
    ctx.scale(scale * bounce, scale * bounce);

    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('VICTORY', 0, 0);

    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffeb3b';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('VICTORY', 0, 0);

    ctx.shadowBlur = 0;

    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText('ROYALE', 0, 40);
    ctx.shadowBlur = 0;

    ctx.restore();

    if (t > 1) {
      this.renderMatchStats(ctx, cw, ch, gameState, player, ch / 2 + 30);
    }

    if (t > 2) {
      ctx.save();
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(t * 3) * 0.3})`;
      ctx.fillText('Press N to play again', cw / 2, ch / 2 + 140);
      ctx.restore();
    }
  }

  private renderEliminationScreen(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    gameState: any,
    player: any,
  ): void {
    const t = this.elimAnimTime;

    ctx.save();

    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.7, t * 0.8)})`;
    ctx.fillRect(0, 0, cw, ch);

    const scale = Math.min(1, t * 1.5);
    ctx.translate(cw / 2, ch / 2 - 60);
    ctx.scale(scale, scale);

    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 50, 50, 0.6)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('ELIMINATED', 0, 0);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#aaa';
    const placement = gameState.playersAlive ?? 0;
    ctx.fillText(`#${placement + 1} Place`, 0, 45);

    ctx.restore();

    if (t > 1) {
      this.renderMatchStats(ctx, cw, ch, gameState, player, ch / 2 + 30);
    }

    if (t > 2) {
      ctx.save();
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(t * 3) * 0.3})`;
      ctx.fillText('Press N to play again', cw / 2, ch / 2 + 140);
      ctx.restore();
    }
  }

  private renderMatchStats(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    gameState: any,
    player: any,
    startY: number,
  ): void {
    ctx.save();

    const kills = player.kills ?? 0;
    const damageDealt = player.damageDealt ?? 0;
    const matchTime = gameState.matchTime ?? 0;
    const minutes = Math.floor(matchTime / 60);
    const seconds = Math.floor(matchTime % 60);

    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const stats = [
      { label: 'Kills', value: `${kills}` },
      { label: 'Damage', value: `${Math.round(damageDealt)}` },
      { label: 'Survival', value: `${minutes}m ${seconds}s` },
    ];

    const statWidth = 120;
    const totalWidth = stats.length * statWidth;
    const sx = cw / 2 - totalWidth / 2;

    for (let i = 0; i < stats.length; i++) {
      const x = sx + i * statWidth + statWidth / 2;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(stats[i].label, x, startY);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(stats[i].value, x, startY + 24);
      ctx.font = '14px monospace';
    }

    ctx.restore();
  }

  private renderBuildingModeIndicator(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    buildingMode: string,
    buildingMaterial: string,
  ): void {
    const x = cw / 2;
    const y = ch - 140;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.roundRect(ctx, x - 70, y, 140, 24, 6);
    ctx.fill();

    const matColor = buildingMaterial === 'wood' ? '#c4873b' :
                     buildingMaterial === 'brick' ? '#b84c3b' : '#8a8a8a';

    ctx.strokeStyle = matColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = matColor;
    ctx.shadowBlur = 8;
    this.roundRect(ctx, x - 70, y, 140, 24, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(`BUILD: ${buildingMode.toUpperCase()}`, x, y + 12);

    ctx.restore();
  }

  private isInStorm(player: any, gameState: any): boolean {
    if (!player.pos || !gameState.stormCenter) return false;
    const dx = player.pos.x - gameState.stormCenter.x;
    const dy = player.pos.y - gameState.stormCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist > (gameState.stormRadius ?? 9999);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
