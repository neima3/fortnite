import { GameState, Player, Vec2, Grenade, Trap, SupplyDrop, Weapon } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, dist } from '../utils/math.js';
import { createExplosion } from '../entities/Particle.js';

export class ItemSystem {
  private supplyDropTimer: number = 0;

  throwGrenade(state: GameState, player: Player) {
    const weapon = player.inventory[player.selectedSlot];
    if (!weapon || weapon.type !== 'grenade' || weapon.ammo <= 0) return false;
    weapon.ammo--;
    const grenade: Grenade = {
      id: `gren_${Date.now()}_${Math.random()}`,
      pos: vec2(player.pos.x, player.pos.y),
      vel: vec2(Math.cos(player.rotation) * CONFIG.WEAPONS.grenade.projectileSpeed, Math.sin(player.rotation) * CONFIG.WEAPONS.grenade.projectileSpeed),
      ownerId: player.id, lifeTime: 0, maxLifeTime: 2, damage: CONFIG.WEAPONS.grenade.damage,
      explosionRadius: CONFIG.WEAPONS.grenade.explosionRadius, alive: true,
    };
    state.grenades.push(grenade);
    return true;
  }

  placeTrap(state: GameState, player: Player) {
    const weapon = player.inventory[player.selectedSlot];
    if (!weapon || weapon.type !== 'trap' || weapon.ammo <= 0) return false;
    weapon.ammo--;
    const trap: Trap = {
      id: `trap_${Date.now()}_${Math.random()}`,
      pos: vec2(player.pos.x + Math.cos(player.rotation) * 40, player.pos.y + Math.sin(player.rotation) * 40),
      ownerId: player.id, damage: CONFIG.WEAPONS.trap.damage, radius: 30, triggered: false, alive: true,
    };
    state.traps.push(trap);
    return true;
  }

  useConsumable(state: GameState, player: Player): boolean {
    const weapon = player.inventory[player.selectedSlot];
    if (!weapon) return false;
    if (weapon.type === 'medkit') {
      if (player.health >= CONFIG.PLAYER_MAX_HEALTH) return false;
      player.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, player.health + 100);
      player.inventory[player.selectedSlot] = null;
      return true;
    }
    if (weapon.type === 'shield') {
      if (player.shield >= CONFIG.PLAYER_MAX_SHIELD) return false;
      player.shield = Math.min(CONFIG.PLAYER_MAX_SHIELD, player.shield + 50);
      player.inventory[player.selectedSlot] = null;
      return true;
    }
    if (weapon.type === 'bandage') {
      if (player.health >= CONFIG.PLAYER_MAX_HEALTH) return false;
      player.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, player.health + 25);
      player.inventory[player.selectedSlot] = null;
      return true;
    }
    return false;
  }

  tryOpenSupplyDrop(state: GameState, player: Player): boolean {
    for (const drop of state.supplyDrops) {
      if (!drop.alive || !drop.landed) continue;
      if (dist(player.pos, drop.pos) < 50) {
        for (const item of drop.items) {
          const emptySlot = player.inventory.findIndex(w => w === null);
          if (emptySlot !== -1) {
            const w = CONFIG.WEAPONS[item.type as keyof typeof CONFIG.WEAPONS];
            const rarityMult: Record<string, number> = { common: 1, uncommon: 1.1, rare: 1.2, epic: 1.35, legendary: 1.5 };
            player.inventory[emptySlot] = {
              name: item.type, type: item.type, rarity: item.rarity,
              damage: Math.round(w.damage * rarityMult[item.rarity]), fireRate: w.fireRate, magazine: w.magazine,
              ammo: w.magazine === Infinity ? Infinity : w.magazine, maxAmmo: w.magazine,
              reloadTime: w.reloadTime, ammoType: item.type === 'shotgun' ? 'shells' : item.type === 'sniper' ? 'heavy' : 'medium',
              lastFireTime: 0, spread: w.spread, projectileSpeed: w.projectileSpeed,
            } as Weapon;
          }
        }
        drop.alive = false;
        return true;
      }
    }
    return false;
  }

  spawnSupplyDrop(state: GameState) {
    const drop: SupplyDrop = {
      id: `drop_${Date.now()}_${Math.random()}`,
      pos: vec2(Math.random() * CONFIG.MAP_SIZE, Math.random() * CONFIG.MAP_SIZE),
      landed: false, fallSpeed: 200, height: 1000, items: [], alive: true,
    };
    const weapons = ['ar', 'shotgun', 'sniper'];
    for (let i = 0; i < CONFIG.SUPPLY_DROP_ITEMS; i++) {
      const w = weapons[Math.floor(Math.random() * weapons.length)];
      drop.items.push({ type: w, rarity: 'legendary' });
    }
    state.supplyDrops.push(drop);
  }

  update(state: GameState, dt: number) {
    for (const g of state.grenades) {
      if (!g.alive) continue;
      g.pos.x += g.vel.x * dt;
      g.pos.y += g.vel.y * dt;
      g.lifeTime += dt;
      g.vel = vec2(g.vel.x * 0.98, g.vel.y * 0.98);
      if (g.lifeTime >= g.maxLifeTime) {
        this.explodeGrenade(state, g);
      }
    }
    state.grenades = state.grenades.filter(g => g.alive);

    for (const trap of state.traps) {
      if (!trap.alive || trap.triggered) continue;
      for (const entity of [state.player, ...state.bots]) {
        if (entity.id === trap.ownerId || !entity.alive) continue;
        if (dist(entity.pos, trap.pos) < trap.radius + entity.radius) {
          trap.triggered = true;
          entity.health -= trap.damage;
          if (entity.health <= 0) { entity.health = 0; entity.alive = false; }
          setTimeout(() => trap.alive = false, 500);
          break;
        }
      }
    }
    state.traps = state.traps.filter(t => t.alive);

    for (const drop of state.supplyDrops) {
      if (!drop.alive) continue;
      if (!drop.landed) {
        drop.height -= drop.fallSpeed * dt;
        if (drop.height <= 0) { drop.height = 0; drop.landed = true; }
      }
    }

    this.supplyDropTimer += dt;
    if (this.supplyDropTimer >= CONFIG.SUPPLY_DROP_INTERVAL) {
      this.supplyDropTimer = 0;
      this.spawnSupplyDrop(state);
    }
  }

  private explodeGrenade(state: GameState, grenade: Grenade) {
    grenade.alive = false;
    for (const entity of [state.player, ...state.bots]) {
      if (!entity.alive) continue;
      const d = dist(entity.pos, grenade.pos);
      if (d < grenade.explosionRadius) {
        const dmg = grenade.damage * (1 - d / grenade.explosionRadius);
        entity.health -= dmg;
        if (entity.health <= 0) { entity.health = 0; entity.alive = false; }
      }
    }
    for (const b of state.buildings) {
      if (!b.alive) continue;
      if (dist(b.pos, grenade.pos) < grenade.explosionRadius) {
        b.health -= grenade.damage;
        if (b.health <= 0) b.alive = false;
      }
    }
    state.particles.push(...createExplosion(grenade.pos, 20, '#e74c3c'));
  }

  render(ctx: CanvasRenderingContext2D, state: GameState) {
    for (const g of state.grenades) {
      if (!g.alive) continue;
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(g.pos.x, g.pos.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    for (const trap of state.traps) {
      if (!trap.alive) continue;
      ctx.fillStyle = trap.triggered ? '#e74c3c' : '#95a5a6';
      ctx.beginPath(); ctx.arc(trap.pos.x, trap.pos.y, trap.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      if (!trap.triggered) {
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText('TRAP', trap.pos.x, trap.pos.y + 3);
      }
    }
    for (const drop of state.supplyDrops) {
      if (!drop.alive) continue;
      const yOffset = -drop.height;
      ctx.fillStyle = '#8e44ad';
      ctx.fillRect(drop.pos.x - 15, drop.pos.y + yOffset - 10, 30, 20);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(drop.pos.x - 15, drop.pos.y + yOffset - 10, 30, 20);
      if (!drop.landed) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(drop.pos.x, drop.pos.y + yOffset - 25, 25, Math.PI, 0); ctx.fill();
      }
    }
  }
}
