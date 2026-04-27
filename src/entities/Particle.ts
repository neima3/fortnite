import { Particle, Vec2 } from '../types.js';
import { vec2, vec2Mul, randomRange } from '../utils/math.js';

interface EnhancedParticle extends Particle {
  startSize?: number;
  endSize?: number;
  startColor?: string;
  endColor?: string;
  gravity?: number;
  drag?: number;
  rotationSpeed?: number;
  bounceCount?: number;
  maxBounces?: number;
  groundY?: number;
  alpha?: number;
  alphaCurve?: number;
  text?: string;
  shape?: string;
}

let _pid = 0;

function pid(prefix: string): string {
  return `${prefix}_${++_pid}_${Date.now()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function alphaFromCurve(t: number, curve: number): number {
  if (curve === 1) return 1 - (1 - t) * (1 - t);
  if (curve === 2) return t * t;
  if (curve === 3) return t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
  return 1 - t;
}

function makeParticle(
  overrides: Partial<EnhancedParticle> & { pos: Vec2 }
): EnhancedParticle {
  return {
    id: pid('p'),
    pos: overrides.pos,
    vel: overrides.vel || vec2(0, 0),
    radius: overrides.radius ?? 2,
    rotation: overrides.rotation ?? 0,
    alive: true,
    life: 0,
    maxLife: overrides.maxLife ?? 1,
    color: overrides.color ?? '#ffffff',
    size: overrides.size ?? 2,
    startSize: overrides.startSize,
    endSize: overrides.endSize,
    startColor: overrides.startColor,
    endColor: overrides.endColor,
    gravity: overrides.gravity,
    drag: overrides.drag,
    rotationSpeed: overrides.rotationSpeed,
    bounceCount: overrides.bounceCount ?? 0,
    maxBounces: overrides.maxBounces,
    groundY: overrides.groundY,
    alpha: 1,
    alphaCurve: overrides.alphaCurve,
    text: overrides.text,
    shape: overrides.shape,
  };
}

export function createExplosion(
  pos: Vec2,
  count: number = 10,
  color: string = '#e74c3c'
): Particle[] {
  const particles: EnhancedParticle[] = [];

  for (let i = 0; i < 3; i++) {
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(randomRange(-30, 30), randomRange(-30, 30)),
        radius: 5,
        size: 20,
        startSize: 5,
        endSize: 35,
        maxLife: 0.15 + Math.random() * 0.1,
        color: '#ffffcc',
        startColor: '#ffffff',
        endColor: '#ffee44',
        alphaCurve: 1,
        shape: 'circle',
      })
    );
  }

  for (let i = 0; i < count + 4; i++) {
    const angle =
      (Math.PI * 2 * i) / (count + 4) + randomRange(-0.2, 0.2);
    const speed = randomRange(60, 180);
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 3,
        size: 8,
        startSize: 4,
        endSize: 12,
        maxLife: 0.3 + Math.random() * 0.3,
        color: '#ff6622',
        startColor: '#ffaa33',
        endColor: '#cc2200',
        drag: 0.92,
        alphaCurve: 1,
        shape: 'circle',
      })
    );
  }

  for (let i = 0; i < count + 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(150, 400);
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 1,
        size: 2,
        startSize: 2,
        endSize: 0.5,
        maxLife: 0.2 + Math.random() * 0.4,
        color: '#ffff88',
        startColor: '#ffffff',
        endColor: '#ff8800',
        gravity: 200,
        drag: 0.97,
        alphaCurve: 1,
      })
    );
  }

  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(10, 40);
    particles.push(
      makeParticle({
        pos: vec2(
          pos.x + randomRange(-5, 5),
          pos.y + randomRange(-5, 5)
        ),
        vel: vec2(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 20
        ),
        radius: 6,
        size: 10,
        startSize: 8,
        endSize: 25,
        maxLife: 0.8 + Math.random() * 0.6,
        color: '#444444',
        startColor: '#666666',
        endColor: '#222222',
        gravity: -30,
        drag: 0.95,
        alphaCurve: 3,
        shape: 'circle',
      })
    );
  }

  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(80, 250);
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 2,
        size: 3,
        startSize: 3,
        endSize: 3,
        maxLife: 0.5 + Math.random() * 0.5,
        color: '#8b4513',
        startColor: '#a0522d',
        endColor: '#654321',
        gravity: 400,
        drag: 0.98,
        rotationSpeed: randomRange(-10, 10),
        bounceCount: 0,
        maxBounces: 2,
        shape: 'rect',
      })
    );
  }

  particles.push(
    makeParticle({
      pos: vec2(pos.x, pos.y),
      vel: vec2(0, 0),
      radius: 10,
      size: 10,
      startSize: 5,
      endSize: 80,
      maxLife: 0.3,
      color: '#ffffff',
      startColor: '#ffffff',
      endColor: '#ff8844',
      alphaCurve: 1,
      shape: 'ring',
    })
  );

  return particles;
}

export function createMuzzleFlash(pos: Vec2, angle: number): Particle[] {
  const particles: EnhancedParticle[] = [];
  const muzzlePos = vec2(
    pos.x + Math.cos(angle) * 25,
    pos.y + Math.sin(angle) * 25
  );

  particles.push(
    makeParticle({
      pos: vec2(muzzlePos.x, muzzlePos.y),
      vel: vec2(Math.cos(angle) * 20, Math.sin(angle) * 20),
      radius: 8,
      size: 12,
      startSize: 4,
      endSize: 14,
      maxLife: 0.06,
      color: '#ffff88',
      startColor: '#ffffff',
      endColor: '#ffcc44',
      alphaCurve: 1,
      shape: 'circle',
    })
  );

  for (let i = 0; i < 3; i++) {
    const a = angle + randomRange(-0.5, 0.5);
    const speed = randomRange(20, 50);
    particles.push(
      makeParticle({
        pos: vec2(muzzlePos.x, muzzlePos.y),
        vel: vec2(Math.cos(a) * speed, Math.sin(a) * speed),
        radius: 4,
        size: 5,
        startSize: 5,
        endSize: 8,
        maxLife: 0.15 + Math.random() * 0.1,
        color: '#888888',
        startColor: '#aaaaaa',
        endColor: '#555555',
        gravity: -15,
        drag: 0.93,
        alphaCurve: 1,
        shape: 'circle',
      })
    );
  }

  for (let i = 0; i < 5; i++) {
    const a = angle + randomRange(-0.8, 0.8);
    const speed = randomRange(100, 250);
    particles.push(
      makeParticle({
        pos: vec2(muzzlePos.x, muzzlePos.y),
        vel: vec2(Math.cos(a) * speed, Math.sin(a) * speed),
        radius: 1,
        size: 1.5,
        startSize: 1.5,
        endSize: 0.3,
        maxLife: 0.1 + Math.random() * 0.15,
        color: '#ffff66',
        startColor: '#ffffff',
        endColor: '#ffaa00',
        gravity: 80,
        drag: 0.96,
        alphaCurve: 1,
      })
    );
  }

  return particles;
}

export function createHitMarker(pos: Vec2): Particle[] {
  return [
    makeParticle({
      pos: vec2(pos.x, pos.y),
      vel: vec2(0, -50),
      radius: 5,
      size: 4,
      maxLife: 0.3,
      color: '#fff',
      alphaCurve: 1,
    }),
  ];
}

export function createBloodSplat(pos: Vec2, angle: number): Particle[] {
  const particles: EnhancedParticle[] = [];
  for (let i = 0; i < 15; i++) {
    const a = angle + randomRange(-0.6, 0.6);
    const speed = randomRange(40, 200);
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(Math.cos(a) * speed, Math.sin(a) * speed),
        radius: randomRange(1, 3),
        size: randomRange(2, 5),
        startSize: randomRange(2, 5),
        endSize: randomRange(1, 2),
        maxLife: 0.3 + Math.random() * 0.4,
        color: '#cc0000',
        startColor: '#ff2222',
        endColor: '#880000',
        gravity: 300,
        drag: 0.96,
        alphaCurve: 1,
        bounceCount: 0,
        maxBounces: 1,
      })
    );
  }
  return particles;
}

export function createShieldBreak(pos: Vec2): Particle[] {
  const particles: EnhancedParticle[] = [];
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(100, 350);
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: randomRange(1, 3),
        size: randomRange(2, 5),
        startSize: randomRange(3, 6),
        endSize: 0.5,
        maxLife: 0.2 + Math.random() * 0.3,
        color: '#4488ff',
        startColor: '#88ccff',
        endColor: '#2244aa',
        gravity: 50,
        drag: 0.94,
        rotationSpeed: randomRange(-8, 8),
        alphaCurve: 1,
      })
    );
  }
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(Math.cos(angle) * 120, Math.sin(angle) * 120),
        radius: 1,
        size: 2,
        startSize: 2,
        endSize: 15,
        maxLife: 0.15,
        color: '#66aaff',
        startColor: '#aaddff',
        endColor: '#3366cc',
        alphaCurve: 1,
        shape: 'ring',
      })
    );
  }
  return particles;
}

export function createHealEffect(pos: Vec2): Particle[] {
  const particles: EnhancedParticle[] = [];
  for (let i = 0; i < 12; i++) {
    const ox = randomRange(-15, 15);
    const oy = randomRange(-5, 10);
    particles.push(
      makeParticle({
        pos: vec2(pos.x + ox, pos.y + oy),
        vel: vec2(randomRange(-10, 10), randomRange(-80, -30)),
        radius: 2,
        size: randomRange(2, 4),
        startSize: randomRange(1, 3),
        endSize: randomRange(3, 6),
        maxLife: 0.5 + Math.random() * 0.5,
        color: '#44ff44',
        startColor: '#88ff88',
        endColor: '#22aa22',
        gravity: -40,
        drag: 0.98,
        alphaCurve: 3,
      })
    );
  }
  return particles;
}

export function createBuildingDestroy(
  pos: Vec2,
  material: 'wood' | 'brick' | 'metal' = 'wood'
): Particle[] {
  const colors: Record<
    string,
    { start: string; end: string }
  > = {
    wood: { start: '#c4873b', end: '#8b5e3c' },
    brick: { start: '#b85c38', end: '#7a3b2e' },
    metal: { start: '#a8a8a8', end: '#6b6b6b' },
  };
  const c = colors[material] || colors.wood;
  const particles: EnhancedParticle[] = [];

  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(60, 280);
    particles.push(
      makeParticle({
        pos: vec2(
          pos.x + randomRange(-10, 10),
          pos.y + randomRange(-10, 10)
        ),
        vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: randomRange(2, 5),
        size: randomRange(3, 7),
        startSize: randomRange(3, 7),
        endSize: randomRange(1, 3),
        maxLife: 0.4 + Math.random() * 0.6,
        color: c.start,
        startColor: c.start,
        endColor: c.end,
        gravity: 450,
        drag: 0.97,
        rotationSpeed: randomRange(-12, 12),
        bounceCount: 0,
        maxBounces: 2,
        alphaCurve: 1,
        shape: 'rect',
      })
    );
  }

  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(10, 30);
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 20
        ),
        radius: 5,
        size: 8,
        startSize: 6,
        endSize: 20,
        maxLife: 0.6 + Math.random() * 0.4,
        color: '#888888',
        startColor: '#999999',
        endColor: '#444444',
        gravity: -25,
        drag: 0.94,
        alphaCurve: 3,
        shape: 'circle',
      })
    );
  }

  return particles;
}

export function createRicochet(pos: Vec2, angle: number): Particle[] {
  const particles: EnhancedParticle[] = [];
  for (let i = 0; i < 8; i++) {
    const a = angle + randomRange(-1.0, 1.0);
    const speed = randomRange(100, 300);
    particles.push(
      makeParticle({
        pos: vec2(pos.x, pos.y),
        vel: vec2(Math.cos(a) * speed, Math.sin(a) * speed),
        radius: 1,
        size: 1.5,
        startSize: 2,
        endSize: 0.2,
        maxLife: 0.1 + Math.random() * 0.2,
        color: '#ffff88',
        startColor: '#ffffff',
        endColor: '#ffaa44',
        gravity: 150,
        drag: 0.95,
        alphaCurve: 1,
      })
    );
  }
  return particles;
}

export function createTrail(
  pos: Vec2,
  color: string = '#aaaaaa'
): Particle[] {
  return [
    makeParticle({
      pos: vec2(pos.x, pos.y),
      vel: vec2(randomRange(-5, 5), randomRange(-5, 5)),
      radius: 2,
      size: 3,
      startSize: 3,
      endSize: 0.5,
      maxLife: 0.15 + Math.random() * 0.1,
      color,
      startColor: color,
      endColor: '#444444',
      drag: 0.9,
      alphaCurve: 1,
    }),
  ];
}

export function createFootstepDust(pos: Vec2): Particle[] {
  const particles: EnhancedParticle[] = [];
  for (let i = 0; i < 4; i++) {
    const a = randomRange(-Math.PI, 0);
    const speed = randomRange(10, 30);
    particles.push(
      makeParticle({
        pos: vec2(pos.x + randomRange(-3, 3), pos.y),
        vel: vec2(Math.cos(a) * speed, Math.sin(a) * speed),
        radius: 3,
        size: 4,
        startSize: 2,
        endSize: 8,
        maxLife: 0.3 + Math.random() * 0.2,
        color: '#b8a88a',
        startColor: '#c4b496',
        endColor: '#8a7a6a',
        gravity: -10,
        drag: 0.92,
        alphaCurve: 1,
        shape: 'circle',
      })
    );
  }
  return particles;
}

export function createSpeedLines(
  pos: Vec2,
  angle: number
): Particle[] {
  const particles: EnhancedParticle[] = [];
  for (let i = 0; i < 6; i++) {
    const offset = randomRange(-20, 20);
    const perpAngle = angle + Math.PI / 2;
    const startPos = vec2(
      pos.x +
        Math.cos(perpAngle) * offset +
        Math.cos(angle) * randomRange(-10, 10),
      pos.y +
        Math.sin(perpAngle) * offset +
        Math.sin(angle) * randomRange(-10, 10)
    );
    const speed = randomRange(200, 400);
    particles.push(
      makeParticle({
        pos: startPos,
        vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: 1,
        size: 2,
        startSize: 15,
        endSize: 1,
        maxLife: 0.15 + Math.random() * 0.1,
        color: '#ffffff',
        startColor: '#ffffff',
        endColor: '#88bbff',
        drag: 0.9,
        alphaCurve: 1,
        shape: 'line',
        rotation: angle,
      })
    );
  }
  return particles;
}

export function createLootBeam(
  pos: Vec2,
  rarity: string = 'common'
): Particle[] {
  const rarityColors: Record<
    string,
    { start: string; end: string }
  > = {
    common: { start: '#888888', end: '#555555' },
    uncommon: { start: '#44ff44', end: '#22aa22' },
    rare: { start: '#4488ff', end: '#2255cc' },
    epic: { start: '#aa44ff', end: '#7722cc' },
    legendary: { start: '#ffaa00', end: '#cc7700' },
    mythic: { start: '#ff44ff', end: '#cc22cc' },
  };
  const c = rarityColors[rarity] || rarityColors.common;
  const particles: EnhancedParticle[] = [];

  particles.push(
    makeParticle({
      pos: vec2(pos.x, pos.y - 10),
      vel: vec2(0, -60),
      radius: 4,
      size: 6,
      startSize: 4,
      endSize: 3,
      maxLife: 0.8,
      color: c.start,
      startColor: c.start,
      endColor: c.end,
      alphaCurve: 3,
      shape: 'line',
    })
  );

  for (let i = 0; i < 3; i++) {
    const ox = randomRange(-4, 4);
    particles.push(
      makeParticle({
        pos: vec2(pos.x + ox, pos.y),
        vel: vec2(0, randomRange(-100, -50)),
        radius: 1,
        size: 2,
        startSize: 2,
        endSize: 1,
        maxLife: 0.5 + Math.random() * 0.3,
        color: c.start,
        startColor: c.start,
        endColor: c.end,
        drag: 0.99,
        alphaCurve: 3,
      })
    );
  }

  return particles;
}

export function createDamageIndicator(
  pos: Vec2,
  damage: number
): Particle[] {
  return [
    makeParticle({
      pos: vec2(pos.x + randomRange(-10, 10), pos.y - 10),
      vel: vec2(randomRange(-15, 15), -80),
      radius: 10,
      size: 14,
      startSize: 18,
      endSize: 14,
      maxLife: 1.0,
      color: damage >= 50 ? '#ff4444' : '#ffffff',
      startColor: damage >= 50 ? '#ff6644' : '#ffff88',
      endColor: damage >= 50 ? '#cc2222' : '#aaaaaa',
      gravity: -20,
      drag: 0.97,
      alphaCurve: 3,
      text: Math.round(damage).toString(),
    }),
  ];
}

export function updateParticle(p: Particle, dt: number): boolean {
  const ep = p as EnhancedParticle;

  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;
  p.life += dt;

  const t = Math.min(p.life / p.maxLife, 1);

  if (ep.gravity != null) {
    p.vel.y += ep.gravity * dt;
  }

  if (ep.drag != null) {
    const factor = Math.pow(ep.drag, dt * 60);
    p.vel = vec2Mul(p.vel, factor);
  } else {
    p.vel = vec2Mul(p.vel, 0.95);
  }

  if (ep.rotationSpeed != null) {
    p.rotation += ep.rotationSpeed * dt;
  }

  if (ep.startSize != null && ep.endSize != null) {
    p.size = ep.startSize + (ep.endSize - ep.startSize) * t;
  }

  if (ep.startColor != null && ep.endColor != null) {
    p.color = lerpColor(ep.startColor, ep.endColor, t);
  }

  if (ep.alphaCurve != null) {
    ep.alpha = alphaFromCurve(t, ep.alphaCurve);
  } else {
    ep.alpha = 1 - t;
  }

  if (
    ep.maxBounces != null &&
    ep.groundY != null &&
    ep.bounceCount != null
  ) {
    if (p.pos.y >= ep.groundY && p.vel.y > 0) {
      p.pos.y = ep.groundY;
      p.vel.y *= -0.5;
      p.vel.x *= 0.7;
      ep.bounceCount++;
      if (ep.bounceCount >= ep.maxBounces) {
        p.vel.x = 0;
        p.vel.y = 0;
        if (ep.gravity != null) {
          ep.gravity = 0;
        }
      }
    }
  }

  if (p.life >= p.maxLife) {
    p.alive = false;
    return false;
  }
  return true;
}
