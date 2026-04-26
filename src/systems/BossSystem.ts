import { GameState, Player, Vec2 } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, dist, angleTo } from '../utils/math.js';

export interface BossEnemy extends Player {
  isBoss: boolean;
  bossType: 'guardian' | 'overlord' | 'raider';
  attackCooldown: number;
  specialAttackTimer: number;
  phase: number;
  maxPhases: number;
  deathProcessed?: boolean;
}

export class BossSystem {
  private bosses: BossEnemy[] = [];
  private spawnTimer: number = 0;
  private eventActive: boolean = false;

  spawnGuardian(state: GameState, x: number, y: number) {
    const boss: BossEnemy = {
      id: `boss_guardian_${Date.now()}`,
      pos: vec2(x, y),
      vel: vec2(0, 0),
      radius: 35,
      rotation: 0,
      alive: true,
      health: 500,
      shield: 200,
      speed: 200,
      sprinting: false,
      materials: { wood: 0, brick: 0, metal: 0 },
      inventory: [],
      selectedSlot: 0,
      aiming: false,
      isBoss: true,
      bossType: 'guardian',
      attackCooldown: 0,
      specialAttackTimer: 0,
      phase: 1,
      maxPhases: 3,
    };
    this.bosses.push(boss);
    state.bots.push(boss as any);
    state.playersAlive++;
  }

  spawnOverlord(state: GameState) {
    const boss: BossEnemy = {
      id: `boss_overlord_${Date.now()}`,
      pos: vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2),
      vel: vec2(0, 0),
      radius: 50,
      rotation: 0,
      alive: true,
      health: 2000,
      shield: 500,
      speed: 150,
      sprinting: false,
      materials: { wood: 0, brick: 0, metal: 0 },
      inventory: [],
      selectedSlot: 0,
      aiming: false,
      isBoss: true,
      bossType: 'overlord',
      attackCooldown: 0,
      specialAttackTimer: 0,
      phase: 1,
      maxPhases: 3,
    };
    this.bosses.push(boss);
    state.bots.push(boss as any);
    state.playersAlive++;
    this.eventActive = true;
  }

  update(state: GameState, dt: number) {
    // Spawn guardians near supply drops
    for (const drop of state.supplyDrops) {
      if (!drop.alive || !drop.landed) continue;
      const hasGuardian = this.bosses.some(b => b.bossType === 'guardian' && b.alive && dist(b.pos, drop.pos) < 200);
      if (!hasGuardian) {
        this.spawnGuardian(state, drop.pos.x + 50, drop.pos.y + 50);
      }
    }

    // Boss event timer
    this.spawnTimer += dt;
    if (this.spawnTimer > 120 && !this.eventActive && state.matchPhase === 'playing') {
      this.spawnTimer = 0;
      this.spawnOverlord(state);
    }

    // Update bosses
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      boss.attackCooldown -= dt;
      boss.specialAttackTimer += dt;

      // Find nearest target
      let nearest: any = null;
      let nearestDist = Infinity;
      for (const entity of [state.player, ...state.bots]) {
        if (entity.id === boss.id || !entity.alive) continue;
        const d = dist(boss.pos, entity.pos);
        if (d < nearestDist && d < 600) { nearestDist = d; nearest = entity; }
      }

      if (nearest) {
        boss.rotation = angleTo(boss.pos, nearest.pos);
        const dx = nearest.pos.x - boss.pos.x;
        const dy = nearest.pos.y - boss.pos.y;
        const d = nearestDist || 1;
        const speed = boss.speed * (boss.phase > 1 ? 1.3 : 1);

        if (nearestDist > 100) {
          boss.pos.x += (dx / d) * speed * dt;
          boss.pos.y += (dy / d) * speed * dt;
        }

        // Attack
        if (boss.attackCooldown <= 0 && nearestDist < 300) {
          boss.attackCooldown = boss.bossType === 'overlord' ? 0.5 : 1.0;
          nearest.health -= boss.bossType === 'overlord' ? 15 : 25;
          if (nearest.health <= 0) { nearest.health = 0; nearest.alive = false; }
        }

        // Special attack
        if (boss.specialAttackTimer > 5) {
          boss.specialAttackTimer = 0;
          // Area damage around boss
          for (const entity of [state.player, ...state.bots]) {
            if (entity.id === boss.id || !entity.alive) continue;
            if (dist(boss.pos, entity.pos) < 150) {
              entity.health -= 30;
              if (entity.health <= 0) { entity.health = 0; entity.alive = false; }
            }
          }
        }
      }

      // Phase transitions
      const healthPercent = boss.health / (boss.bossType === 'overlord' ? 2000 : 500);
      if (healthPercent < 0.66 && boss.phase === 1) {
        boss.phase = 2;
        boss.speed *= 1.2;
      }
      if (healthPercent < 0.33 && boss.phase === 2) {
        boss.phase = 3;
        boss.speed *= 1.2;
      }

      if (boss.health <= 0) {
        boss.health = 0;
        boss.alive = false;
      }
    }

    // Process boss deaths (including from external damage sources)
    for (const boss of this.bosses) {
      if ((!boss.alive || boss.health <= 0) && !boss.deathProcessed) {
        boss.deathProcessed = true;
        boss.alive = false;
        boss.health = 0;
        state.playersAlive--;
        state.killFeed.unshift(`${boss.id} was DEFEATED!`);
        if (state.killFeed.length > 5) state.killFeed.pop();
        this.eventActive = false;
        // Drop legendary loot
        state.lootItems.push({
          id: `loot_boss_${Date.now()}`,
          pos: vec2(boss.pos.x, boss.pos.y),
          vel: vec2(0, 0), radius: 20, rotation: 0, alive: true,
          item: { name: 'legendary_crate', type: 'loot' },
          quantity: 1,
        } as any);
      }
    }

    state.bots = state.bots.filter(b => b.alive || !b.isBoss);
    this.bosses = this.bosses.filter(b => b.alive);
  }

  render(ctx: CanvasRenderingContext2D, state: GameState) {
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      ctx.save();
      ctx.translate(boss.pos.x, boss.pos.y);
      ctx.rotate(boss.rotation);
      // Boss body
      ctx.fillStyle = boss.bossType === 'overlord' ? '#8e44ad' : '#c0392b';
      ctx.beginPath();
      ctx.arc(0, 0, boss.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Direction indicator
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(boss.radius + 8, 0);
      ctx.lineTo(boss.radius - 5, -8);
      ctx.lineTo(boss.radius - 5, 8);
      ctx.fill();
      ctx.restore();
      // Health bar (larger)
      const barW = 50;
      ctx.fillStyle = '#333';
      ctx.fillRect(boss.pos.x - barW / 2, boss.pos.y - boss.radius - 14, barW, 6);
      ctx.fillStyle = boss.health > (boss.bossType === 'overlord' ? 1000 : 250) ? '#e74c3c' : '#f39c12';
      const maxH = boss.bossType === 'overlord' ? 2000 : 500;
      ctx.fillRect(boss.pos.x - barW / 2, boss.pos.y - boss.radius - 14, barW * (boss.health / maxH), 6);
      // Boss name
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(boss.bossType.toUpperCase(), boss.pos.x, boss.pos.y - boss.radius - 20);
    }
  }
}
