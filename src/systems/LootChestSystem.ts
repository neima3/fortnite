import { vec2 } from '../utils/math.js';
import { CONFIG } from '../config.js';

export interface LootChest {
  id: string;
  pos: { x: number; y: number };
  state: 'closed' | 'opening' | 'opened';
  openTimer: number;
  items: any[];
  buildingId: string;
}

interface Building {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

interface LootItem {
  type: 'weapon' | 'shield' | 'materials';
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  pos: { x: number; y: number };
  velocity: { x: number; y: number };
  grounded: boolean;
}

const RARITY_WEIGHTS: Array<{ rarity: LootItem['rarity']; weight: number }> = [
  { rarity: 'common', weight: 10 },
  { rarity: 'uncommon', weight: 25 },
  { rarity: 'rare', weight: 35 },
  { rarity: 'epic', weight: 20 },
  { rarity: 'legendary', weight: 10 },
];

const WEAPON_NAMES = [
  'Assault Rifle',
  'Shotgun',
  'SMG',
  'Pistol',
  'Sniper Rifle',
  'Rocket Launcher',
  'Pump Shotgun',
  'Tactical Shotgun',
  'Burst Rifle',
  'Minigun',
];

const SHIELD_ITEMS = [
  { name: 'Small Shield Potion', amount: 25 },
  { name: 'Large Shield Potion', amount: 50 },
  { name: 'Shield Keg', amount: 100 },
];

const CHEST_INTERACTION_RADIUS = 40;
const CHEST_WIDTH = 28;
const CHEST_HEIGHT = 20;
const OPEN_DURATION = 0.5;
const ITEMS_PER_CHEST_MIN = 3;
const ITEMS_PER_CHEST_MAX = 5;

let chestIdCounter = 0;

function weightedRandomRarity(): LootItem['rarity'] {
  const totalWeight = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const { rarity, weight } of RARITY_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

function generateChestLoot(chestPos: { x: number; y: number }): LootItem[] {
  const count = ITEMS_PER_CHEST_MIN + Math.floor(Math.random() * (ITEMS_PER_CHEST_MAX - ITEMS_PER_CHEST_MIN + 1));
  const items: LootItem[] = [];

  const guaranteedRareRoll = Math.random();
  let guaranteedRarity: LootItem['rarity'];
  if (guaranteedRareRoll < 0.45) guaranteedRarity = 'rare';
  else if (guaranteedRareRoll < 0.75) guaranteedRarity = 'epic';
  else guaranteedRarity = 'legendary';

  const weaponName = WEAPON_NAMES[Math.floor(Math.random() * WEAPON_NAMES.length)];
  items.push({
    type: 'weapon',
    name: weaponName,
    rarity: guaranteedRarity,
    pos: { x: chestPos.x, y: chestPos.y },
    velocity: { x: 0, y: 0 },
    grounded: false,
  });

  for (let i = 1; i < count; i++) {
    const roll = Math.random();
    if (roll < 0.55) {
      items.push({
        type: 'weapon',
        name: WEAPON_NAMES[Math.floor(Math.random() * WEAPON_NAMES.length)],
        rarity: weightedRandomRarity(),
        pos: { x: chestPos.x, y: chestPos.y },
        velocity: { x: 0, y: 0 },
        grounded: false,
      });
    } else if (roll < 0.8) {
      const shield = SHIELD_ITEMS[Math.floor(Math.random() * SHIELD_ITEMS.length)];
      items.push({
        type: 'shield',
        name: shield.name,
        rarity: weightedRandomRarity(),
        pos: { x: chestPos.x, y: chestPos.y },
        velocity: { x: 0, y: 0 },
        grounded: false,
      });
    } else {
      items.push({
        type: 'materials',
        name: 'Materials',
        rarity: weightedRandomRarity(),
        pos: { x: chestPos.x, y: chestPos.y },
        velocity: { x: 0, y: 0 },
        grounded: false,
      });
    }
  }

  return items;
}

function assignBurstVelocities(items: LootItem[]): void {
  const total = items.length;
  for (let i = 0; i < total; i++) {
    const angle = -Math.PI / 2 + ((i / (total - 1 || 1)) - 0.5) * Math.PI * 0.8;
    const speed = 80 + Math.random() * 60;
    items[i].velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };
  }
}

export class LootChestSystem {
  private chests: LootChest[] = [];
  private flyingItems: LootItem[] = [];

  spawnChests(buildings: Array<Building>): void {
    this.chests = [];
    chestIdCounter = 0;

    const allCandidates: Array<{ pos: { x: number; y: number }; buildingId: string }> = [];

    for (const building of buildings) {
      const margin = 20;
      const innerW = Math.max(building.width - margin * 2, 30);
      const innerH = Math.max(building.height - margin * 2, 30);
      const chestCount = 1 + Math.floor(Math.random() * 3);

      for (let i = 0; i < chestCount; i++) {
        const cx = building.x + margin + Math.random() * innerW;
        const cy = building.y + margin + Math.random() * innerH;
        allCandidates.push({
          pos: { x: cx, y: cy },
          buildingId: building.name,
        });
      }
    }

    const targetTotal = 20 + Math.floor(Math.random() * 11);
    while (allCandidates.length > targetTotal) {
      const idx = Math.floor(Math.random() * allCandidates.length);
      allCandidates.splice(idx, 1);
    }

    for (const candidate of allCandidates) {
      this.chests.push({
        id: `chest_${chestIdCounter++}`,
        pos: candidate.pos,
        state: 'closed',
        openTimer: 0,
        items: generateChestLoot(candidate.pos),
        buildingId: candidate.buildingId,
      });
    }
  }

  tryOpen(playerPos: { x: number; y: number }, playerRadius: number): LootChest | null {
    for (const chest of this.chests) {
      if (chest.state !== 'closed') continue;
      const dx = playerPos.x - chest.pos.x;
      const dy = playerPos.y - chest.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= playerRadius + CHEST_INTERACTION_RADIUS) {
        chest.state = 'opening';
        chest.openTimer = 0;
        assignBurstVelocities(chest.items);
        for (const item of chest.items) {
          this.flyingItems.push({ ...item });
        }
        return chest;
      }
    }
    return null;
  }

  update(dt: number): void {
    for (const chest of this.chests) {
      if (chest.state === 'opening') {
        chest.openTimer += dt;
        if (chest.openTimer >= OPEN_DURATION) {
          chest.state = 'opened';
          chest.openTimer = OPEN_DURATION;
        }
      }
    }

    for (let i = this.flyingItems.length - 1; i >= 0; i--) {
      const item = this.flyingItems[i];
      if (item.grounded) continue;

      item.velocity.y += 300 * dt;
      item.pos.x += item.velocity.x * dt;
      item.pos.y += item.velocity.y * dt;

      if (item.pos.y >= item.pos.y || item.velocity.y > 0) {
        item.velocity.x *= Math.pow(0.92, dt * 60);
        if (Math.abs(item.velocity.x) < 2 && Math.abs(item.velocity.y) < 5) {
          item.grounded = true;
          item.velocity.x = 0;
          item.velocity.y = 0;
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    for (const chest of this.chests) {
      this.renderChest(ctx, chest, time);
    }
    this.renderFlyingItems(ctx, time);
  }

  private renderChest(ctx: CanvasRenderingContext2D, chest: LootChest, time: number): void {
    const { pos, state } = chest;
    const cx = pos.x;
    const cy = pos.y;

    if (state === 'closed') {
      this.renderClosedChest(ctx, cx, cy, time);
    } else if (state === 'opening') {
      this.renderOpeningChest(ctx, cx, cy, chest.openTimer, time);
    } else {
      this.renderOpenedChest(ctx, cx, cy);
    }
  }

  private renderClosedChest(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    const glowAlpha = 0.3 + 0.2 * pulse;
    const glowSize = 20 + 8 * pulse;

    ctx.save();
    ctx.shadowColor = `rgba(255, 200, 50, ${glowAlpha})`;
    ctx.shadowBlur = glowSize;

    ctx.fillStyle = `rgba(255, 210, 80, ${0.15 + 0.1 * pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy - 25, 4 + 2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    const beamAlpha = 0.08 + 0.06 * pulse;
    const grad = ctx.createLinearGradient(cx, cy - 50, cx, cy - 5);
    grad.addColorStop(0, `rgba(255, 215, 0, 0)`);
    grad.addColorStop(1, `rgba(255, 215, 0, ${beamAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 3, cy - 50, 6, 45);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = `rgba(255, 200, 50, ${glowAlpha * 0.8})`;
    ctx.shadowBlur = glowSize * 0.6;

    ctx.fillStyle = '#8B6914';
    ctx.fillRect(cx - CHEST_WIDTH / 2, cy - CHEST_HEIGHT / 2 + 3, CHEST_WIDTH, CHEST_HEIGHT - 3);

    const lidGrad = ctx.createLinearGradient(cx - CHEST_WIDTH / 2, cy - CHEST_HEIGHT / 2 - 4, cx - CHEST_WIDTH / 2, cy - CHEST_HEIGHT / 2 + 7);
    lidGrad.addColorStop(0, '#D4A017');
    lidGrad.addColorStop(0.5, '#C8961E');
    lidGrad.addColorStop(1, '#A07818');
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.moveTo(cx - CHEST_WIDTH / 2 - 1, cy - CHEST_HEIGHT / 2 + 7);
    ctx.lineTo(cx - CHEST_WIDTH / 2 - 1, cy - CHEST_HEIGHT / 2 + 2);
    ctx.quadraticCurveTo(cx, cy - CHEST_HEIGHT / 2 - 4, cx + CHEST_WIDTH / 2 + 1, cy - CHEST_HEIGHT / 2 + 2);
    ctx.lineTo(cx + CHEST_WIDTH / 2 + 1, cy - CHEST_HEIGHT / 2 + 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFD700';
    ctx.fillRect(cx - 2, cy - 2, 4, 6);
    ctx.fillRect(cx - 3, cy - 1, 6, 4);

    ctx.strokeStyle = '#A07818';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - CHEST_WIDTH / 2 + 2, cy - CHEST_HEIGHT / 2 + 9, CHEST_WIDTH - 4, 2);
    ctx.strokeRect(cx - CHEST_WIDTH / 2 + 2, cy + 2, CHEST_WIDTH - 4, 2);

    ctx.restore();
  }

  private renderOpeningChest(ctx: CanvasRenderingContext2D, cx: number, cy: number, openTimer: number, time: number): void {
    const progress = Math.min(openTimer / OPEN_DURATION, 1);
    const flashAlpha = Math.max(0, 1 - progress * 2);

    if (flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 230, 100, ${flashAlpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 40 * progress, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(cx - CHEST_WIDTH / 2, cy - CHEST_HEIGHT / 2 + 3, CHEST_WIDTH, CHEST_HEIGHT - 3);

    ctx.fillStyle = '#A07818';
    ctx.fillRect(cx - CHEST_WIDTH / 2 - 1, cy - CHEST_HEIGHT / 2 + 7, CHEST_WIDTH + 2, 3);

    const lidAngle = -progress * Math.PI * 0.7;
    ctx.translate(cx, cy - CHEST_HEIGHT / 2 + 7);
    ctx.rotate(lidAngle);
    const lidGrad = ctx.createLinearGradient(-CHEST_WIDTH / 2, -8, -CHEST_WIDTH / 2, 2);
    lidGrad.addColorStop(0, '#C8961E');
    lidGrad.addColorStop(1, '#8B6914');
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.moveTo(-CHEST_WIDTH / 2 - 1, 2);
    ctx.lineTo(-CHEST_WIDTH / 2 - 1, -3);
    ctx.quadraticCurveTo(0, -9, CHEST_WIDTH / 2 + 1, -3);
    ctx.lineTo(CHEST_WIDTH / 2 + 1, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private renderOpenedChest(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.globalAlpha = 0.5;

    ctx.fillStyle = '#3D2B1F';
    ctx.fillRect(cx - CHEST_WIDTH / 2, cy - CHEST_HEIGHT / 2 + 3, CHEST_WIDTH, CHEST_HEIGHT - 3);

    ctx.fillStyle = '#2C1E15';
    ctx.fillRect(cx - CHEST_WIDTH / 2 - 1, cy - CHEST_HEIGHT / 2 + 7, CHEST_WIDTH + 2, 3);

    ctx.translate(cx, cy - CHEST_HEIGHT / 2 + 7);
    ctx.rotate(-Math.PI * 0.7);
    ctx.fillStyle = '#3D2B1F';
    ctx.beginPath();
    ctx.moveTo(-CHEST_WIDTH / 2 - 1, 2);
    ctx.lineTo(-CHEST_WIDTH / 2 - 1, -3);
    ctx.quadraticCurveTo(0, -9, CHEST_WIDTH / 2 + 1, -3);
    ctx.lineTo(CHEST_WIDTH / 2 + 1, 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderFlyingItems(ctx: CanvasRenderingContext2D, time: number): void {
    for (const item of this.flyingItems) {
      if (item.grounded) {
        this.renderGroundedItem(ctx, item, time);
      } else {
        this.renderAirborneItem(ctx, item, time);
      }
    }
  }

  private renderGroundedItem(ctx: CanvasRenderingContext2D, item: LootItem, time: number): void {
    const bob = Math.sin(time * 2 + item.pos.x * 0.1) * 2;
    const rarityColor = this.getRarityColor(item.rarity);

    ctx.save();
    ctx.shadowColor = rarityColor;
    ctx.shadowBlur = 6;

    ctx.fillStyle = rarityColor;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(item.pos.x, item.pos.y + 4, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = rarityColor;
    ctx.fillRect(item.pos.x - 6, item.pos.y - 6 + bob, 12, 10);

    ctx.fillStyle = '#FFF';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    const icon = item.type === 'weapon' ? 'W' : item.type === 'shield' ? 'S' : 'M';
    ctx.fillText(icon, item.pos.x, item.pos.y + bob);

    ctx.restore();
  }

  private renderAirborneItem(ctx: CanvasRenderingContext2D, item: LootItem, time: number): void {
    const rarityColor = this.getRarityColor(item.rarity);

    ctx.save();
    ctx.shadowColor = rarityColor;
    ctx.shadowBlur = 8;

    const rotation = time * 8 + item.pos.x;
    ctx.translate(item.pos.x, item.pos.y);
    ctx.rotate(rotation);

    ctx.fillStyle = rarityColor;
    ctx.fillRect(-5, -5, 10, 10);

    ctx.fillStyle = '#FFF';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-3, -1, 6, 2);

    ctx.restore();
  }

  private getRarityColor(rarity: LootItem['rarity']): string {
    switch (rarity) {
      case 'common': return '#B0B0B0';
      case 'uncommon': return '#30D158';
      case 'rare': return '#0A84FF';
      case 'epic': return '#BF5AF2';
      case 'legendary': return '#FF9F0A';
    }
  }

  getChests(): LootChest[] {
    return this.chests;
  }

  getFlyingItems(): LootItem[] {
    return this.flyingItems;
  }

  clearGroundedItems(): LootItem[] {
    const grounded = this.flyingItems.filter(i => i.grounded);
    this.flyingItems = this.flyingItems.filter(i => !i.grounded);
    return grounded;
  }
}
