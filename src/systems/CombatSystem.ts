import { GameState, Player, Weapon, Projectile } from '../types.js';
import { CONFIG } from '../config.js';
import { createProjectile, updateProjectile, checkProjectileHit } from '../entities/Projectile.js';
import { dist, angleTo } from '../utils/math.js';

export class CombatSystem {
  private lastHeadshotTarget: string | null = null;
  private lastHeadshotTime: number = 0;

  update(state: GameState, dt: number) {
    const allTargets = [state.player, ...state.bots];
    for (const proj of state.projectiles) {
      if (!proj.alive) continue;
      updateProjectile(proj, dt);
      const hit = checkProjectileHit(proj, allTargets);
      if (hit.hit && hit.targetId) {
        const target = allTargets.find(t => t.id === hit.targetId);
        let damage = proj.damage;
        let isHeadshot = false;

        if (target && proj.ownerId !== target.id) {
          const angleDiff = Math.abs(Math.atan2(
            Math.sin(proj.rotation - target.rotation),
            Math.cos(proj.rotation - target.rotation)
          ));
          if (angleDiff < CONFIG.CRIT_ZONE_ANGLE) {
            damage *= CONFIG.HEADSHOT_MULTIPLIER;
            isHeadshot = true;
            this.lastHeadshotTarget = target.id;
            this.lastHeadshotTime = performance.now() / 1000;
          }

          const shooter = allTargets.find(t => t.id === proj.ownerId);
          if (shooter) {
            const d = dist(shooter.pos, target.pos);
            const maxRange = 1500;
            if (d > maxRange * CONFIG.DAMAGE_FALLOFF_START) {
              const falloffT = Math.min(1, (d / maxRange - CONFIG.DAMAGE_FALLOFF_START) / (CONFIG.DAMAGE_FALLOFF_END - CONFIG.DAMAGE_FALLOFF_START));
              damage *= 1 - falloffT * 0.4;
            }
          }

          (proj as any).isHeadshot = isHeadshot;
          (proj as any).targetPos = { x: target.pos.x, y: target.pos.y };
        }

        this.applyDamage(state, hit.targetId, Math.round(damage), proj.ownerId, isHeadshot);
      }
    }
    state.projectiles = state.projectiles.filter(p => p.alive);
  }

  applyDamage(state: GameState, targetId: string, damage: number, attackerId: string, isHeadshot: boolean = false) {
    let target = state.player.id === targetId ? state.player : state.bots.find(b => b.id === targetId);
    if (!target || !target.alive) return;
    if (target.shield > 0) {
      const shieldDmg = Math.min(target.shield, damage);
      target.shield -= shieldDmg;
      damage -= shieldDmg;
    }
    target.health -= damage;
    if (target.health <= 0) {
      target.health = 0;
      if ((target as any).isBoss) return;
      target.alive = false;
      state.playersAlive--;
      const headshotTag = isHeadshot ? ' HEADSHOT!' : '';
      state.killFeed.unshift(`${attackerId} eliminated ${targetId}${headshotTag}`);
      if (state.killFeed.length > 5) state.killFeed.pop();
      if (targetId === 'player') state.matchPhase = 'ended';
    }
  }

  getLastHeadshot(): { targetId: string; time: number } | null {
    if (this.lastHeadshotTarget && performance.now() / 1000 - this.lastHeadshotTime < 0.5) {
      return { targetId: this.lastHeadshotTarget, time: this.lastHeadshotTime };
    }
    return null;
  }

  fireWeapon(state: GameState, shooter: Player): boolean {
    const weapon = shooter.inventory[shooter.selectedSlot];
    if (!weapon || weapon.type === 'medkit' || weapon.type === 'shield' || weapon.type === 'bandage' || weapon.type === 'grenade' || weapon.type === 'trap') return false;
    if (weapon.type === 'pickaxe') {
      this.meleeAttack(state, shooter);
      return true;
    }
    const now = performance.now() / 1000;
    if (now - weapon.lastFireTime < weapon.fireRate) return false;
    if (weapon.ammo <= 0) return false;
    weapon.lastFireTime = now;
    weapon.ammo--;

    const spread = shooter.aiming ? weapon.spread * 0.5 : weapon.spread;
    const rarityMult: Record<string, number> = { common: 1, uncommon: 1.1, rare: 1.2, epic: 1.35, legendary: 1.5 };
    const dmgMult = rarityMult[weapon.rarity] || 1;

    if (weapon.type === 'shotgun') {
      for (let i = 0; i < 5; i++) {
        state.projectiles.push(createProjectile(shooter.id, shooter.pos, shooter.rotation, weapon.type, Math.round(weapon.damage * dmgMult / 5), weapon.projectileSpeed, spread));
      }
    } else if (weapon.type === 'rpg') {
      const proj = createProjectile(shooter.id, shooter.pos, shooter.rotation, weapon.type, weapon.damage, weapon.projectileSpeed, spread);
      (proj as any).explosionRadius = (CONFIG.WEAPONS as any).rpg.explosionRadius;
      state.projectiles.push(proj);
    } else {
      state.projectiles.push(createProjectile(shooter.id, shooter.pos, shooter.rotation, weapon.type, Math.round(weapon.damage * dmgMult), weapon.projectileSpeed, spread));
    }
    return true;
  }

  meleeAttack(state: GameState, attacker: Player) {
    const range = 60;
    const targets = [state.player, ...state.bots].filter(e => e.id !== attacker.id && e.alive);
    for (const target of targets) {
      if (dist(attacker.pos, target.pos) < range + target.radius) {
        const angleToTarget = Math.atan2(target.pos.y - attacker.pos.y, target.pos.x - attacker.pos.x);
        const angleDiff = Math.abs(angleToTarget - attacker.rotation);
        if (angleDiff < Math.PI / 3 || angleDiff > Math.PI * 5 / 3) {
          this.applyDamage(state, target.id, CONFIG.WEAPONS.pickaxe.damage, attacker.id);
          break;
        }
      }
    }
  }

  reload(weapon: Weapon): boolean {
    if (weapon.ammo === weapon.maxAmmo || weapon.type === 'pickaxe') return false;
    weapon.ammo = weapon.maxAmmo;
    return true;
  }
}
