import { vec2 } from '../utils/math.js';

export interface FishingSpot {
  id: string;
  pos: { x: number; y: number };
  catchesRemaining: number;
  maxCatches: number;
  respawnTimer: number;
  respawnTime: number;
  active: boolean;
}

export interface ForageBush {
  id: string;
  pos: { x: number; y: number };
  type: 'apple' | 'mushroom' | 'hop';
  active: boolean;
  respawnTimer: number;
  respawnTime: number;
}

export interface FishingResult {
  type: 'shield_fish' | 'health_fish' | 'vendetta_fish' | 'junk' | 'legendary';
  name: string;
  shieldAmount?: number;
  healthAmount?: number;
  speedBoost?: number;
  speedDuration?: number;
  weaponType?: string;
  materials?: { wood: number; brick: number; metal: number };
  vendettaDuration?: number;
}

const FISHING_SPOT_RADIUS = 28;
const FISHING_INTERACT_DIST = 50;
const FORAGE_INTERACT_DIST = 30;
const FISHING_COOLDOWN = 5;
const FISHING_MIN_WAIT = 2;
const FISHING_MAX_WAIT = 4;
const SPOT_MAX_CATCHES_MIN = 3;
const SPOT_MAX_CATCHES_MAX = 3;
const SPOT_RESPAWN_TIME = 60;
const FORAGE_RESPAWN_TIME = 30;
const CATCH_POPUP_DURATION = 2;
const WATER_PROXIMITY = 2;
const FISHING_SPOT_COUNT_MIN = 10;
const FISHING_SPOT_COUNT_MAX = 15;
const FORAGE_BUSH_COUNT_MIN = 15;
const FORAGE_BUSH_COUNT_MAX = 20;
const VENDETTA_DURATION = 5;
const TILE_SIZE = 32;

const LEGENDARY_WEAPONS = [
  'Legendary Assault Rifle',
  'Legendary Pump Shotgun',
  'Legendary Sniper Rifle',
  'Legendary Rocket Launcher',
  'Legendary SMG',
];

let spotIdCounter = 0;
let bushIdCounter = 0;

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function rollCatch(): FishingResult {
  const roll = Math.random();
  if (roll < 0.05) {
    return {
      type: 'legendary',
      name: LEGENDARY_WEAPONS[Math.floor(Math.random() * LEGENDARY_WEAPONS.length)],
      weaponType: 'legendary',
    };
  }
  if (roll < 0.20) {
    return {
      type: 'vendetta_fish',
      name: 'Vendetta Fish',
      vendettaDuration: VENDETTA_DURATION,
    };
  }
  if (roll < 0.45) {
    return {
      type: 'shield_fish',
      name: 'Shield Fish',
      shieldAmount: 25,
    };
  }
  if (roll < 0.70) {
    return {
      type: 'health_fish',
      name: 'Thermal Fish',
      healthAmount: 50,
    };
  }
  return {
    type: 'junk',
    name: 'Rusty Can',
    materials: { wood: 2, brick: 1, metal: 2 },
  };
}

function isNearWater(tileX: number, tileY: number, waterTiles: Array<{ x: number; y: number }>, proximity: number): boolean {
  for (const wt of waterTiles) {
    const dx = Math.abs(tileX - wt.x);
    const dy = Math.abs(tileY - wt.y);
    if (dx <= proximity && dy <= proximity) return true;
  }
  return false;
}

export class FishingSystem {
  private fishingSpots: FishingSpot[] = [];
  private forageBushes: ForageBush[] = [];
  private fishingCooldown: number = 0;
  private isFishing: boolean = false;
  private fishingTimer: number = 0;
  private fishingWaitDuration: number = 0;
  private fishingTarget: FishingSpot | null = null;
  private lastCatch: FishingResult | null = null;
  private lastCatchTimer: number = 0;
  private vendettaTimer: number = 0;
  private fishingLineStart: { x: number; y: number } | null = null;

  spawnFishingSpots(tiles: Array<{ x: number; y: number; biome: string }>): void {
    this.fishingSpots = [];
    spotIdCounter = 0;

    const waterTiles = tiles.filter(t => t.biome === 'water');
    if (waterTiles.length === 0) return;

    const candidates: Array<{ x: number; y: number }> = [];
    for (const tile of tiles) {
      if (tile.biome === 'water') continue;
      if (isNearWater(tile.x, tile.y, waterTiles, WATER_PROXIMITY)) {
        candidates.push({
          x: tile.x * TILE_SIZE + TILE_SIZE / 2,
          y: tile.y * TILE_SIZE + TILE_SIZE / 2,
        });
      }
    }

    const targetCount = FISHING_SPOT_COUNT_MIN + Math.floor(Math.random() * (FISHING_SPOT_COUNT_MAX - FISHING_SPOT_COUNT_MIN + 1));
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(targetCount, shuffled.length));

    for (const pos of selected) {
      const maxCatches = SPOT_MAX_CATCHES_MIN + Math.floor(Math.random() * (SPOT_MAX_CATCHES_MAX - SPOT_MAX_CATCHES_MIN + 1));
      this.fishingSpots.push({
        id: `fish_${spotIdCounter++}`,
        pos: { x: pos.x, y: pos.y },
        catchesRemaining: maxCatches,
        maxCatches,
        respawnTimer: 0,
        respawnTime: SPOT_RESPAWN_TIME,
        active: true,
      });
    }
  }

  spawnForageBushes(tiles: Array<{ x: number; y: number; biome: string }>): void {
    this.forageBushes = [];
    bushIdCounter = 0;

    const forestTiles = tiles.filter(t => t.biome === 'forest');
    if (forestTiles.length === 0) return;

    const shuffled = forestTiles.sort(() => Math.random() - 0.5);
    const targetCount = FORAGE_BUSH_COUNT_MIN + Math.floor(Math.random() * (FORAGE_BUSH_COUNT_MAX - FORAGE_BUSH_COUNT_MIN + 1));
    const selected = shuffled.slice(0, Math.min(targetCount, shuffled.length));

    const types: Array<'apple' | 'mushroom' | 'hop'> = ['apple', 'mushroom', 'hop'];

    for (const tile of selected) {
      const bushType = types[Math.floor(Math.random() * types.length)];
      this.forageBushes.push({
        id: `bush_${bushIdCounter++}`,
        pos: {
          x: tile.x * TILE_SIZE + TILE_SIZE / 2,
          y: tile.y * TILE_SIZE + TILE_SIZE / 2,
        },
        type: bushType,
        active: true,
        respawnTimer: 0,
        respawnTime: FORAGE_RESPAWN_TIME,
      });
    }
  }

  tryFish(playerPos: { x: number; y: number }, playerRadius: number): boolean {
    if (this.isFishing) return false;
    if (this.fishingCooldown > 0) return false;

    let closest: FishingSpot | null = null;
    let closestDist = Infinity;

    for (const spot of this.fishingSpots) {
      if (!spot.active || spot.catchesRemaining <= 0) continue;
      const d = dist(playerPos, spot.pos);
      if (d <= playerRadius + FISHING_INTERACT_DIST && d < closestDist) {
        closest = spot;
        closestDist = d;
      }
    }

    if (!closest) return false;

    this.isFishing = true;
    this.fishingTarget = closest;
    this.fishingTimer = 0;
    this.fishingWaitDuration = randomRange(FISHING_MIN_WAIT, FISHING_MAX_WAIT);
    this.fishingLineStart = { x: playerPos.x, y: playerPos.y };
    return true;
  }

  tryForage(playerPos: { x: number; y: number }, playerRadius: number): ForageBush | null {
    for (const bush of this.forageBushes) {
      if (!bush.active) continue;
      const d = dist(playerPos, bush.pos);
      if (d <= playerRadius + FORAGE_INTERACT_DIST) {
        bush.active = false;
        bush.respawnTimer = bush.respawnTime;
        return bush;
      }
    }
    return null;
  }

  update(dt: number): FishingResult | null {
    for (const spot of this.fishingSpots) {
      if (!spot.active) {
        spot.respawnTimer -= dt;
        if (spot.respawnTimer <= 0) {
          spot.active = true;
          spot.catchesRemaining = spot.maxCatches;
          spot.respawnTimer = 0;
        }
      }
    }

    for (const bush of this.forageBushes) {
      if (!bush.active) {
        bush.respawnTimer -= dt;
        if (bush.respawnTimer <= 0) {
          bush.active = true;
          bush.respawnTimer = 0;
        }
      }
    }

    if (this.fishingCooldown > 0) {
      this.fishingCooldown = Math.max(0, this.fishingCooldown - dt);
    }

    if (this.vendettaTimer > 0) {
      this.vendettaTimer = Math.max(0, this.vendettaTimer - dt);
    }

    if (this.lastCatchTimer > 0) {
      this.lastCatchTimer -= dt;
      if (this.lastCatchTimer <= 0) {
        this.lastCatch = null;
        this.lastCatchTimer = 0;
      }
    }

    if (this.isFishing && this.fishingTarget) {
      this.fishingTimer += dt;

      if (this.fishingTimer >= this.fishingWaitDuration) {
        const result = rollCatch();
        this.fishingTarget.catchesRemaining--;

        if (this.fishingTarget.catchesRemaining <= 0) {
          this.fishingTarget.active = false;
          this.fishingTarget.respawnTimer = this.fishingTarget.respawnTime;
        }

        if (result.type === 'vendetta_fish') {
          this.vendettaTimer = result.vendettaDuration ?? VENDETTA_DURATION;
        }

        this.lastCatch = result;
        this.lastCatchTimer = CATCH_POPUP_DURATION;
        this.isFishing = false;
        this.fishingTarget = null;
        this.fishingLineStart = null;
        this.fishingCooldown = FISHING_COOLDOWN;
        return result;
      }
    }

    return null;
  }

  cancelFishing(): void {
    this.isFishing = false;
    this.fishingTarget = null;
    this.fishingTimer = 0;
    this.fishingLineStart = null;
  }

  getVendettaActive(): boolean {
    return this.vendettaTimer > 0;
  }

  getVendettaTimer(): number {
    return this.vendettaTimer;
  }

  getFishingSpots(): FishingSpot[] {
    return this.fishingSpots;
  }

  getForageBushes(): ForageBush[][] {
    return [this.forageBushes];
  }

  getLastCatch(): FishingResult | null {
    return this.lastCatch;
  }

  isCurrentlyFishing(): boolean {
    return this.isFishing;
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    this.renderFishingSpots(ctx, time);
    this.renderForageBushes(ctx, time);
    if (this.isFishing && this.fishingTarget && this.fishingLineStart) {
      this.renderFishingLine(ctx, time);
    }
  }

  private renderFishingSpots(ctx: CanvasRenderingContext2D, time: number): void {
    for (const spot of this.fishingSpots) {
      if (!spot.active) continue;
      this.renderSingleFishingSpot(ctx, spot, time);
    }
  }

  private renderSingleFishingSpot(ctx: CanvasRenderingContext2D, spot: FishingSpot, time: number): void {
    const { pos } = spot;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
    const outerPulse = 0.5 + 0.5 * Math.sin(time * 1.8 + 1);

    ctx.save();

    const glowAlpha = 0.15 + 0.1 * pulse;
    const glowRadius = FISHING_SPOT_RADIUS + 10 + 6 * pulse;
    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowRadius);
    gradient.addColorStop(0, `rgba(60, 140, 255, ${glowAlpha + 0.1})`);
    gradient.addColorStop(0.5, `rgba(40, 120, 230, ${glowAlpha * 0.6})`);
    gradient.addColorStop(1, `rgba(30, 100, 220, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(80, 160, 255, ${0.4 + 0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, FISHING_SPOT_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(120, 190, 255, ${0.2 + 0.2 * outerPulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, FISHING_SPOT_RADIUS + 6 + 3 * outerPulse, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const ripplePhase = (time * 1.5 + i * 2.1) % 3;
      const rippleProgress = ripplePhase / 3;
      const rippleRadius = FISHING_SPOT_RADIUS * 0.3 + FISHING_SPOT_RADIUS * 0.8 * rippleProgress;
      const rippleAlpha = Math.max(0, (1 - rippleProgress) * 0.3);
      ctx.strokeStyle = `rgba(140, 200, 255, ${rippleAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, rippleRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(200, 230, 255, ${0.7 + 0.3 * pulse})`;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F41F}', pos.x, pos.y - 2);

    if (spot.catchesRemaining < spot.maxCatches) {
      ctx.fillStyle = `rgba(255, 255, 255, 0.7)`;
      ctx.font = '8px monospace';
      ctx.fillText(`${spot.catchesRemaining}/${spot.maxCatches}`, pos.x, pos.y + FISHING_SPOT_RADIUS + 10);
    }

    ctx.restore();
  }

  private renderForageBushes(ctx: CanvasRenderingContext2D, time: number): void {
    for (const bush of this.forageBushes) {
      if (!bush.active) continue;
      this.renderSingleForageBush(ctx, bush, time);
    }
  }

  private renderSingleForageBush(ctx: CanvasRenderingContext2D, bush: ForageBush, time: number): void {
    const { pos, type } = bush;
    const sway = Math.sin(time * 1.5 + pos.x * 0.05) * 2;

    ctx.save();
    ctx.translate(pos.x + sway, pos.y);

    ctx.fillStyle = '#2D5A1E';
    ctx.beginPath();
    ctx.arc(0, -4, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3A7A28';
    ctx.beginPath();
    ctx.arc(-5, -7, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4A8E32';
    ctx.beginPath();
    ctx.arc(5, -6, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#357A22';
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, Math.PI * 2);
    ctx.fill();

    const dotBob = Math.sin(time * 3 + pos.y * 0.1) * 1.5;

    let dotColor: string;
    let dotCount: number;
    switch (type) {
      case 'apple':
        dotColor = '#FF3B30';
        dotCount = 3;
        break;
      case 'mushroom':
        dotColor = '#AF52DE';
        dotCount = 4;
        break;
      case 'hop':
        dotColor = '#FFD60A';
        dotCount = 3;
        break;
    }

    const dotPositions = [
      { x: -6, y: -10 },
      { x: 5, y: -8 },
      { x: -1, y: -15 },
      { x: 7, y: -13 },
    ];

    for (let i = 0; i < dotCount; i++) {
      const dp = dotPositions[i];
      ctx.fillStyle = dotColor;
      ctx.shadowColor = dotColor;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(dp.x, dp.y + dotBob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private renderFishingLine(ctx: CanvasRenderingContext2D, time: number): void {
    if (!this.fishingTarget || !this.fishingLineStart) return;

    const start = this.fishingLineStart;
    const end = this.fishingTarget.pos;
    const progress = Math.min(this.fishingTimer / this.fishingWaitDuration, 1);

    ctx.save();

    ctx.strokeStyle = 'rgba(220, 220, 220, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);

    const midX = (start.x + end.x) / 2;
    const sagAmount = 20 + 10 * Math.sin(time * 2);
    const midY = Math.max(start.y, end.y) + sagAmount;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(midX, midY, end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const bobX = end.x + Math.sin(time * 4) * 3;
    const bobY = end.y - 4 + Math.cos(time * 3) * 2;
    ctx.fillStyle = '#FF3B30';
    ctx.beginPath();
    ctx.arc(bobX, bobY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bobX - 0.5, bobY - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    const nearCatch = progress > 0.7;
    if (nearCatch) {
      const flashAlpha = 0.3 + 0.3 * Math.sin(time * 8);
      ctx.fillStyle = `rgba(255, 255, 100, ${flashAlpha})`;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 8 + 4 * Math.sin(time * 6), 0, Math.PI * 2);
      ctx.fill();

      const exciteMarks = 3;
      for (let i = 0; i < exciteMarks; i++) {
        const angle = time * 5 + (i * Math.PI * 2) / exciteMarks;
        const markDist = 12 + 4 * Math.sin(time * 7);
        const mx = end.x + Math.cos(angle) * markDist;
        const my = end.y + Math.sin(angle) * markDist;
        ctx.fillStyle = `rgba(255, 255, 100, ${flashAlpha})`;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', mx, my);
      }
    }

    const barWidth = 40;
    const barHeight = 4;
    const barX = start.x - barWidth / 2;
    const barY = start.y - 20;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const fillColor = nearCatch ? '#FFD60A' : '#0A84FF';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.restore();
  }

  renderFishingUI(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.lastCatch || this.lastCatchTimer <= 0) return;

    const progress = this.lastCatchTimer / CATCH_POPUP_DURATION;
    const alpha = Math.min(1, progress * 3);

    ctx.save();

    const boxWidth = 220;
    const boxHeight = 56;
    const boxX = (canvasWidth - boxWidth) / 2;
    const boxY = canvasHeight * 0.25;

    ctx.globalAlpha = alpha;

    const slideOffset = (1 - Math.min(1, (CATCH_POPUP_DURATION - this.lastCatchTimer + 0.3) / 0.3)) * 20;
    const drawY = boxY + slideOffset;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    const r = 8;
    ctx.moveTo(boxX + r, drawY);
    ctx.lineTo(boxX + boxWidth - r, drawY);
    ctx.quadraticCurveTo(boxX + boxWidth, drawY, boxX + boxWidth, drawY + r);
    ctx.lineTo(boxX + boxWidth, drawY + boxHeight - r);
    ctx.quadraticCurveTo(boxX + boxWidth, drawY + boxHeight, boxX + boxWidth - r, drawY + boxHeight);
    ctx.lineTo(boxX + r, drawY + boxHeight);
    ctx.quadraticCurveTo(boxX, drawY + boxHeight, boxX, drawY + boxHeight - r);
    ctx.lineTo(boxX, drawY + r);
    ctx.quadraticCurveTo(boxX, drawY, boxX + r, drawY);
    ctx.closePath();
    ctx.fill();

    let borderColor: string;
    let iconText: string;
    switch (this.lastCatch.type) {
      case 'shield_fish':
        borderColor = '#0A84FF';
        iconText = '\u{1F41F}';
        break;
      case 'health_fish':
        borderColor = '#30D158';
        iconText = '\u{1F41F}';
        break;
      case 'vendetta_fish':
        borderColor = '#BF5AF2';
        iconText = '\u{1F41F}';
        break;
      case 'junk':
        borderColor = '#8E8E93';
        iconText = '\u{1F5D1}';
        break;
      case 'legendary':
        borderColor = '#FF9F0A';
        iconText = '\u{1F3AF}';
        break;
    }

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxX + r, drawY);
    ctx.lineTo(boxX + boxWidth - r, drawY);
    ctx.quadraticCurveTo(boxX + boxWidth, drawY, boxX + boxWidth, drawY + r);
    ctx.lineTo(boxX + boxWidth, drawY + boxHeight - r);
    ctx.quadraticCurveTo(boxX + boxWidth, drawY + boxHeight, boxX + boxWidth - r, drawY + boxHeight);
    ctx.lineTo(boxX + r, drawY + boxHeight);
    ctx.quadraticCurveTo(boxX, drawY + boxHeight, boxX, drawY + boxHeight - r);
    ctx.lineTo(boxX, drawY + r);
    ctx.quadraticCurveTo(boxX, drawY, boxX + r, drawY);
    ctx.closePath();
    ctx.stroke();

    if (this.lastCatch.type === 'legendary') {
      const shimmer = 0.15 + 0.1 * Math.sin(Date.now() * 0.005);
      ctx.fillStyle = `rgba(255, 200, 50, ${shimmer})`;
      ctx.fill();
    }

    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconText, boxX + 24, drawY + boxHeight / 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(this.lastCatch.name, boxX + 46, drawY + 18);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#AAAAAA';
    let desc = '';
    switch (this.lastCatch.type) {
      case 'shield_fish':
        desc = `+${this.lastCatch.shieldAmount} Shield`;
        break;
      case 'health_fish':
        desc = `+${this.lastCatch.healthAmount} Health`;
        break;
      case 'vendetta_fish':
        desc = `Reveals enemies ${this.lastCatch.vendettaDuration}s`;
        break;
      case 'junk': {
        const m = this.lastCatch.materials;
        desc = `+${m?.wood ?? 0}W +${m?.brick ?? 0}B +${m?.metal ?? 0}M`;
        break;
      }
      case 'legendary':
        desc = 'LEGENDARY WEAPON!';
        ctx.fillStyle = '#FFD60A';
        break;
    }
    ctx.fillText(desc, boxX + 46, drawY + 34);

    ctx.restore();
  }
}
