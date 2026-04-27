import { vec2 } from '../utils/math.js';
import { CONFIG } from '../config.js';

export interface NPCVendor {
  id: string;
  pos: { x: number; y: number };
  type: 'weaponsmith' | 'healer' | 'blacksmith';
  name: string;
  items: ShopItem[];
  alive: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: { wood?: number; brick?: number; metal?: number };
  itemType: 'weapon' | 'consumable' | 'material';
  weaponType?: string;
  rarity?: string;
  healAmount?: number;
  materialType?: string;
  materialAmount?: number;
}

const WEAPONSMITH_NAMES = ['Rex', 'Blaze', 'Flint', 'Ash', 'Forge'];
const HEALER_NAMES = ['Sage', 'Dawn', 'Clover', 'Remed', 'Aura'];
const BLACKSMITH_NAMES = ['Bolder', 'Slate', 'Grit', 'Iron', 'Mason'];

const RARITY_COLORS: Record<string, string> = {
  common: '#b0b0b0',
  uncommon: '#30d158',
  rare: '#0a84ff',
  epic: '#bf5af2',
  legendary: '#ff9f0a',
};

function createWeaponsmithItems(): ShopItem[] {
  return [
    {
      id: 'ws_rare_ar',
      name: 'Rare Assault Rifle',
      description: 'Reliable full-auto rifle. Good damage and accuracy.',
      cost: { wood: 100 },
      itemType: 'weapon',
      weaponType: 'assault_rifle',
      rarity: 'rare',
    },
    {
      id: 'ws_epic_sg',
      name: 'Epic Shotgun',
      description: 'Devastating close-range spread. High burst damage.',
      cost: { brick: 200 },
      itemType: 'weapon',
      weaponType: 'shotgun',
      rarity: 'epic',
    },
    {
      id: 'ws_leg_pistol',
      name: 'Legendary Pistol',
      description: 'Precision sidearm. Exceptional headshot multiplier.',
      cost: { metal: 150 },
      itemType: 'weapon',
      weaponType: 'pistol',
      rarity: 'legendary',
    },
  ];
}

function createHealerItems(): ShopItem[] {
  return [
    {
      id: 'hl_medkit',
      name: 'Medkit',
      description: 'Restores a chunk of health instantly.',
      cost: { wood: 50 },
      itemType: 'consumable',
      healAmount: 50,
      rarity: 'uncommon',
    },
    {
      id: 'hl_shield',
      name: 'Shield Potion',
      description: 'Grants additional shield protection.',
      cost: { brick: 50 },
      itemType: 'consumable',
      healAmount: 50,
      rarity: 'rare',
    },
    {
      id: 'hl_chug',
      name: 'Chug Jug',
      description: 'Fully restores health and shield.',
      cost: { wood: 67, brick: 67, metal: 66 },
      itemType: 'consumable',
      healAmount: 200,
      rarity: 'legendary',
    },
  ];
}

function createBlacksmithItems(): ShopItem[] {
  return [
    {
      id: 'bs_wood',
      name: '200 Wood',
      description: 'Bundle of 200 wood building materials.',
      cost: { brick: 30 },
      itemType: 'material',
      materialType: 'wood',
      materialAmount: 200,
      rarity: 'uncommon',
    },
    {
      id: 'bs_brick',
      name: '200 Brick',
      description: 'Bundle of 200 brick building materials.',
      cost: { metal: 30 },
      itemType: 'material',
      materialType: 'brick',
      materialAmount: 200,
      rarity: 'uncommon',
    },
    {
      id: 'bs_metal',
      name: '200 Metal',
      description: 'Bundle of 200 metal building materials.',
      cost: { wood: 30 },
      itemType: 'material',
      materialType: 'metal',
      materialAmount: 200,
      rarity: 'uncommon',
    },
  ];
}

const NPC_COLORS: Record<string, string> = {
  weaponsmith: '#e63946',
  healer: '#2ec4b6',
  blacksmith: '#8d5524',
};

const NPC_RADIUS = 18;
const INTERACT_RANGE = 60;

export class NPCSystem {
  private npcs: NPCVendor[] = [];
  private shopOpen: boolean = false;
  private activeNPC: NPCVendor | null = null;
  private chatBubblePhase: number = 0;
  private glowPhase: number = 0;
  private hoveredItem: number = -1;

  spawnNPCs(buildings: Array<{ x: number; y: number; width: number; height: number; name: string }>): void {
    this.npcs = [];

    const shuffled = [...buildings].sort(() => Math.random() - 0.5);
    const count = Math.min(Math.floor(Math.random() * 3) + 3, shuffled.length);

    const types: Array<'weaponsmith' | 'healer' | 'blacksmith'> = ['weaponsmith', 'healer', 'blacksmith'];
    const allNames = {
      weaponsmith: [...WEAPONSMITH_NAMES].sort(() => Math.random() - 0.5),
      healer: [...HEALER_NAMES].sort(() => Math.random() - 0.5),
      blacksmith: [...BLACKSMITH_NAMES].sort(() => Math.random() - 0.5),
    };
    const nameIdx = { weaponsmith: 0, healer: 0, blacksmith: 0 };

    for (let i = 0; i < count; i++) {
      const b = shuffled[i];
      const type = types[i % 3];
      const nameList = allNames[type];
      const name = nameList[nameIdx[type]++ % nameList.length];

      const items =
        type === 'weaponsmith'
          ? createWeaponsmithItems()
          : type === 'healer'
            ? createHealerItems()
            : createBlacksmithItems();

      this.npcs.push({
        id: `npc_${type}_${i}`,
        pos: {
          x: b.x + b.width / 2 + (Math.random() - 0.5) * 40,
          y: b.y + b.height + 20,
        },
        type,
        name,
        items,
        alive: true,
      });
    }
  }

  tryInteract(playerPos: { x: number; y: number }, playerRadius: number): NPCVendor | null {
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const dx = npc.pos.x - playerPos.x;
      const dy = npc.pos.y - playerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INTERACT_RANGE + playerRadius) {
        this.activeNPC = npc;
        this.shopOpen = true;
        this.hoveredItem = -1;
        return npc;
      }
    }
    return null;
  }

  buyItem(
    npcId: string,
    itemIndex: number,
    playerMaterials: { wood: number; brick: number; metal: number }
  ): { success: boolean; item?: any; cost?: { wood: number; brick: number; metal: number } } {
    const npc = this.npcs.find((n) => n.id === npcId);
    if (!npc || !npc.alive) return { success: false };
    if (itemIndex < 0 || itemIndex >= npc.items.length) return { success: false };

    const item = npc.items[itemIndex];
    const cost = item.cost;

    if (
      (cost.wood ?? 0) > playerMaterials.wood ||
      (cost.brick ?? 0) > playerMaterials.brick ||
      (cost.metal ?? 0) > playerMaterials.metal
    ) {
      return { success: false };
    }

    const deducted = {
      wood: cost.wood ?? 0,
      brick: cost.brick ?? 0,
      metal: cost.metal ?? 0,
    };

    const resultItem: any = {
      id: item.id,
      name: item.name,
      itemType: item.itemType,
    };

    if (item.itemType === 'weapon') {
      resultItem.weaponType = item.weaponType;
      resultItem.rarity = item.rarity;
    } else if (item.itemType === 'consumable') {
      resultItem.healAmount = item.healAmount;
      resultItem.rarity = item.rarity;
    } else if (item.itemType === 'material') {
      resultItem.materialType = item.materialType;
      resultItem.materialAmount = item.materialAmount;
    }

    return { success: true, item: resultItem, cost: deducted };
  }

  closeShop(): void {
    this.shopOpen = false;
    this.activeNPC = null;
    this.hoveredItem = -1;
  }

  isShopOpen(): boolean {
    return this.shopOpen;
  }

  getActiveNPC(): NPCVendor | null {
    return this.activeNPC;
  }

  getNPCs(): NPCVendor[] {
    return this.npcs;
  }

  update(dt: number): void {
    this.chatBubblePhase += dt * 3;
    this.glowPhase += dt * 2;
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      this.renderNPC(ctx, npc, time);
    }
  }

  private renderNPC(ctx: CanvasRenderingContext2D, npc: NPCVendor, time: number): void {
    const x = npc.pos.x;
    const y = npc.pos.y;
    const color = NPC_COLORS[npc.type];

    const glowAlpha = 0.3 + 0.15 * Math.sin(this.glowPhase + npc.pos.x * 0.01);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, NPC_RADIUS + 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 0, ${glowAlpha})`;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, NPC_RADIUS + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, NPC_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    this.renderNPCHat(ctx, npc, x, y);

    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(npc.name, x, y - NPC_RADIUS - 22);
    ctx.fillText(npc.name, x, y - NPC_RADIUS - 22);

    ctx.font = '8px monospace';
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(npc.type.toUpperCase(), x, y - NPC_RADIUS - 12);
    ctx.fillText(npc.type.toUpperCase(), x, y - NPC_RADIUS - 12);
    ctx.restore();

    const bobY = Math.sin(this.chatBubblePhase) * 2;
    this.renderChatBubble(ctx, x + NPC_RADIUS + 2, y - NPC_RADIUS + bobY - 4);
  }

  private renderNPCHat(ctx: CanvasRenderingContext2D, npc: NPCVendor, x: number, y: number): void {
    ctx.save();
    if (npc.type === 'weaponsmith') {
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.moveTo(x - 12, y - NPC_RADIUS + 2);
      ctx.lineTo(x, y - NPC_RADIUS - 14);
      ctx.lineTo(x + 12, y - NPC_RADIUS + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (npc.type === 'healer') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y - NPC_RADIUS - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ec4b6';
      ctx.fillRect(x - 1.5, y - NPC_RADIUS - 8, 3, 10);
      ctx.fillRect(x - 5, y - NPC_RADIUS - 5, 10, 3);
    } else if (npc.type === 'blacksmith') {
      ctx.fillStyle = '#5a3e1b';
      ctx.fillRect(x - 11, y - NPC_RADIUS - 2, 22, 4);
      ctx.fillRect(x - 7, y - NPC_RADIUS - 8, 14, 8);
      ctx.strokeStyle = '#3a2510';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 11, y - NPC_RADIUS - 2, 22, 4);
      ctx.strokeRect(x - 7, y - NPC_RADIUS - 8, 14, 8);
    }
    ctx.restore();
  }

  private renderChatBubble(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.ellipse(x + 7, y, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 1, y + 5);
    ctx.lineTo(x - 2, y + 10);
    ctx.lineTo(x + 5, y + 6);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x + 7, y);
    ctx.restore();
  }

  renderInteractPrompt(ctx: CanvasRenderingContext2D, playerPos: { x: number; y: number }, playerRadius: number): void {
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const dx = npc.pos.x - playerPos.x;
      const dy = npc.pos.y - playerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INTERACT_RANGE + playerRadius) {
        ctx.save();
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const text = 'Press F to shop';
        const tw = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(npc.pos.x - tw / 2 - 6, npc.pos.y - NPC_RADIUS - 44, tw + 12, 18);

        ctx.fillStyle = '#ffd700';
        ctx.fillText(text, npc.pos.x, npc.pos.y - NPC_RADIUS - 30);
        ctx.restore();
        break;
      }
    }
  }

  setHoveredItem(index: number): void {
    this.hoveredItem = index;
  }

  getHoveredItem(): number {
    return this.hoveredItem;
  }

  renderShop(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    playerMaterials: { wood: number; brick: number; metal: number }
  ): void {
    if (!this.shopOpen || !this.activeNPC) return;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const shopW = Math.min(480, canvasWidth - 40);
    const shopH = Math.min(380, canvasHeight - 40);
    const shopX = (canvasWidth - shopW) / 2;
    const shopY = (canvasHeight - shopH) / 2;

    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(shopX, shopY, shopW, shopH, 12);
    ctx.fill();
    ctx.stroke();

    const npc = this.activeNPC;
    const npcColor = NPC_COLORS[npc.type];

    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = npcColor;
    ctx.fillText(`${npc.name}'s Shop`, shopX + shopW / 2, shopY + 14);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText(npc.type.toUpperCase(), shopX + shopW / 2, shopY + 34);

    this.renderMaterialBar(ctx, shopX + shopW / 2 - 120, shopY + 52, 240, playerMaterials);

    const cardW = (shopW - 40) / npc.items.length - 8;
    const cardH = shopH - 120;
    const cardsY = shopY + 90;

    for (let i = 0; i < npc.items.length; i++) {
      const cardX = shopX + 20 + i * (cardW + 8);
      this.renderItemCard(ctx, npc.items[i], cardX, cardsY, cardW, cardH, i === this.hoveredItem, playerMaterials);
    }

    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.fillText('Click item to purchase  |  Press ESC to close', shopX + shopW / 2, shopY + shopH - 20);

    ctx.restore();
  }

  private renderMaterialBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    playerMaterials: { wood: number; brick: number; metal: number }
  ): void {
    const mats = [
      { label: 'Wood', amount: playerMaterials.wood, color: '#c17817' },
      { label: 'Brick', amount: playerMaterials.brick, color: '#b85c38' },
      { label: 'Metal', amount: playerMaterials.metal, color: '#8a8d8f' },
    ];

    const thirdW = w / 3;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < mats.length; i++) {
      const cx = x + thirdW * i + thirdW / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + thirdW * i + 4, y, thirdW - 8, 20);

      ctx.fillStyle = mats[i].color;
      ctx.fillText(`${mats[i].label}: ${mats[i].amount}`, cx, y + 10);
    }
  }

  private renderItemCard(
    ctx: CanvasRenderingContext2D,
    item: ShopItem,
    x: number,
    y: number,
    w: number,
    h: number,
    hovered: boolean,
    playerMaterials: { wood: number; brick: number; metal: number }
  ): void {
    const rarityColor = RARITY_COLORS[item.rarity ?? 'common'] ?? '#b0b0b0';
    const canAfford = this.canAfford(item, playerMaterials);

    ctx.save();

    if (hovered) {
      ctx.shadowColor = rarityColor;
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = hovered ? 'rgba(40,40,60,0.98)' : 'rgba(30,30,45,0.95)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    ctx.strokeStyle = hovered ? rarityColor : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = hovered ? 2 : 1;
    ctx.stroke();

    ctx.shadowBlur = 0;

    const iconY = y + 12;
    const iconSize = 36;
    const iconX = x + (w - iconSize) / 2;

    ctx.fillStyle = `${rarityColor}33`;
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconSize, iconSize, 6);
    ctx.fill();

    ctx.fillStyle = rarityColor;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (item.itemType === 'weapon') {
      ctx.fillText('⚔', iconX + iconSize / 2, iconY + iconSize / 2);
    } else if (item.itemType === 'consumable') {
      ctx.fillText('♥', iconX + iconSize / 2, iconY + iconSize / 2);
    } else if (item.itemType === 'material') {
      ctx.fillText('◆', iconX + iconSize / 2, iconY + iconSize / 2);
    }

    ctx.font = 'bold 10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#eee';
    ctx.fillText(item.name, x + w / 2, iconY + iconSize + 8);

    ctx.font = '8px monospace';
    ctx.fillStyle = '#999';
    const descLines = this.wrapText(item.description, w - 16, ctx);
    for (let i = 0; i < descLines.length; i++) {
      ctx.fillText(descLines[i], x + w / 2, iconY + iconSize + 24 + i * 12);
    }

    const costY = y + h - 50;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x + 4, costY - 4, w - 8, 20);

    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';
    const costParts: string[] = [];
    if (item.cost.wood) costParts.push(`🪵${item.cost.wood}`);
    if (item.cost.brick) costParts.push(`🧱${item.cost.brick}`);
    if (item.cost.metal) costParts.push(`⚙${item.cost.metal}`);
    ctx.fillStyle = canAfford ? '#ffd700' : '#ff4444';
    ctx.fillText(costParts.join('  '), x + w / 2, costY + 6);

    if (!canAfford) {
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#ff4444';
      ctx.fillText('Cannot afford', x + w / 2, y + h - 20);
    } else if (hovered) {
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#30d158';
      ctx.fillText('Click to buy', x + w / 2, y + h - 20);
    }

    ctx.restore();
  }

  private canAfford(
    item: ShopItem,
    playerMaterials: { wood: number; brick: number; metal: number }
  ): boolean {
    return (
      (item.cost.wood ?? 0) <= playerMaterials.wood &&
      (item.cost.brick ?? 0) <= playerMaterials.brick &&
      (item.cost.metal ?? 0) <= playerMaterials.metal
    );
  }

  private wrapText(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
  }

  getShopItemBounds(
    canvasWidth: number,
    canvasHeight: number
  ): Array<{ x: number; y: number; w: number; h: number; itemIndex: number } | null> {
    if (!this.shopOpen || !this.activeNPC) return [];

    const shopW = Math.min(480, canvasWidth - 40);
    const shopH = Math.min(380, canvasHeight - 40);
    const shopX = (canvasWidth - shopW) / 2;
    const shopY = (canvasHeight - shopH) / 2;
    const cardW = (shopW - 40) / this.activeNPC.items.length - 8;
    const cardH = shopH - 120;
    const cardsY = shopY + 90;

    return this.activeNPC.items.map((_, i) => ({
      x: shopX + 20 + i * (cardW + 8),
      y: cardsY,
      w: cardW,
      h: cardH,
      itemIndex: i,
    }));
  }
}
