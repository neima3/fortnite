import { GameState, Player, Weapon, Projectile } from '../types.js';
import { CONFIG } from '../config.js';
import { createProjectile, updateProjectile, checkProjectileHit } from '../entities/Projectile.js';
import { dist, angleTo } from '../utils/math.js';

export class CombatSystem {
  update(state: GameState, dt: number) {
    const allTargets = [state.player, ...state.bots];
    for (const proj of state.projectiles) {
      if (!proj.alive) continue;
      updateProjectile(proj, dt);
      const hit = checkProjectileHit(proj, allTargets);
      if (hit.hit && hit.targetId) {
        this.applyDamage(state, hit.targetId, proj.damage, proj.ownerId);
      }
    }
    state.projectiles = state.projectiles.filter(p => p.alive);
  }

  applyDamage(state: GameState, targetId: string, damage: number, attackerId: string) {
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
      if ((target as any).isBoss) {
        // Let BossSystem handle boss death
        return;
      }
      target.alive = false;
      state.playersAlive--;
      state.killFeed.unshift(`${attackerId} eliminated ${target.id}`);
      if (state.killFeed.length > 5) state.killFeed.pop();
      if (target.id === 'player') state.matchPhase = 'ended';
    }
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
    if (weapon.type === 'shotgun') {
      for (let i = 0; i < 5; i++) {
        state.projectiles.push(createProjectile(shooter.id, shooter.pos, shooter.rotation, weapon.type, weapon.damage / 5, weapon.projectileSpeed, spread));
      }
    } else {
      state.projectiles.push(createProjectile(shooter.id, shooter.pos, shooter.rotation, weapon.type, weapon.damage, weapon.projectileSpeed, spread));
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
