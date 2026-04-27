import { SpatialHash } from '../utils/spatialHash.js';

export interface PhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
  isStatic: boolean;
}

export interface RaycastResult {
  hit: boolean;
  x: number;
  y: number;
  normalX: number;
  normalY: number;
  distance: number;
  entityId?: string;
}

export interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  gravityScale: number;
  lifeTime: number;
  maxLifeTime: number;
  bounceCount: number;
  maxBounces: number;
  penetrationPower: number;
  trail: Array<{ x: number; y: number; age: number }>;
  trailMaxLength: number;
  trailFadeTime: number;
}

export interface ExplosionConfig {
  centerX: number;
  centerY: number;
  radius: number;
  force: number;
  damage: number;
  falloff: 'linear' | 'quadratic' | 'exponential';
  chainRadius: number;
  canChain: boolean;
}

export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  drag: number;
  gravityScale: number;
  sizeStart: number;
  sizeEnd: number;
  colorStartR: number;
  colorStartG: number;
  colorStartB: number;
  colorStartA: number;
  colorEndR: number;
  colorEndG: number;
  colorEndB: number;
  colorEndA: number;
  windX: number;
  windY: number;
  turbulence: number;
}

export interface KnockbackState {
  vx: number;
  vy: number;
  resistance: number;
  decayRate: number;
}

export interface GravityWell {
  x: number;
  y: number;
  strength: number;
  radius: number;
}

export interface BulletTrailSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  age: number;
  maxAge: number;
}

export interface ExplosionCallback {
  (centerX: number, centerY: number, radius: number, damage: number): void;
}

const EPSILON = 0.0001;
const GRAVITY = 980;
const MAX_COLLISION_ITERATIONS = 8;
const KNOCKBACK_DECAY = 0.92;
const KNOCKBACK_MIN_THRESHOLD = 5;

export class PhysicsEngine {
  private bodies: Map<string, PhysicsBody> = new Map();
  private knockbackStates: Map<string, KnockbackState> = new Map();
  private gravityWells: GravityWell[] = [];
  private projectiles: Map<string, ProjectileState> = new Map();
  private particles: Map<string, ParticleState> = new Map();
  private bulletTrails: BulletTrailSegment[] = [];
  private spatialHash: SpatialHash;
  private explosionCallback: ExplosionCallback | null = null;
  private chainExplosionQueue: ExplosionConfig[] = [];
  private pendingChainIds: Set<string> = new Set();

  constructor() {
    this.spatialHash = new SpatialHash(100);
  }

  addBody(id: string, body: PhysicsBody): void {
    const b: PhysicsBody = {
      x: body.x,
      y: body.y,
      vx: body.vx,
      vy: body.vy,
      radius: body.radius,
      mass: body.isStatic ? Infinity : body.mass,
      restitution: body.restitution,
      friction: body.friction,
      isStatic: body.isStatic,
    };
    this.bodies.set(id, b);
    if (!b.isStatic) {
      this.knockbackStates.set(id, { vx: 0, vy: 0, resistance: 1, decayRate: KNOCKBACK_DECAY });
    }
  }

  removeBody(id: string): void {
    this.bodies.delete(id);
    this.knockbackStates.delete(id);
  }

  getBody(id: string): PhysicsBody | undefined {
    return this.bodies.get(id);
  }

  addGravityWell(well: GravityWell): void {
    this.gravityWells.push(well);
  }

  removeGravityWell(x: number, y: number): void {
    const idx = this.gravityWells.findIndex(w => w.x === x && w.y === y);
    if (idx !== -1) this.gravityWells.splice(idx, 1);
  }

  addProjectile(id: string, proj: ProjectileState): void {
    this.projectiles.set(id, { ...proj });
  }

  removeProjectile(id: string): void {
    this.projectiles.delete(id);
  }

  getProjectile(id: string): ProjectileState | undefined {
    return this.projectiles.get(id);
  }

  addParticle(id: string, p: ParticleState): void {
    this.particles.set(id, { ...p });
  }

  removeParticle(id: string): void {
    this.particles.delete(id);
  }

  getParticle(id: string): ParticleState | undefined {
    return this.particles.get(id);
  }

  getBulletTrails(): BulletTrailSegment[] {
    return this.bulletTrails;
  }

  setExplosionCallback(cb: ExplosionCallback): void {
    this.explosionCallback = cb;
  }

  setKnockbackResistance(bodyId: string, resistance: number): void {
    const state = this.knockbackStates.get(bodyId);
    if (state) {
      state.resistance = resistance;
    }
  }

  checkCircleCircle(a: PhysicsBody, b: PhysicsBody): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distSq = dx * dx + dy * dy;
    const radiiSum = a.radius + b.radius;
    return distSq <= radiiSum * radiiSum;
  }

  resolveCircleCircle(a: PhysicsBody, b: PhysicsBody): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distSq = dx * dx + dy * dy;
    const radiiSum = a.radius + b.radius;

    if (distSq > radiiSum * radiiSum) return;
    if (distSq < EPSILON) {
      a.x -= radiiSum * 0.5;
      b.x += radiiSum * 0.5;
      return;
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = radiiSum - dist;

    const totalInvMass = (a.isStatic ? 0 : 1 / a.mass) + (b.isStatic ? 0 : 1 / b.mass);
    if (totalInvMass < EPSILON) return;

    const correctionScalar = overlap / totalInvMass;

    if (!a.isStatic) {
      a.x -= nx * correctionScalar / a.mass;
      a.y -= ny * correctionScalar / a.mass;
    }
    if (!b.isStatic) {
      b.x += nx * correctionScalar / b.mass;
      b.y += ny * correctionScalar / b.mass;
    }

    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dvDotN = dvx * nx + dvy * ny;

    if (dvDotN > 0) return;

    const restitution = Math.min(a.restitution, b.restitution);
    const j = -(1 + restitution) * dvDotN / totalInvMass;

    if (!a.isStatic) {
      a.vx += j * nx / a.mass;
      a.vy += j * ny / a.mass;
    }
    if (!b.isStatic) {
      b.vx -= j * nx / b.mass;
      b.vy -= j * ny / b.mass;
    }

    const tangentX = dvx - dvDotN * nx;
    const tangentY = dvy - dvDotN * ny;
    const tangentLenSq = tangentX * tangentX + tangentY * tangentY;

    if (tangentLenSq > EPSILON) {
      const tangentLen = Math.sqrt(tangentLenSq);
      const tx = tangentX / tangentLen;
      const ty = tangentY / tangentLen;
      const dvDotT = dvx * tx + dvy * ty;
      const friction = (a.friction + b.friction) * 0.5;
      const jt = -dvDotT / totalInvMass;
      const jtClamped = Math.abs(jt) < Math.abs(j) * friction ? jt : Math.sign(jt) * Math.abs(j) * friction;

      if (!a.isStatic) {
        a.vx += jtClamped * tx / a.mass;
        a.vy += jtClamped * ty / a.mass;
      }
      if (!b.isStatic) {
        b.vx -= jtClamped * tx / b.mass;
        b.vy -= jtClamped * ty / b.mass;
      }
    }
  }

  checkCircleRect(circle: PhysicsBody, rx: number, ry: number, rw: number, rh: number): boolean {
    const closestX = Math.max(rx, Math.min(circle.x, rx + rw));
    const closestY = Math.max(ry, Math.min(circle.y, ry + rh));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
  }

  resolveCircleRect(body: PhysicsBody, rx: number, ry: number, rw: number, rh: number): void {
    const closestX = Math.max(rx, Math.min(body.x, rx + rw));
    const closestY = Math.max(ry, Math.min(body.y, ry + rh));
    const dx = body.x - closestX;
    const dy = body.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq > body.radius * body.radius) return;

    if (distSq < EPSILON) {
      const left = body.x - rx;
      const right = (rx + rw) - body.x;
      const top = body.y - ry;
      const bottom = (ry + rh) - body.y;
      const minDist = Math.min(left, right, top, bottom);

      let nx = 0;
      let ny = 0;
      if (minDist === left) nx = -1;
      else if (minDist === right) nx = 1;
      else if (minDist === top) ny = -1;
      else ny = 1;

      body.x += nx * (body.radius + minDist);
      body.y += ny * (body.radius + minDist);

      const dot = body.vx * nx + body.vy * ny;
      if (dot < 0) {
        body.vx -= (1 + body.restitution) * dot * nx;
        body.vy -= (1 + body.restitution) * dot * ny;
        const tx = -ny;
        const ty = nx;
        const tangentDot = body.vx * tx + body.vy * ty;
        body.vx -= tangentDot * body.friction * tx;
        body.vy -= tangentDot * body.friction * ty;
      }
      return;
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = body.radius - dist;

    body.x += nx * overlap;
    body.y += ny * overlap;

    const dot = body.vx * nx + body.vy * ny;
    if (dot < 0) {
      body.vx -= (1 + body.restitution) * dot * nx;
      body.vy -= (1 + body.restitution) * dot * ny;

      const tx = -ny;
      const ty = nx;
      const tangentDot = body.vx * tx + body.vy * ty;
      body.vx -= tangentDot * body.friction * tx;
      body.vy -= tangentDot * body.friction * ty;
    }
  }

  applyKnockback(bodyId: string, fromX: number, fromY: number, force: number): void {
    const body = this.bodies.get(bodyId);
    if (!body || body.isStatic) return;

    const state = this.knockbackStates.get(bodyId);
    if (!state) return;

    const dx = body.x - fromX;
    const dy = body.y - fromY;
    const distSq = dx * dx + dy * dy;

    let nx: number;
    let ny: number;
    if (distSq < EPSILON) {
      nx = 1;
      ny = 0;
    } else {
      const dist = Math.sqrt(distSq);
      nx = dx / dist;
      ny = dy / dist;
    }

    const adjustedForce = force * state.resistance;
    state.vx = nx * adjustedForce;
    state.vy = ny * adjustedForce;
  }

  applyDirectionalKnockback(bodyId: string, dirX: number, dirY: number, force: number): void {
    const body = this.bodies.get(bodyId);
    if (!body || body.isStatic) return;

    const state = this.knockbackStates.get(bodyId);
    if (!state) return;

    const lenSq = dirX * dirX + dirY * dirY;
    if (lenSq < EPSILON) return;

    const len = Math.sqrt(lenSq);
    const nx = dirX / len;
    const ny = dirY / len;

    const adjustedForce = force * state.resistance;
    state.vx += nx * adjustedForce;
    state.vy += ny * adjustedForce;
  }

  applyWeaponKnockback(bodyId: string, fromX: number, fromY: number, weaponType: string): void {
    let force: number;
    switch (weaponType) {
      case 'shotgun':
        force = 800;
        break;
      case 'sniper':
        force = 600;
        break;
      case 'rocket':
        force = 1200;
        break;
      case 'smg':
        force = 200;
        break;
      case 'ar':
        force = 300;
        break;
      default:
        force = 250;
    }
    this.applyKnockback(bodyId, fromX, fromY, force);
  }

  applyExplosion(centerX: number, centerY: number, radius: number, force: number, bodies: Map<string, PhysicsBody>): void {
    const config: ExplosionConfig = {
      centerX,
      centerY,
      radius,
      force,
      damage: force * 0.5,
      falloff: 'linear',
      chainRadius: radius * 1.5,
      canChain: true,
    };
    this.executeExplosion(config, bodies);
  }

  applyExplosionAdvanced(config: ExplosionConfig, bodies: Map<string, PhysicsBody>): void {
    this.executeExplosion(config, bodies);
  }

  private executeExplosion(config: ExplosionConfig, bodies: Map<string, PhysicsBody>): void {
    const { centerX, centerY, radius, force, falloff } = config;
    const radiusSq = radius * radius;

    if (this.explosionCallback) {
      this.explosionCallback(centerX, centerY, radius, config.damage);
    }

    for (const [id, body] of bodies) {
      if (body.isStatic) continue;

      const dx = body.x - centerX;
      const dy = body.y - centerY;
      const distSq = dx * dx + dy * dy;

      if (distSq > radiusSq) continue;
      if (distSq < EPSILON) {
        this.applyKnockback(id, centerX, centerY, force);
        continue;
      }

      const dist = Math.sqrt(distSq);
      const normalizedDist = dist / radius;

      let falloffMultiplier: number;
      switch (falloff) {
        case 'quadratic':
          falloffMultiplier = 1 - normalizedDist * normalizedDist;
          break;
        case 'exponential':
          falloffMultiplier = Math.exp(-3 * normalizedDist);
          break;
        case 'linear':
        default:
          falloffMultiplier = 1 - normalizedDist;
          break;
      }

      falloffMultiplier = Math.max(0, falloffMultiplier);
      const appliedForce = force * falloffMultiplier;

      this.applyKnockback(id, centerX, centerY, appliedForce);
    }
  }

  applyChainExplosions(bodies: Map<string, PhysicsBody>, munitions: Array<{ x: number; y: number; radius: number; explosionRadius: number; force: number; id: string }>): void {
    this.chainExplosionQueue = [];
    this.pendingChainIds = new Set();

    for (const m of munitions) {
      this.chainExplosionQueue.push({
        centerX: m.x,
        centerY: m.y,
        radius: m.explosionRadius,
        force: m.force,
        damage: m.force * 0.5,
        falloff: 'linear',
        chainRadius: m.explosionRadius * 1.5,
        canChain: true,
      });
      this.pendingChainIds.add(m.id);
    }

    let safety = 0;
    while (this.chainExplosionQueue.length > 0 && safety < 50) {
      safety++;
      const exp = this.chainExplosionQueue.shift()!;
      this.executeExplosion(exp, bodies);

      for (const m of munitions) {
        if (this.pendingChainIds.has(m.id)) continue;

        const dx = m.x - exp.centerX;
        const dy = m.y - exp.centerY;
        const distSq = dx * dx + dy * dy;
        const chainRadiusSq = exp.chainRadius * exp.chainRadius;

        if (distSq <= chainRadiusSq) {
          this.pendingChainIds.add(m.id);
          this.chainExplosionQueue.push({
            centerX: m.x,
            centerY: m.y,
            radius: m.explosionRadius,
            force: m.force,
            damage: m.force * 0.5,
            falloff: 'quadratic',
            chainRadius: m.explosionRadius * 1.5,
            canChain: true,
          });
        }
      }
    }
  }

  calculateExplosionDamage(centerX: number, centerY: number, radius: number, maxDamage: number, targetX: number, targetY: number, falloff: 'linear' | 'quadratic' | 'exponential' = 'linear'): number {
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const distSq = dx * dx + dy * dy;
    const radiusSq = radius * radius;

    if (distSq > radiusSq) return 0;

    const dist = Math.sqrt(distSq);
    const normalizedDist = dist / radius;

    let falloffMultiplier: number;
    switch (falloff) {
      case 'quadratic':
        falloffMultiplier = 1 - normalizedDist * normalizedDist;
        break;
      case 'exponential':
        falloffMultiplier = Math.exp(-3 * normalizedDist);
        break;
      case 'linear':
      default:
        falloffMultiplier = 1 - normalizedDist;
        break;
    }

    return maxDamage * Math.max(0, falloffMultiplier);
  }

  applyDrag(body: PhysicsBody, dt: number): void {
    if (body.isStatic) return;
    const dragFactor = 1 - body.friction * dt;
    const clampedDrag = Math.max(0, Math.min(1, dragFactor));
    body.vx *= clampedDrag;
    body.vy *= clampedDrag;
  }

  raycast(originX: number, originY: number, dirX: number, dirY: number, maxDist: number, obstacles: Array<{ x: number; y: number; radius: number; id: string }>): RaycastResult {
    const noHit: RaycastResult = { hit: false, x: originX, y: originY, normalX: 0, normalY: 0, distance: maxDist };

    const lenSq = dirX * dirX + dirY * dirY;
    if (lenSq < EPSILON) return noHit;

    const len = Math.sqrt(lenSq);
    const ndx = dirX / len;
    const ndy = dirY / len;

    let nearestT = maxDist;
    let nearestResult: RaycastResult | null = null;

    for (const obs of obstacles) {
      const ocx = originX - obs.x;
      const ocy = originY - obs.y;

      const a = 1;
      const b = 2 * (ndx * ocx + ndy * ocy);
      const c = ocx * ocx + ocy * ocy - obs.radius * obs.radius;

      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;

      const sqrtD = Math.sqrt(discriminant);
      const t1 = (-b - sqrtD) / (2 * a);
      const t2 = (-b + sqrtD) / (2 * a);

      let t: number;
      if (t1 >= 0 && t1 < nearestT) {
        t = t1;
      } else if (t2 >= 0 && t2 < nearestT) {
        t = t2;
      } else {
        continue;
      }

      if (t < nearestT) {
        nearestT = t;
        const hitX = originX + ndx * t;
        const hitY = originY + ndy * t;
        const normalX = (hitX - obs.x) / obs.radius;
        const normalY = (hitY - obs.y) / obs.radius;

        nearestResult = {
          hit: true,
          x: hitX,
          y: hitY,
          normalX,
          normalY,
          distance: t,
          entityId: obs.id,
        };
      }
    }

    return nearestResult || noHit;
  }

  raycastAgainstRects(originX: number, originY: number, dirX: number, dirY: number, maxDist: number, rects: Array<{ x: number; y: number; w: number; h: number; id: string }>): RaycastResult {
    const noHit: RaycastResult = { hit: false, x: originX, y: originY, normalX: 0, normalY: 0, distance: maxDist };

    const lenSq = dirX * dirX + dirY * dirY;
    if (lenSq < EPSILON) return noHit;

    const len = Math.sqrt(lenSq);
    const ndx = dirX / len;
    const ndy = dirY / len;

    let nearestT = maxDist;
    let nearestResult: RaycastResult | null = null;

    for (const rect of rects) {
      let tmin = 0;
      let tmax = maxDist;

      let normalEntryX = 0;
      let normalEntryY = 0;

      if (Math.abs(ndx) < EPSILON) {
        if (originX < rect.x || originX > rect.x + rect.w) continue;
      } else {
        let t1 = (rect.x - originX) / ndx;
        let t2 = (rect.x + rect.w - originX) / ndx;
        let nx1 = -1;
        let nx2 = 1;

        if (t1 > t2) {
          const tmp = t1; t1 = t2; t2 = tmp;
          const tmpN = nx1; nx1 = nx2; nx2 = tmpN;
        }

        if (t1 > tmin) {
          tmin = t1;
          normalEntryX = nx1;
          normalEntryY = 0;
        }
        if (t2 < tmax) tmax = t2;
      }

      if (Math.abs(ndy) < EPSILON) {
        if (originY < rect.y || originY > rect.y + rect.h) continue;
      } else {
        let t1 = (rect.y - originY) / ndy;
        let t2 = (rect.y + rect.h - originY) / ndy;
        let ny1 = -1;
        let ny2 = 1;

        if (t1 > t2) {
          const tmp = t1; t1 = t2; t2 = tmp;
          const tmpN = ny1; ny1 = ny2; ny2 = tmpN;
        }

        if (t1 > tmin) {
          tmin = t1;
          normalEntryX = 0;
          normalEntryY = ny1;
        }
        if (t2 < tmax) tmax = t2;
      }

      if (tmin > tmax) continue;
      if (tmin < 0) tmin = tmax;
      if (tmin < 0 || tmin > nearestT) continue;

      nearestT = tmin;
      nearestResult = {
        hit: true,
        x: originX + ndx * tmin,
        y: originY + ndy * tmin,
        normalX: normalEntryX,
        normalY: normalEntryY,
        distance: tmin,
        entityId: rect.id,
      };
    }

    return nearestResult || noHit;
  }

  sweepTest(x1: number, y1: number, x2: number, y2: number, sweepRadius: number, obstacles: Array<{ x: number; y: number; radius: number; id: string }>): RaycastResult {
    const noHit: RaycastResult = { hit: false, x: x2, y: y2, normalX: 0, normalY: 0, distance: 0 };

    const dx = x2 - x1;
    const dy = y2 - y1;
    const moveLenSq = dx * dx + dy * dy;
    if (moveLenSq < EPSILON) return noHit;

    const moveLen = Math.sqrt(moveLenSq);
    const ndx = dx / moveLen;
    const ndy = dy / moveLen;

    let nearestT = 1;

    for (const obs of obstacles) {
      const combinedR = sweepRadius + obs.radius;
      const ocx = x1 - obs.x;
      const ocy = y1 - obs.y;

      const a = 1;
      const b = 2 * (ndx * ocx + ndy * ocy);
      const c = ocx * ocx + ocy * ocy - combinedR * combinedR;

      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;

      const sqrtD = Math.sqrt(discriminant);
      const t1 = (-b - sqrtD) / (2 * a);

      if (t1 >= 0 && t1 < nearestT) {
        nearestT = t1;
        const hitX = x1 + ndx * t1 * moveLen;
        const hitY = y1 + ndy * t1 * moveLen;
        const normDx = hitX - obs.x;
        const normDy = hitY - obs.y;
        const normLen = Math.sqrt(normDx * normDx + normDy * normDy);

        return {
          hit: true,
          x: hitX,
          y: hitY,
          normalX: normLen > EPSILON ? normDx / normLen : -ndx,
          normalY: normLen > EPSILON ? normDy / normLen : -ndy,
          distance: t1 * moveLen,
          entityId: obs.id,
        };
      }
    }

    return noHit;
  }

  rangeQuery(centerX: number, centerY: number, radius: number): string[] {
    this.spatialHash.clear();
    for (const [id, body] of this.bodies) {
      this.spatialHash.insert(id, { x: body.x, y: body.y }, body.radius);
    }
    return this.spatialHash.query({ x: centerX, y: centerY }, radius);
  }

  simulateProjectile(proj: ProjectileState, dt: number): ProjectileState {
    const p = { ...proj };

    p.vy += GRAVITY * p.gravityScale * dt;

    const dragFactor = 1 - p.drag * dt;
    p.vx *= Math.max(0, dragFactor);
    p.vy *= Math.max(0, dragFactor);

    const prevX = p.x;
    const prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.lifeTime += dt;

    if (p.trailMaxLength > 0) {
      p.trail.push({ x: p.x, y: p.y, age: 0 });
      while (p.trail.length > p.trailMaxLength) {
        p.trail.shift();
      }
      for (const seg of p.trail) {
        seg.age += dt;
      }
    }

    this.bulletTrails.push({
      x1: prevX,
      y1: prevY,
      x2: p.x,
      y2: p.y,
      age: 0,
      maxAge: p.trailFadeTime,
    });

    return p;
  }

  ricochetProjectile(proj: ProjectileState, nx: number, ny: number): ProjectileState | null {
    if (proj.bounceCount >= proj.maxBounces) return null;

    const reflected = PhysicsEngine.reflect(proj.vx, proj.vy, nx, ny);
    const speed = Math.sqrt(reflected.x * reflected.x + reflected.y * reflected.y);
    const restitution = 0.6;
    const newSpeed = speed * restitution;

    const len = Math.sqrt(reflected.x * reflected.x + reflected.y * reflected.y);
    if (len < EPSILON) return null;

    return {
      ...proj,
      vx: (reflected.x / len) * newSpeed,
      vy: (reflected.y / len) * newSpeed,
      bounceCount: proj.bounceCount + 1,
      penetrationPower: proj.penetrationPower * 0.5,
    };
  }

  simulateParticle(p: ParticleState, dt: number): ParticleState {
    const result = { ...p };

    result.vx += result.windX * dt;
    result.vy += result.windY * dt;

    if (result.turbulence > 0) {
      const turbX = (Math.random() - 0.5) * 2 * result.turbulence * dt;
      const turbY = (Math.random() - 0.5) * 2 * result.turbulence * dt;
      result.vx += turbX;
      result.vy += turbY;
    }

    result.vy += GRAVITY * result.gravityScale * dt;

    const dragFactor = 1 - result.drag * dt;
    result.vx *= Math.max(0, dragFactor);
    result.vy *= Math.max(0, dragFactor);

    result.x += result.vx * dt;
    result.y += result.vy * dt;

    result.life -= dt;

    return result;
  }

  getParticleInterpolatedSize(p: ParticleState): number {
    const t = Math.max(0, Math.min(1, p.life / p.maxLife));
    return p.sizeStart + (p.sizeEnd - p.sizeStart) * (1 - t);
  }

  getParticleInterpolatedColor(p: ParticleState): { r: number; g: number; b: number; a: number } {
    const t = Math.max(0, Math.min(1, p.life / p.maxLife));
    const inv = 1 - t;
    return {
      r: p.colorStartR * t + p.colorEndR * inv,
      g: p.colorStartG * t + p.colorEndG * inv,
      b: p.colorStartB * t + p.colorEndB * inv,
      a: p.colorStartA * t + p.colorEndA * inv,
    };
  }

  step(dt: number): void {
    const clampedDt = Math.min(dt, 1 / 30);

    for (const [id, body] of this.bodies) {
      if (body.isStatic) continue;

      for (const well of this.gravityWells) {
        const dx = well.x - body.x;
        const dy = well.y - body.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > well.radius * well.radius) continue;
        if (distSq < EPSILON) continue;

        const dist = Math.sqrt(distSq);
        const force = well.strength / Math.max(dist, 50);
        body.vx += (dx / dist) * force * clampedDt;
        body.vy += (dy / dist) * force * clampedDt;
      }

      const kb = this.knockbackStates.get(id);
      if (kb) {
        body.vx += kb.vx * clampedDt;
        body.vy += kb.vy * clampedDt;

        const kbSpeed = Math.sqrt(kb.vx * kb.vx + kb.vy * kb.vy);
        const decay = Math.pow(kb.decayRate, clampedDt * 60);
        kb.vx *= decay;
        kb.vy *= decay;

        if (kbSpeed < KNOCKBACK_MIN_THRESHOLD) {
          kb.vx = 0;
          kb.vy = 0;
        }
      }

      body.x += body.vx * clampedDt;
      body.y += body.vy * clampedDt;

      this.applyDrag(body, clampedDt);
    }

    this.spatialHash.clear();
    for (const [id, body] of this.bodies) {
      this.spatialHash.insert(id, { x: body.x, y: body.y }, body.radius);
    }

    for (let iteration = 0; iteration < MAX_COLLISION_ITERATIONS; iteration++) {
      let anyCollision = false;

      for (const [idA, bodyA] of this.bodies) {
        const nearby = this.spatialHash.query({ x: bodyA.x, y: bodyA.y }, bodyA.radius * 2 + 100);
        for (const idB of nearby) {
          if (idA >= idB) continue;

          const bodyB = this.bodies.get(idB);
          if (!bodyB) continue;

          if (this.checkCircleCircle(bodyA, bodyB)) {
            this.resolveCircleCircle(bodyA, bodyB);
            anyCollision = true;
          }
        }
      }

      if (!anyCollision) break;
    }

    for (const [id, proj] of this.projectiles) {
      const updated = this.simulateProjectile(proj, clampedDt);
      this.projectiles.set(id, updated);
    }

    for (const [id, p] of this.particles) {
      const updated = this.simulateParticle(p, clampedDt);
      this.particles.set(id, updated);
    }

    for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
      this.bulletTrails[i].age += clampedDt;
      if (this.bulletTrails[i].age >= this.bulletTrails[i].maxAge) {
        this.bulletTrails.splice(i, 1);
      }
    }
  }

  static reflect(vx: number, vy: number, nx: number, ny: number): { x: number; y: number } {
    const dot = vx * nx + vy * ny;
    return {
      x: vx - 2 * dot * nx,
      y: vy - 2 * dot * ny,
    };
  }

  static lineIntersectsCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
  }

  static pointInCircle(px: number, py: number, cx: number, cy: number, r: number): boolean {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  }
}
