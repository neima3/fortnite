import { GameState, LootItem, Weapon, Player, Vec2 } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, dist } from '../utils/math.js';

export class LootSystem {
  spawnLootAt(pos: Vec2, type: string, quantity: number = 1): LootItem {
    const knownConsumables = ['medkit', 'shield', 'bandage'];
    const weapon = CONFIG.WEAPONS[type as keyof typeof CONFIG.WEAPONS] ? this.createWeapon(type)
      : knownConsumables.includes(type) ? this.createConsumable(type) : null;
    return {
      id: `loot_${Date.now()}_${Math.random()}`,
      pos: vec2(pos.x + (Math.random() - 0.5) * 30, pos.y + (Math.random() - 0.5) * 30),
      vel: vec2(0, 0), radius: 15, rotation: 0, alive: true,
      item: weapon || type, quantity,
    };
  }

  spawnFloorLoot(state: GameState) {
    const weapons = ['pistol', 'ar', 'shotgun', 'smg', 'sniper', 'grenade', 'trap'];
    const consumables = ['medkit', 'shield', 'bandage'];
    const materials = ['wood', 'brick', 'metal'];
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * CONFIG.MAP_SIZE;
      const y = Math.random() * CONFIG.MAP_SIZE;
      const roll = Math.random();
      if (roll < 0.4) {
        const w = weapons[Math.floor(Math.random() * weapons.length)];
        state.lootItems.push(this.spawnLootAt(vec2(x, y), w));
      } else if (roll < 0.6) {
        const c = consumables[Math.floor(Math.random() * consumables.length)];
        state.lootItems.push(this.spawnLootAt(vec2(x, y), c));
      } else {
        const m = materials[Math.floor(Math.random() * materials.length)];
        const qty = Math.floor(Math.random() * 50) + 20;
        state.lootItems.push(this.spawnLootAt(vec2(x, y), m, qty));
      }
    }
  }

  tryPickup(state: GameState, player: Player): boolean {
    let picked = false;
    for (const loot of state.lootItems) {
      if (!loot.alive) continue;
      if (dist(player.pos, loot.pos) < player.radius + loot.radius + 20) {
        if (typeof loot.item === 'string') {
          if (loot.item === 'wood') { player.materials.wood = Math.min(CONFIG.MAX_MATERIALS, player.materials.wood + loot.quantity); loot.alive = false; picked = true; }
          else if (loot.item === 'brick') { player.materials.brick = Math.min(CONFIG.MAX_MATERIALS, player.materials.brick + loot.quantity); loot.alive = false; picked = true; }
          else if (loot.item === 'metal') { player.materials.metal = Math.min(CONFIG.MAX_MATERIALS, player.materials.metal + loot.quantity); loot.alive = false; picked = true; }

        } else {
          const emptySlot = player.inventory.findIndex(w => w === null);
          if (emptySlot !== -1) {
            player.inventory[emptySlot] = loot.item as Weapon;
            loot.alive = false; picked = true;
          }
        }
      }
    }
    state.lootItems = state.lootItems.filter(l => l.alive);
    return picked;
  }

  private createWeapon(type: string): Weapon {
    const w = CONFIG.WEAPONS[type as keyof typeof CONFIG.WEAPONS];
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)] as Weapon['rarity'];
    const rarityMult: Record<string, number> = { common: 1, uncommon: 1.1, rare: 1.2, epic: 1.35, legendary: 1.5 };
    return {
      name: type, type: type as any, rarity,
      damage: Math.round(w.damage * rarityMult[rarity]),
      fireRate: w.fireRate, magazine: w.magazine,
      ammo: w.magazine === Infinity ? Infinity : w.magazine,
      maxAmmo: w.magazine, reloadTime: w.reloadTime,
      ammoType: type === 'pickaxe' ? 'none' : type === 'shotgun' ? 'shells' : type === 'sniper' ? 'heavy' : 'medium',
      lastFireTime: 0, spread: w.spread, projectileSpeed: w.projectileSpeed,
    };
  }

  private createConsumable(type: string): Weapon {
    return {
      name: type, type: type as any, rarity: 'common',
      damage: 0, fireRate: 0, magazine: 1, ammo: 1, maxAmmo: 1,
      reloadTime: 0, ammoType: 'none', lastFireTime: 0, spread: 0, projectileSpeed: 0,
    };
  }
}
