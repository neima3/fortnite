import { Projectile, Vec2 } from '../types.js';
import { vec2, vec2Mul, dist } from '../utils/math.js';
import { CONFIG } from '../config.js';

export function createProjectile(
  ownerId: string, pos: Vec2, angle: number,
  weaponType: string, damage: number, speed: number, spread: number
): Projectile {
  const spreadAngle = (Math.random() - 0.5) * 2 * (spread * Math.PI / 180);
  const finalAngle = angle + spreadAngle;
  return {
    id: `proj_${Date.now()}_${Math.random()}`,
    pos: vec2(pos.x, pos.y),
    vel: vec2(Math.cos(finalAngle) * speed, Math.sin(finalAngle) * speed),
    radius: 3, rotation: finalAngle, alive: true,
    ownerId, damage, lifeTime: 0, maxLifeTime: 3, type: weaponType,
  };
}

export function updateProjectile(proj: Projectile, dt: number): boolean {
  proj.pos.x += proj.vel.x * dt;
  proj.pos.y += proj.vel.y * dt;
  proj.lifeTime += dt;
  if (proj.lifeTime >= proj.maxLifeTime ||
      proj.pos.x < 0 || proj.pos.x > CONFIG.MAP_SIZE ||
      proj.pos.y < 0 || proj.pos.y > CONFIG.MAP_SIZE) {
    proj.alive = false;
    return false;
  }
  return true;
}

export function checkProjectileHit(proj: Projectile, entities: Array<{id: string; pos: Vec2; radius: number; alive: boolean}>): { hit: boolean; targetId?: string } {
  for (const entity of entities) {
    if (entity.id === proj.ownerId || !entity.alive) continue;
    if (dist(proj.pos, entity.pos) < proj.radius + entity.radius) {
      proj.alive = false;
      return { hit: true, targetId: entity.id };
    }
  }
  return { hit: false };
}
