import { vec2 } from '../utils/math.js';

export interface UpgradeBench {
  id: string;
  pos: { x: number; y: number };
  active: boolean;
  upgrading: boolean;
  upgradeProgress: number;
  upgradeDuration: number;
  selectedSlot: number;
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RARITY_COLORS: Record<string, string> = {
  common: '#B0B0B0',
  uncommon: '#30D158',
  rare: '#0A84FF',
  epic: '#BF5AF2',
  legendary: '#FF9F0A',
};

const RARITY_MULTIPLIERS: Record<string, number> = {
  common: 1,
  uncommon: 1.1,
  rare: 1.2,
  epic: 1.35,
  legendary: 1.5,
};

const BENCH_INTERACTION_RADIUS = 50;
const BENCH_WIDTH = 40;
const BENCH_HEIGHT = 28;
const UPGRADE_DURATION = 1.0;
const NUM_BENCHES_MIN = 4;
const NUM_BENCHES_MAX = 6;

let benchIdCounter = 0;

function getUpgradeCost(currentRarity: string): { wood: number; brick: number; metal: number } | null {
  switch (currentRarity) {
    case 'common': return { wood: 50, brick: 50, metal: 0 };
    case 'uncommon': return { wood: 100, brick: 100, metal: 0 };
    case 'rare': return { wood: 0, brick: 150, metal: 150 };
    case 'epic': return { wood: 0, brick: 0, metal: 200 };
    default: return null;
  }
}

function getNextRarity(currentRarity: string): string | null {
  const idx = RARITY_ORDER.indexOf(currentRarity);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

function canAfford(materials: { wood: number; brick: number; metal: number }, cost: { wood: number; brick: number; metal: number }): boolean {
  return materials.wood >= cost.wood && materials.brick >= cost.brick && materials.metal >= cost.metal;
}

export class UpgradeBenchSystem {
  private benches: UpgradeBench[] = [];
  private menuOpen: boolean = false;
  private activeBench: UpgradeBench | null = null;
  private pendingWeapon: any | null = null;
  private pendingSlot: number = -1;

  spawnBenches(buildings: Array<{ x: number; y: number; width: number; height: number; name: string }>): void {
    this.benches = [];
    benchIdCounter = 0;

    if (buildings.length === 0) return;

    const numBenches = NUM_BENCHES_MIN + Math.floor(Math.random() * (NUM_BENCHES_MAX - NUM_BENCHES_MIN + 1));
    const shuffled = [...buildings].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(numBenches, shuffled.length));

    for (const building of selected) {
      const edge = Math.floor(Math.random() * 4);
      let bx: number;
      let by: number;

      switch (edge) {
        case 0:
          bx = building.x + Math.random() * building.width;
          by = building.y - BENCH_HEIGHT / 2 - 5;
          break;
        case 1:
          bx = building.x + Math.random() * building.width;
          by = building.y + building.height + BENCH_HEIGHT / 2 + 5;
          break;
        case 2:
          bx = building.x - BENCH_WIDTH / 2 - 5;
          by = building.y + Math.random() * building.height;
          break;
        default:
          bx = building.x + building.width + BENCH_WIDTH / 2 + 5;
          by = building.y + Math.random() * building.height;
          break;
      }

      this.benches.push({
        id: `bench_${benchIdCounter++}`,
        pos: { x: bx, y: by },
        active: true,
        upgrading: false,
        upgradeProgress: 0,
        upgradeDuration: UPGRADE_DURATION,
        selectedSlot: -1,
      });
    }
  }

  tryInteract(playerPos: { x: number; y: number }, playerRadius: number): UpgradeBench | null {
    for (const bench of this.benches) {
      if (!bench.active || bench.upgrading) continue;
      const dx = playerPos.x - bench.pos.x;
      const dy = playerPos.y - bench.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= playerRadius + BENCH_INTERACTION_RADIUS) {
        this.menuOpen = true;
        this.activeBench = bench;
        return bench;
      }
    }
    return null;
  }

  startUpgrade(slotIndex: number, playerInventory: (any | null)[]): boolean {
    if (!this.activeBench || this.activeBench.upgrading) return false;
    if (slotIndex < 0 || slotIndex >= playerInventory.length) return false;

    const weapon = playerInventory[slotIndex];
    if (!weapon || !weapon.rarity) return false;

    const nextRarity = getNextRarity(weapon.rarity);
    if (!nextRarity) return false;

    const cost = getUpgradeCost(weapon.rarity);
    if (!cost) return false;

    this.activeBench.upgrading = true;
    this.activeBench.upgradeProgress = 0;
    this.activeBench.selectedSlot = slotIndex;
    this.pendingWeapon = weapon;
    this.pendingSlot = slotIndex;
    return true;
  }

  update(dt: number): any | null {
    if (!this.activeBench || !this.activeBench.upgrading) return null;

    this.activeBench.upgradeProgress += dt;

    if (this.activeBench.upgradeProgress >= this.activeBench.upgradeDuration) {
      const weapon = this.pendingWeapon;
      const slot = this.pendingSlot;

      if (weapon && weapon.rarity) {
        const currentRarity = weapon.rarity;
        const nextRarity = getNextRarity(currentRarity);

        if (nextRarity) {
          const baseDmg = weapon.damage / RARITY_MULTIPLIERS[currentRarity];
          weapon.rarity = nextRarity;
          weapon.damage = Math.round(baseDmg * RARITY_MULTIPLIERS[nextRarity]);
        }
      }

      this.activeBench.upgrading = false;
      this.activeBench.upgradeProgress = 0;
      this.activeBench.selectedSlot = -1;
      this.pendingWeapon = null;
      this.pendingSlot = -1;

      return weapon;
    }

    return null;
  }

  closeMenu(): void {
    this.menuOpen = false;
    if (this.activeBench) {
      this.activeBench.upgrading = false;
      this.activeBench.upgradeProgress = 0;
      this.activeBench.selectedSlot = -1;
    }
    this.activeBench = null;
    this.pendingWeapon = null;
    this.pendingSlot = -1;
  }

  isMenuOpen(): boolean {
    return this.menuOpen;
  }

  getBenches(): UpgradeBench[] {
    return this.benches;
  }

  getActiveBench(): UpgradeBench | null {
    return this.activeBench;
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    for (const bench of this.benches) {
      this.renderBench(ctx, bench, time);
    }
  }

  private renderBench(ctx: CanvasRenderingContext2D, bench: UpgradeBench, time: number): void {
    const cx = bench.pos.x;
    const cy = bench.pos.y;

    const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
    const glowAlpha = 0.15 + 0.1 * pulse;
    const glowSize = 15 + 6 * pulse;

    ctx.save();

    if (bench.upgrading) {
      ctx.shadowColor = 'rgba(255, 200, 50, 0.6)';
      ctx.shadowBlur = 25 + 10 * Math.sin(time * 8);
    } else {
      ctx.shadowColor = `rgba(255, 200, 50, ${glowAlpha})`;
      ctx.shadowBlur = glowSize;
    }

    ctx.fillStyle = '#8B6914';
    ctx.fillRect(cx - BENCH_WIDTH / 2, cy - 2, BENCH_WIDTH, BENCH_HEIGHT / 2 + 2);

    const topGrad = ctx.createLinearGradient(cx - BENCH_WIDTH / 2, cy - 6, cx - BENCH_WIDTH / 2, cy + 2);
    topGrad.addColorStop(0, '#FFD700');
    topGrad.addColorStop(0.4, '#DAA520');
    topGrad.addColorStop(1, '#B8860B');
    ctx.fillStyle = topGrad;
    ctx.fillRect(cx - BENCH_WIDTH / 2 - 2, cy - 6, BENCH_WIDTH + 4, 8);

    ctx.strokeStyle = '#A07818';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - BENCH_WIDTH / 2 - 2, cy - 6, BENCH_WIDTH + 4, 8);

    ctx.fillStyle = '#DAA520';
    ctx.fillRect(cx - BENCH_WIDTH / 2, cy - 4, BENCH_WIDTH, 1);

    ctx.restore();

    ctx.save();
    const anvilGrad = ctx.createLinearGradient(cx - 8, cy - 18, cx - 8, cy - 6);
    anvilGrad.addColorStop(0, '#C0C0C0');
    anvilGrad.addColorStop(0.5, '#A0A0A0');
    anvilGrad.addColorStop(1, '#808080');
    ctx.fillStyle = anvilGrad;

    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 6);
    ctx.lineTo(cx - 10, cy - 12);
    ctx.lineTo(cx - 6, cy - 18);
    ctx.lineTo(cx + 6, cy - 18);
    ctx.lineTo(cx + 10, cy - 12);
    ctx.lineTo(cx + 8, cy - 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#909090';
    ctx.fillRect(cx - 5, cy - 18, 10, 2);

    ctx.fillStyle = '#707070';
    ctx.fillRect(cx - 3, cy - 10, 2, 4);
    ctx.fillRect(cx + 1, cy - 10, 2, 4);

    ctx.restore();

    if (bench.upgrading) {
      ctx.save();
      const progress = bench.upgradeProgress / bench.upgradeDuration;
      const barWidth = BENCH_WIDTH + 10;
      const barHeight = 4;
      const barX = cx - barWidth / 2;
      const barY = cy + BENCH_HEIGHT / 2 + 6;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      const progGrad = ctx.createLinearGradient(barX, barY, barX + barWidth * progress, barY);
      progGrad.addColorStop(0, '#FFD700');
      progGrad.addColorStop(1, '#FFA500');
      ctx.fillStyle = progGrad;
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);

      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      ctx.restore();
    }

    ctx.save();
    const sparkleAlpha = 0.3 + 0.3 * Math.sin(time * 4);
    ctx.fillStyle = `rgba(255, 255, 200, ${sparkleAlpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy - 22, 2 + pulse, 0, Math.PI * 2);
    ctx.fill();

    const beamAlpha = 0.04 + 0.03 * pulse;
    const beamGrad = ctx.createLinearGradient(cx, cy - 40, cx, cy - 20);
    beamGrad.addColorStop(0, `rgba(255, 215, 0, 0)`);
    beamGrad.addColorStop(1, `rgba(255, 215, 0, ${beamAlpha})`);
    ctx.fillStyle = beamGrad;
    ctx.fillRect(cx - 2, cy - 40, 4, 20);
    ctx.restore();
  }

  renderMenu(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    playerInventory: (any | null)[],
    playerMaterials: { wood: number; brick: number; metal: number }
  ): void {
    if (!this.menuOpen) return;

    const menuWidth = 420;
    const menuHeight = 340;
    const menuX = (canvasWidth - menuWidth) / 2;
    const menuY = (canvasHeight - menuHeight) / 2;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
    this.roundRect(ctx, menuX, menuY, menuWidth, menuHeight, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, menuX, menuY, menuWidth, menuHeight, 8);
    ctx.stroke();

    const titleGrad = ctx.createLinearGradient(menuX + 50, 0, menuX + menuWidth - 50, 0);
    titleGrad.addColorStop(0, '#FFD700');
    titleGrad.addColorStop(0.5, '#FFF8DC');
    titleGrad.addColorStop(1, '#FFD700');
    ctx.fillStyle = titleGrad;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADE BENCH', menuX + menuWidth / 2, menuY + 30);

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(menuX + 20, menuY + 42);
    ctx.lineTo(menuX + menuWidth - 20, menuY + 42);
    ctx.stroke();

    ctx.fillStyle = '#AAA';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Wood: ${playerMaterials.wood}`, menuX + 20, menuY + 60);
    ctx.fillText(`Brick: ${playerMaterials.brick}`, menuX + 150, menuY + 60);
    ctx.fillText(`Metal: ${playerMaterials.metal}`, menuX + 280, menuY + 60);

    const isUpgrading = this.activeBench?.upgrading ?? false;
    const upgradingSlot = this.activeBench?.selectedSlot ?? -1;

    const slotWidth = 76;
    const slotHeight = 220;
    const slotStartX = menuX + (menuWidth - 5 * slotWidth - 4 * 8) / 2;
    const slotStartY = menuY + 75;

    for (let i = 0; i < 5; i++) {
      const sx = slotStartX + i * (slotWidth + 8);
      const sy = slotStartY;
      const weapon = playerInventory[i] as any | null;

      ctx.fillStyle = isUpgrading && upgradingSlot === i
        ? 'rgba(255, 215, 0, 0.15)'
        : 'rgba(50, 50, 60, 0.8)';
      this.roundRect(ctx, sx, sy, slotWidth, slotHeight, 4);
      ctx.fill();

      ctx.strokeStyle = isUpgrading && upgradingSlot === i
        ? 'rgba(255, 215, 0, 0.8)'
        : 'rgba(100, 100, 110, 0.6)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, sx, sy, slotWidth, slotHeight, 4);
      ctx.stroke();

      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Slot ${i + 1}`, sx + slotWidth / 2, sy + 14);

      if (weapon && weapon.rarity) {
        const rarityColor = RARITY_COLORS[weapon.rarity] || '#888';

        ctx.save();
        ctx.shadowColor = rarityColor;
        ctx.shadowBlur = 6;
        ctx.fillStyle = rarityColor;
        ctx.globalAlpha = 0.2;
        this.roundRect(ctx, sx + 4, sy + 20, slotWidth - 8, 50, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        ctx.fillStyle = '#DDD';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        const displayName = weapon.name.length > 12 ? weapon.name.substring(0, 11) + '..' : weapon.name;
        ctx.fillText(displayName, sx + slotWidth / 2, sy + 38);

        ctx.fillStyle = rarityColor;
        ctx.font = 'bold 9px monospace';
        ctx.fillText(weapon.rarity.toUpperCase(), sx + slotWidth / 2, sy + 52);

        ctx.fillStyle = '#CCC';
        ctx.font = '9px monospace';
        ctx.fillText(`DMG: ${weapon.damage}`, sx + slotWidth / 2, sy + 66);

        const nextRarity = getNextRarity(weapon.rarity);
        if (nextRarity) {
          const cost = getUpgradeCost(weapon.rarity)!;
          const nextColor = RARITY_COLORS[nextRarity] || '#888';
          const affordable = canAfford(playerMaterials, cost);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(sx + 8, sy + 78);
          ctx.lineTo(sx + slotWidth - 8, sy + 78);
          ctx.stroke();

          ctx.fillStyle = '#999';
          ctx.font = '8px monospace';
          ctx.fillText('UPGRADE TO', sx + slotWidth / 2, sy + 90);

          ctx.fillStyle = nextColor;
          ctx.font = 'bold 9px monospace';
          ctx.fillText(nextRarity.toUpperCase(), sx + slotWidth / 2, sy + 103);

          const newDmg = Math.round((weapon.damage / RARITY_MULTIPLIERS[weapon.rarity]) * RARITY_MULTIPLIERS[nextRarity]);
          ctx.fillStyle = '#0F0';
          ctx.font = '8px monospace';
          ctx.fillText(`DMG: ${weapon.damage} → ${newDmg}`, sx + slotWidth / 2, sy + 116);

          ctx.fillStyle = affordable ? '#CCC' : '#F44';
          ctx.font = '7px monospace';

          let costY = sy + 132;
          if (cost.wood > 0) {
            ctx.fillText(`🪵 ${cost.wood}`, sx + slotWidth / 2, costY);
            costY += 12;
          }
          if (cost.brick > 0) {
            ctx.fillText(`🧱 ${cost.brick}`, sx + slotWidth / 2, costY);
            costY += 12;
          }
          if (cost.metal > 0) {
            ctx.fillText(`⚙ ${cost.metal}`, sx + slotWidth / 2, costY);
            costY += 12;
          }

          if (isUpgrading && upgradingSlot === i) {
            const progress = this.activeBench!.upgradeProgress / this.activeBench!.upgradeDuration;
            const barW = slotWidth - 12;
            const barH = 6;
            const barX = sx + 6;
            const barY = sy + slotHeight - 18;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, barY, barW, barH);

            const progGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
            progGrad.addColorStop(0, '#FFD700');
            progGrad.addColorStop(1, '#FFA500');
            ctx.fillStyle = progGrad;
            ctx.fillRect(barX, barY, barW * progress, barH);

            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, barY, barW, barH);
          } else if (!isUpgrading) {
            const btnColor = affordable ? 'rgba(255, 215, 0, 0.8)' : 'rgba(100, 100, 100, 0.5)';
            ctx.fillStyle = btnColor;
            this.roundRect(ctx, sx + 6, sy + slotHeight - 20, slotWidth - 12, 14, 3);
            ctx.fill();

            ctx.fillStyle = affordable ? '#000' : '#666';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('UPGRADE', sx + slotWidth / 2, sy + slotHeight - 10);
          }
        } else {
          ctx.fillStyle = '#FF9F0A';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('MAX TIER', sx + slotWidth / 2, sy + 95);

          ctx.fillStyle = '#FFD700';
          ctx.font = '8px monospace';
          ctx.fillText('★ ★ ★', sx + slotWidth / 2, sy + 112);
        }
      } else {
        ctx.fillStyle = '#555';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Empty', sx + slotWidth / 2, sy + 50);
        ctx.fillText('Slot', sx + slotWidth / 2, sy + 64);
      }
    }

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Click a slot to upgrade • Press ESC to close', menuX + menuWidth / 2, menuY + menuHeight - 12);

    ctx.restore();
  }

  handleMenuClick(
    clickX: number,
    clickY: number,
    canvasWidth: number,
    canvasHeight: number,
    playerInventory: (any | null)[],
    playerMaterials: { wood: number; brick: number; metal: number }
  ): boolean {
    if (!this.menuOpen || !this.activeBench) return false;
    if (this.activeBench.upgrading) return false;

    const menuWidth = 420;
    const menuHeight = 340;
    const menuX = (canvasWidth - menuWidth) / 2;
    const menuY = (canvasHeight - menuHeight) / 2;

    const slotWidth = 76;
    const slotHeight = 220;
    const slotStartX = menuX + (menuWidth - 5 * slotWidth - 4 * 8) / 2;
    const slotStartY = menuY + 75;

    for (let i = 0; i < 5; i++) {
      const sx = slotStartX + i * (slotWidth + 8);
      const sy = slotStartY;

      if (clickX >= sx && clickX <= sx + slotWidth && clickY >= sy && clickY <= sy + slotHeight) {
        const weapon = playerInventory[i];
        if (!weapon || !weapon.rarity) return false;
        if (!getNextRarity(weapon.rarity)) return false;

        const cost = getUpgradeCost(weapon.rarity);
        if (!cost) return false;
        if (!canAfford(playerMaterials, cost)) return false;

        playerMaterials.wood -= cost.wood;
        playerMaterials.brick -= cost.brick;
        playerMaterials.metal -= cost.metal;

        return this.startUpgrade(i, playerInventory);
      }
    }

    return false;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
