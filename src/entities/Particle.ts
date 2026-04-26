import { Particle, Vec2 } from '../types.js';
import { vec2, vec2Mul } from '../utils/math.js';

export function createExplosion(pos: Vec2, count: number = 10, color: string = '#e74c3c'): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;
    particles.push({
      id: `p_${Date.now()}_${Math.random()}`,
      pos: vec2(pos.x, pos.y),
      vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
      radius: 2 + Math.random() * 3, rotation: angle, alive: true,
      life: 0, maxLife: 0.3 + Math.random() * 0.4, color, size: 2 + Math.random() * 4,
    });
  }
  return particles;
}

export function createMuzzleFlash(pos: Vec2, angle: number): Particle[] {
  return [{
    id: `mf_${Date.now()}`,
    pos: vec2(pos.x + Math.cos(angle) * 25, pos.y + Math.sin(angle) * 25),
    vel: vec2(0, 0), radius: 8, rotation: angle, alive: true,
    life: 0, maxLife: 0.05, color: '#f1c40f', size: 10,
  }];
}

export function createHitMarker(pos: Vec2): Particle[] {
  return [{
    id: `hm_${Date.now()}`, pos: vec2(pos.x, pos.y),
    vel: vec2(0, -50), radius: 5, rotation: 0, alive: true,
    life: 0, maxLife: 0.3, color: '#fff', size: 4,
  }];
}

export function updateParticle(p: Particle, dt: number): boolean {
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;
  p.life += dt;
  p.vel = vec2Mul(p.vel, 0.95);
  if (p.life >= p.maxLife) { p.alive = false; return false; }
  return true;
}
