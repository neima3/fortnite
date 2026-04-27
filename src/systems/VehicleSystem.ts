import { vec2, dist, angleTo, vec2Norm, vec2Mul, vec2Add, vec2Sub, vec2Len, randomRange } from '../utils/math.js';
import { CONFIG } from '../config.js';
import { createExplosion } from '../entities/Particle.js';

export interface Vehicle {
  id: string;
  type: 'golfcart' | 'atk' | 'choppa' | 'boat';
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  rotation: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  health: number;
  maxHealth: number;
  fuel: number;
  maxFuel: number;
  seats: number;
  occupiedBy: (string | null)[];
  driver: string | null;
  alive: boolean;
  radius: number;
  boosting: boolean;
  boostFuel: number;
  maxBoostFuel: number;
}

interface VehicleConfig {
  type: 'golfcart' | 'atk' | 'choppa' | 'boat';
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  health: number;
  fuel: number;
  seats: number;
  radius: number;
  hasBoost: boolean;
  boostMaxSpeed: number;
  maxBoostFuel: number;
  flies: boolean;
  waterOnly: boolean;
  ramDamage: number;
}

const VEHICLE_CONFIGS: Record<string, VehicleConfig> = {
  golfcart: {
    type: 'golfcart',
    maxSpeed: 500,
    acceleration: 400,
    turnSpeed: 3,
    health: 150,
    fuel: 100,
    seats: 2,
    radius: 25,
    hasBoost: false,
    boostMaxSpeed: 0,
    maxBoostFuel: 0,
    flies: false,
    waterOnly: false,
    ramDamage: 0.3,
  },
  atk: {
    type: 'atk',
    maxSpeed: 450,
    acceleration: 350,
    turnSpeed: 2.5,
    health: 300,
    fuel: 120,
    seats: 4,
    radius: 30,
    hasBoost: true,
    boostMaxSpeed: 700,
    maxBoostFuel: 100,
    flies: false,
    waterOnly: false,
    ramDamage: 0.3,
  },
  choppa: {
    type: 'choppa',
    maxSpeed: 350,
    acceleration: 200,
    turnSpeed: 2,
    health: 400,
    fuel: 80,
    seats: 4,
    radius: 40,
    hasBoost: false,
    boostMaxSpeed: 0,
    maxBoostFuel: 0,
    flies: true,
    waterOnly: false,
    ramDamage: 0.3,
  },
  boat: {
    type: 'boat',
    maxSpeed: 400,
    acceleration: 300,
    turnSpeed: 2.5,
    health: 200,
    fuel: 100,
    seats: 2,
    radius: 25,
    hasBoost: false,
    boostMaxSpeed: 0,
    maxBoostFuel: 0,
    flies: false,
    waterOnly: true,
    ramDamage: 0.3,
  },
};

interface TrailPoint {
  pos: { x: number; y: number };
  alpha: number;
  rotation: number;
}

export class VehicleSystem {
  private vehicles: Vehicle[];
  private trails: Map<string, TrailPoint[]>;
  private explosionQueue: { pos: { x: number; y: number }; timer: number; maxTimer: number; radius: number }[];
  private vehicleIdCounter: number;

  constructor() {
    this.vehicles = [];
    this.trails = new Map();
    this.explosionQueue = [];
    this.vehicleIdCounter = 0;
  }

  private generateId(): string {
    return `vehicle_${this.vehicleIdCounter++}_${Date.now()}`;
  }

  private createVehicle(type: VehicleConfig['type'], x: number, y: number): Vehicle {
    const cfg = VEHICLE_CONFIGS[type];
    return {
      id: this.generateId(),
      type: cfg.type,
      pos: vec2(x, y),
      vel: vec2(0, 0),
      rotation: Math.random() * Math.PI * 2,
      speed: 0,
      maxSpeed: cfg.maxSpeed,
      acceleration: cfg.acceleration,
      turnSpeed: cfg.turnSpeed,
      health: cfg.health,
      maxHealth: cfg.health,
      fuel: cfg.fuel,
      maxFuel: cfg.fuel,
      seats: cfg.seats,
      occupiedBy: new Array(cfg.seats).fill(null),
      driver: null,
      alive: true,
      radius: cfg.radius,
      boosting: false,
      boostFuel: cfg.maxBoostFuel,
      maxBoostFuel: cfg.maxBoostFuel,
    };
  }

  spawnVehicles(mapSize: number): void {
    const margin = 200;
    const playable = mapSize - margin * 2;

    for (let i = 0; i < 3; i++) {
      const x = margin + Math.random() * playable;
      const y = margin + Math.random() * playable;
      this.vehicles.push(this.createVehicle('golfcart', x, y));
    }

    for (let i = 0; i < 2; i++) {
      const x = margin + Math.random() * playable;
      const y = margin + Math.random() * playable;
      this.vehicles.push(this.createVehicle('atk', x, y));
    }

    {
      const x = mapSize * 0.25 + Math.random() * mapSize * 0.5;
      const y = mapSize * 0.25 + Math.random() * mapSize * 0.5;
      this.vehicles.push(this.createVehicle('choppa', x, y));
    }

    for (let i = 0; i < 2; i++) {
      const waterCenter = mapSize * 0.5;
      const x = waterCenter + randomRange(-mapSize * 0.3, mapSize * 0.3);
      const y = waterCenter + randomRange(-mapSize * 0.3, mapSize * 0.3);
      this.vehicles.push(this.createVehicle('boat', x, y));
    }
  }

  private isWaterTile(x: number, y: number, state: any): boolean {
    if (!state.waterTiles) return false;
    const tileX = Math.floor(x / CONFIG.TILE_SIZE);
    const tileY = Math.floor(y / CONFIG.TILE_SIZE);
    const key = `${tileX},${tileY}`;
    return state.waterTiles.has(key);
  }

  private canMoveTo(vehicle: Vehicle, x: number, y: number, state: any): boolean {
    const cfg = VEHICLE_CONFIGS[vehicle.type];
    if (cfg.flies) return true;

    if (x < 0 || y < 0 || x > state.mapSize || y > state.mapSize) return false;

    if (cfg.waterOnly) {
      return this.isWaterTile(x, y, state);
    }

    return true;
  }

  update(state: any, dt: number): void {
    for (const vehicle of this.vehicles) {
      if (!vehicle.alive) continue;

      this.updatePhysics(vehicle, dt, state);
      this.updateFuel(vehicle, dt);
      this.updateCollisionDamage(vehicle, state);
      this.updateBuildingRam(vehicle, state);
      this.updateTrail(vehicle);
    }

    this.updateExplosions(dt);
    this.cleanupTrails();
  }

  private updatePhysics(vehicle: Vehicle, dt: number, state: any): void {
    if (vehicle.driver && vehicle.fuel > 0) {
      const friction = 0.97;
      vehicle.vel.x *= friction;
      vehicle.vel.y *= friction;
    } else {
      const decel = 0.93;
      vehicle.vel.x *= decel;
      vehicle.vel.y *= decel;
      vehicle.speed *= decel;
    }

    vehicle.pos.x += vehicle.vel.x * dt;
    vehicle.pos.y += vehicle.vel.y * dt;

    vehicle.speed = vec2Len(vehicle.vel);

    const cfg = VEHICLE_CONFIGS[vehicle.type];
    if (cfg.waterOnly && !this.isWaterTile(vehicle.pos.x, vehicle.pos.y, state)) {
      vehicle.vel.x *= 0.9;
      vehicle.vel.y *= 0.9;
    }

    vehicle.pos.x = Math.max(0, Math.min(state.mapSize || CONFIG.MAP_SIZE, vehicle.pos.x));
    vehicle.pos.y = Math.max(0, Math.min(state.mapSize || CONFIG.MAP_SIZE, vehicle.pos.y));
  }

  private updateFuel(vehicle: Vehicle, dt: number): void {
    if (!vehicle.driver) return;
    if (vehicle.speed < 5) return;

    const fuelRate = vehicle.boosting ? 2.0 : 0.8;
    vehicle.fuel -= fuelRate * dt;

    if (vehicle.fuel <= 0) {
      vehicle.fuel = 0;
      vehicle.boosting = false;
    }
  }

  private updateCollisionDamage(vehicle: Vehicle, state: any): void {
    if (vehicle.speed < 50) return;

    const cfg = VEHICLE_CONFIGS[vehicle.type];
    const allEntities = [state.player, ...(state.bots || [])].filter((e: any) => e && e.alive);

    for (const entity of allEntities) {
      if (vehicle.occupiedBy.includes(entity.id)) continue;

      const d = dist(vehicle.pos, entity.pos);
      const hitRadius = vehicle.radius + (entity.radius || CONFIG.PLAYER_RADIUS);

      if (d < hitRadius) {
        const damage = vehicle.speed * cfg.ramDamage;
        entity.health -= damage;

        const pushDir = vec2Norm(vec2Sub(entity.pos, vehicle.pos));
        entity.pos.x += pushDir.x * 50;
        entity.pos.y += pushDir.y * 50;
        entity.vel = vec2Mul(pushDir, vehicle.speed * 0.5);

        if (entity.health <= 0) {
          entity.alive = false;
          if (state.killFeed) {
            state.killFeed.push(`${vehicle.driver || 'Vehicle'} ran over ${entity.id}`);
          }
        }

        if (state.particles) {
          state.particles.push(...createExplosion(entity.pos, 5, '#e74c3c'));
        }
      }
    }
  }

  private updateBuildingRam(vehicle: Vehicle, state: any): void {
    const cfg = VEHICLE_CONFIGS[vehicle.type];
    if (cfg.flies) return;
    if (vehicle.speed < 100) return;

    const buildings = state.buildings || [];
    for (const building of buildings) {
      if (!building.alive) continue;
      if (building.material !== 'wood') continue;

      const d = dist(vehicle.pos, building.pos);
      const hitRadius = vehicle.radius + (building.radius || 25);

      if (d < hitRadius) {
        const ramDamage = vehicle.speed * 0.5;
        building.health -= ramDamage;

        if (building.health <= 0) {
          building.alive = false;
          if (state.particles) {
            state.particles.push(...createExplosion(building.pos, 8, '#8B6914'));
          }
        }

        vehicle.health -= 10;
        if (vehicle.health <= 0) {
          this.destroyVehicle(vehicle, state);
        }
      }
    }
  }

  private updateTrail(vehicle: Vehicle): void {
    if (vehicle.speed < 20) return;

    if (!this.trails.has(vehicle.id)) {
      this.trails.set(vehicle.id, []);
    }

    const trail = this.trails.get(vehicle.id)!;
    trail.push({
      pos: vec2(vehicle.pos.x, vehicle.pos.y),
      alpha: 1.0,
      rotation: vehicle.rotation,
    });

    if (trail.length > 60) {
      trail.shift();
    }
  }

  private cleanupTrails(): void {
    for (const [id, trail] of this.trails) {
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].alpha -= 0.02;
        if (trail[i].alpha <= 0) {
          trail.splice(i, 1);
        }
      }
      if (trail.length === 0) {
        this.trails.delete(id);
      }
    }
  }

  private destroyVehicle(vehicle: Vehicle, state: any): void {
    vehicle.alive = false;

    for (let i = 0; i < vehicle.occupiedBy.length; i++) {
      const passengerId = vehicle.occupiedBy[i];
      if (passengerId) {
        const allEntities = [state.player, ...(state.bots || [])].filter((e: any) => e && e.alive);
        for (const entity of allEntities) {
          if (entity.id === passengerId) {
            entity.health -= 50;
            const pushDir = vec2Norm(vec2Sub(entity.pos, vehicle.pos));
            entity.pos.x += pushDir.x * 60;
            entity.pos.y += pushDir.y * 60;
            if (entity.health <= 0) entity.alive = false;
          }
        }
        vehicle.occupiedBy[i] = null;
      }
    }
    vehicle.driver = null;

    this.explosionQueue.push({
      pos: vec2(vehicle.pos.x, vehicle.pos.y),
      timer: 0,
      maxTimer: 0.8,
      radius: vehicle.radius * 3,
    });

    if (state.particles) {
      state.particles.push(...createExplosion(vehicle.pos, 30, '#e74c3c'));
      state.particles.push(...createExplosion(vehicle.pos, 15, '#f39c12'));
      state.particles.push(...createExplosion(vehicle.pos, 10, '#2c3e50'));
    }
  }

  private updateExplosions(dt: number): void {
    for (let i = this.explosionQueue.length - 1; i >= 0; i--) {
      this.explosionQueue[i].timer += dt;
      if (this.explosionQueue[i].timer >= this.explosionQueue[i].maxTimer) {
        this.explosionQueue.splice(i, 1);
      }
    }
  }

  tryEnter(playerId: string, playerPos: { x: number; y: number }, isPlayer: boolean): Vehicle | null {
    let closestVehicle: Vehicle | null = null;
    let closestDist = Infinity;

    for (const vehicle of this.vehicles) {
      if (!vehicle.alive) continue;
      const d = dist(playerPos, vehicle.pos);
      const enterRange = vehicle.radius + 60;
      if (d < enterRange && d < closestDist) {
        const hasSeat = vehicle.occupiedBy.some((s) => s === null);
        if (hasSeat) {
          closestDist = d;
          closestVehicle = vehicle;
        }
      }
    }

    if (!closestVehicle) return null;

    const existingVehicle = this.getVehicleForPlayer(playerId);
    if (existingVehicle) return null;

    const seatIndex = closestVehicle.occupiedBy.indexOf(null);
    if (seatIndex === -1) return null;

    closestVehicle.occupiedBy[seatIndex] = playerId;

    if (closestVehicle.driver === null) {
      closestVehicle.driver = playerId;
    }

    return closestVehicle;
  }

  tryExit(playerId: string): boolean {
    const vehicle = this.getVehicleForPlayer(playerId);
    if (!vehicle) return false;

    const seatIndex = vehicle.occupiedBy.indexOf(playerId);
    if (seatIndex === -1) return false;

    vehicle.occupiedBy[seatIndex] = null;

    if (vehicle.driver === playerId) {
      vehicle.driver = null;
      for (let i = 0; i < vehicle.occupiedBy.length; i++) {
        if (vehicle.occupiedBy[i] !== null) {
          vehicle.driver = vehicle.occupiedBy[i];
          break;
        }
      }
    }

    return true;
  }

  getVehicleForPlayer(playerId: string): Vehicle | null {
    for (const vehicle of this.vehicles) {
      if (!vehicle.alive) continue;
      if (vehicle.occupiedBy.includes(playerId)) {
        return vehicle;
      }
    }
    return null;
  }

  handleInput(
    vehicle: Vehicle,
    input: { forward: boolean; backward: boolean; left: boolean; right: boolean; boost: boolean },
    dt: number,
  ): void {
    if (!vehicle.alive || !vehicle.driver || vehicle.fuel <= 0) return;

    const cfg = VEHICLE_CONFIGS[vehicle.type];
    let currentMaxSpeed = vehicle.maxSpeed;

    if (cfg.hasBoost && input.boost && vehicle.boostFuel > 0) {
      vehicle.boosting = true;
      currentMaxSpeed = cfg.boostMaxSpeed;
      vehicle.boostFuel -= 40 * dt;
      if (vehicle.boostFuel <= 0) {
        vehicle.boostFuel = 0;
        vehicle.boosting = false;
      }
    } else {
      vehicle.boosting = false;
      if (cfg.hasBoost && !input.boost) {
        vehicle.boostFuel = Math.min(vehicle.maxBoostFuel, vehicle.boostFuel + 10 * dt);
      }
    }

    if (input.left) {
      vehicle.rotation -= vehicle.turnSpeed * dt;
    }
    if (input.right) {
      vehicle.rotation += vehicle.turnSpeed * dt;
    }

    const accelCurve = 1 - Math.pow(vehicle.speed / currentMaxSpeed, 2);
    const effectiveAccel = vehicle.acceleration * Math.max(0.1, accelCurve);

    if (input.forward) {
      vehicle.vel.x += Math.cos(vehicle.rotation) * effectiveAccel * dt;
      vehicle.vel.y += Math.sin(vehicle.rotation) * effectiveAccel * dt;
    }
    if (input.backward) {
      vehicle.vel.x -= Math.cos(vehicle.rotation) * effectiveAccel * 0.5 * dt;
      vehicle.vel.y -= Math.sin(vehicle.rotation) * effectiveAccel * 0.5 * dt;
    }

    const currentSpeed = vec2Len(vehicle.vel);
    if (currentSpeed > currentMaxSpeed) {
      const norm = vec2Norm(vehicle.vel);
      vehicle.vel = vec2Mul(norm, currentMaxSpeed);
    }
  }

  damageVehicle(vehicleId: string, damage: number, state: any): void {
    const vehicle = this.getVehicleById(vehicleId);
    if (!vehicle || !vehicle.alive) return;

    vehicle.health -= damage;

    if (state.particles) {
      state.particles.push(...createExplosion(vehicle.pos, 3, '#f39c12'));
    }

    if (vehicle.health <= 0) {
      this.destroyVehicle(vehicle, state);
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: any): void {
    this.renderTrails(ctx, camera);
    this.renderVehicles(ctx, camera);
    this.renderExplosions(ctx, camera);
  }

  private renderTrails(ctx: CanvasRenderingContext2D, camera: any): void {
    for (const [vehicleId, trail] of this.trails) {
      const vehicle = this.getVehicleById(vehicleId);
      if (!vehicle) continue;

      const cfg = VEHICLE_CONFIGS[vehicle.type];

      for (const point of trail) {
        if (point.alpha <= 0) continue;

        const screenX = point.pos.x - camera.x;
        const screenY = point.pos.y - camera.y;

        ctx.save();
        ctx.globalAlpha = point.alpha * 0.3;
        ctx.translate(screenX, screenY);
        ctx.rotate(point.rotation);

        if (cfg.waterOnly) {
          ctx.strokeStyle = '#5dade2';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, vehicle.radius * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (!cfg.flies) {
          ctx.fillStyle = '#555';
          ctx.fillRect(-2, -vehicle.radius * 0.7, 4, 3);
          ctx.fillRect(-2, vehicle.radius * 0.4, 4, 3);
        }

        ctx.restore();
      }
    }
  }

  private renderVehicles(ctx: CanvasRenderingContext2D, camera: any): void {
    for (const vehicle of this.vehicles) {
      if (!vehicle.alive) continue;

      const screenX = vehicle.pos.x - camera.x;
      const screenY = vehicle.pos.y - camera.y;

      if (screenX < -100 || screenY < -100 || screenX > ctx.canvas.width + 100 || screenY > ctx.canvas.height + 100) continue;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(vehicle.rotation);

      this.renderVehicleShadow(ctx, vehicle);
      this.renderVehicleBody(ctx, vehicle);
      this.renderVehicleDetails(ctx, vehicle);
      this.renderDamageEffects(ctx, vehicle);
      this.renderBoostEffect(ctx, vehicle);

      ctx.restore();

      this.renderOverheadUI(ctx, vehicle, screenX, screenY);
    }
  }

  private renderVehicleShadow(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';

    const cfg = VEHICLE_CONFIGS[vehicle.type];
    if (cfg.flies) {
      ctx.translate(8, 8);
    } else {
      ctx.translate(3, 3);
    }

    this.drawVehicleShape(ctx, vehicle, '#000');
    ctx.restore();
  }

  private renderVehicleBody(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    const cfg = VEHICLE_CONFIGS[vehicle.type];
    let bodyColor: string;
    let accentColor: string;

    switch (vehicle.type) {
      case 'golfcart':
        bodyColor = '#27ae60';
        accentColor = '#2ecc71';
        break;
      case 'atk':
        bodyColor = '#2980b9';
        accentColor = '#3498db';
        break;
      case 'choppa':
        bodyColor = '#7f8c8d';
        accentColor = '#95a5a6';
        break;
      case 'boat':
        bodyColor = '#e67e22';
        accentColor = '#f39c12';
        break;
    }

    this.drawVehicleShape(ctx, vehicle, bodyColor, accentColor);
  }

  private drawVehicleShape(ctx: CanvasRenderingContext2D, vehicle: Vehicle, color: string, accent?: string): void {
    const r = vehicle.radius;

    switch (vehicle.type) {
      case 'golfcart': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-r * 0.8, -r * 0.5, r * 1.6, r, 4);
        ctx.fill();

        if (accent) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.roundRect(-r * 0.3, -r * 0.4, r * 0.6, r * 0.8, 2);
          ctx.fill();
        }

        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-r * 0.5, -r * 0.5, 4, 0, Math.PI * 2);
        ctx.arc(-r * 0.5, r * 0.5, 4, 0, Math.PI * 2);
        ctx.arc(r * 0.5, -r * 0.5, 4, 0, Math.PI * 2);
        ctx.arc(r * 0.5, r * 0.5, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#89CFF0';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.roundRect(r * 0.2, -r * 0.35, r * 0.35, r * 0.7, 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'atk': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, -r * 0.6, r * 1.8, r * 1.2, 5);
        ctx.fill();

        if (accent) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.roundRect(-r * 0.6, -r * 0.45, r * 1.2, r * 0.9, 3);
          ctx.fill();

          ctx.fillStyle = '#1a5276';
          ctx.fillRect(-r * 0.1, -r * 0.45, r * 0.2, r * 0.9);
        }

        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(-r * 0.65, -r * 0.6, 5, 0, Math.PI * 2);
        ctx.arc(-r * 0.65, r * 0.6, 5, 0, Math.PI * 2);
        ctx.arc(r * 0.65, -r * 0.6, 5, 0, Math.PI * 2);
        ctx.arc(r * 0.65, r * 0.6, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#c0392b';
        ctx.fillRect(r * 0.75, -r * 0.15, r * 0.15, r * 0.3);
        break;
      }
      case 'choppa': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        if (accent) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.7, r * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#bdc3c7';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        const rotorAngle = (Date.now() / 50) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(Math.cos(rotorAngle) * r * 1.2, Math.sin(rotorAngle) * r * 0.3);
        ctx.lineTo(Math.cos(rotorAngle + Math.PI) * r * 1.2, Math.sin(rotorAngle + Math.PI) * r * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(rotorAngle + Math.PI / 2) * r * 1.2, Math.sin(rotorAngle + Math.PI / 2) * r * 0.3);
        ctx.lineTo(Math.cos(rotorAngle + Math.PI * 1.5) * r * 1.2, Math.sin(rotorAngle + Math.PI * 1.5) * r * 0.3);
        ctx.stroke();

        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-r * 0.15, -r * 0.6, r * 0.3, r * 0.12);
        break;
      }
      case 'boat': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.quadraticCurveTo(r * 0.5, -r * 0.7, -r * 0.8, -r * 0.5);
        ctx.lineTo(-r, 0);
        ctx.lineTo(-r * 0.8, r * 0.5);
        ctx.quadraticCurveTo(r * 0.5, r * 0.7, r, 0);
        ctx.closePath();
        ctx.fill();

        if (accent) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.moveTo(r * 0.8, 0);
          ctx.quadraticCurveTo(r * 0.3, -r * 0.4, -r * 0.4, -r * 0.3);
          ctx.lineTo(-r * 0.5, 0);
          ctx.lineTo(-r * 0.4, r * 0.3);
          ctx.quadraticCurveTo(r * 0.3, r * 0.4, r * 0.8, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.arc(-r * 0.2, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  private renderVehicleDetails(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    const r = vehicle.radius;

    if (vehicle.type === 'choppa') {
      ctx.fillStyle = '#34495e';
      ctx.fillRect(r * 0.5, -3, r * 0.5, 6);
      ctx.fillRect(r * 0.9, -6, 3, 12);
    }

    if (vehicle.type === 'atk') {
      ctx.fillStyle = '#f1c40f';
      ctx.globalAlpha = vehicle.speed > 100 ? 0.8 : 0.3;
      ctx.beginPath();
      ctx.arc(r * 0.9, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const occupiedCount = vehicle.occupiedBy.filter((s) => s !== null).length;
    if (occupiedCount > 0) {
      ctx.fillStyle = '#2ecc71';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private renderDamageEffects(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    const healthRatio = vehicle.health / vehicle.maxHealth;

    if (healthRatio < 0.5 && healthRatio >= 0.25) {
      const smokeIntensity = 1 - healthRatio * 2;
      const time = Date.now() / 200;

      for (let i = 0; i < 2; i++) {
        const offsetX = Math.sin(time + i * 2) * 8;
        const offsetY = Math.cos(time + i * 3) * 8;
        ctx.globalAlpha = smokeIntensity * 0.4;
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(offsetX, offsetY - 5, 6 + Math.sin(time + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (healthRatio < 0.25) {
      const time = Date.now() / 100;
      for (let i = 0; i < 3; i++) {
        const offsetX = Math.sin(time + i * 1.5) * 10;
        const offsetY = Math.cos(time + i * 2) * 10 - 8;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = i === 0 ? '#e74c3c' : '#f39c12';
        ctx.beginPath();
        ctx.arc(offsetX, offsetY, 4 + Math.sin(time * 2 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#333';
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        const sx = Math.sin(time * 0.5 + i * 1.2) * 12;
        const sy = Math.cos(time * 0.7 + i * 1.5) * 12 - 12;
        ctx.beginPath();
        ctx.arc(sx, sy, 5 + Math.sin(time + i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private renderBoostEffect(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    if (!vehicle.boosting) return;

    const r = vehicle.radius;
    const time = Date.now() / 50;

    ctx.save();
    ctx.globalAlpha = 0.6;

    for (let i = 0; i < 6; i++) {
      const offset = -r - 5 - i * 12 - Math.random() * 8;
      const spread = (Math.random() - 0.5) * 20;
      const lineLen = 15 + Math.random() * 25;

      ctx.strokeStyle = i < 2 ? '#f1c40f' : '#e67e22';
      ctx.lineWidth = 2 - i * 0.2;
      ctx.beginPath();
      ctx.moveTo(offset, spread);
      ctx.lineTo(offset - lineLen, spread);
      ctx.stroke();
    }

    ctx.fillStyle = '#f39c12';
    ctx.globalAlpha = 0.3 + Math.sin(time) * 0.2;
    ctx.beginPath();
    ctx.arc(-r - 5, 0, 10 + Math.sin(time * 2) * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderOverheadUI(ctx: CanvasRenderingContext2D, vehicle: Vehicle, screenX: number, screenY: number): void {
    const occupiedCount = vehicle.occupiedBy.filter((s) => s !== null).length;
    const uiY = screenY - vehicle.radius - 18;

    ctx.save();
    ctx.translate(screenX, uiY);

    const barWidth = 40;
    const barHeight = 4;

    ctx.fillStyle = '#333';
    ctx.fillRect(-barWidth / 2, 0, barWidth, barHeight);
    const healthRatio = vehicle.health / vehicle.maxHealth;
    const healthColor = healthRatio > 0.5 ? '#2ecc71' : healthRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = healthColor;
    ctx.fillRect(-barWidth / 2, 0, barWidth * healthRatio, barHeight);

    ctx.fillStyle = '#333';
    ctx.fillRect(-barWidth / 2, 6, barWidth, 3);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(-barWidth / 2, 6, barWidth * (vehicle.fuel / vehicle.maxFuel), 3);

    if (vehicle.maxBoostFuel > 0) {
      ctx.fillStyle = '#333';
      ctx.fillRect(-barWidth / 2, 11, barWidth, 3);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-barWidth / 2, 11, barWidth * (vehicle.boostFuel / vehicle.maxBoostFuel), 3);
    }

    if (occupiedCount === 0) {
      const time = Date.now() / 500;
      const glowAlpha = 0.3 + Math.sin(time) * 0.15;
      ctx.globalAlpha = glowAlpha;
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, vehicle.radius + 18, vehicle.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private renderExplosions(ctx: CanvasRenderingContext2D, camera: any): void {
    for (const explosion of this.explosionQueue) {
      const screenX = explosion.pos.x - camera.x;
      const screenY = explosion.pos.y - camera.y;
      const progress = explosion.timer / explosion.maxTimer;

      ctx.save();
      ctx.translate(screenX, screenY);

      const maxR = explosion.radius;
      const currentR = maxR * Math.min(1, progress * 3);
      const alpha = 1 - progress;

      ctx.globalAlpha = alpha * 0.8;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentR);
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.2, '#f1c40f');
      gradient.addColorStop(0.5, '#e74c3c');
      gradient.addColorStop(0.8, '#e67e22');
      gradient.addColorStop(1, 'rgba(231, 76, 60, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, currentR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#2c3e50';
      const smokeR = currentR * 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, smokeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  getVehicles(): Vehicle[] {
    return this.vehicles;
  }

  getVehicleById(id: string): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === id);
  }
}
