import { Player, GameState, Vec2 } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, vec2Norm, vec2Mul, dist, angleTo } from '../utils/math.js';
import { CombatSystem } from './CombatSystem.js';

export type BotState = 'patrolling' | 'attacking' | 'fleeing' | 'healing' | 'moving_to_zone';

export interface BotAI {
  bot: Player;
  state: BotState;
  targetPos: Vec2 | null;
  targetEnemy: string | null;
  stateTimer: number;
  reactionTimer: number;
  accuracy: number;
  buildSkill: number;
}

export class AISystem {
  private bots: BotAI[] = [];
  private combatSystem: CombatSystem;

  constructor(combat: CombatSystem) {
    this.combatSystem = combat;
  }

  spawnBots(state: GameState, count: number) {
    for (let i = 0; i < count; i++) {
      const bot: Player = {
        id: `bot_${i}`,
        pos: vec2(Math.random() * CONFIG.MAP_SIZE, Math.random() * CONFIG.MAP_SIZE),
        vel: vec2(0, 0), radius: CONFIG.PLAYER_RADIUS, rotation: 0, alive: true,
        health: CONFIG.PLAYER_MAX_HEALTH, shield: Math.floor(Math.random() * 50),
        speed: CONFIG.PLAYER_SPEED, sprinting: false,
        materials: { wood: Math.floor(Math.random() * 200), brick: Math.floor(Math.random() * 100), metal: Math.floor(Math.random() * 50) },
        inventory: [
          this.createBotWeapon(), this.createBotWeapon(),
          Math.random() > 0.5 ? this.createBotWeapon() : null, null, null,
        ],
        selectedSlot: 0, aiming: false,
      };
      const ai: BotAI = {
        bot, state: 'patrolling', targetPos: null, targetEnemy: null,
        stateTimer: 0, reactionTimer: Math.random() * 2,
        accuracy: 0.3 + Math.random() * 0.5, buildSkill: Math.random(),
      };
      this.bots.push(ai);
      state.bots.push(bot);
    }
    state.playersAlive = 1 + count;
  }

  private createBotWeapon(): any {
    const types = ['pistol', 'ar', 'shotgun', 'smg', 'sniper'];
    const type = types[Math.floor(Math.random() * types.length)];
    const w = CONFIG.WEAPONS[type as keyof typeof CONFIG.WEAPONS];
    return {
      name: type, type, rarity: 'common',
      damage: w.damage, fireRate: w.fireRate, magazine: w.magazine,
      ammo: w.magazine, maxAmmo: w.magazine, reloadTime: w.reloadTime,
      ammoType: type === 'shotgun' ? 'shells' : type === 'sniper' ? 'heavy' : 'medium',
      lastFireTime: 0, spread: w.spread, projectileSpeed: w.projectileSpeed,
    };
  }

  update(state: GameState, dt: number) {
    for (const ai of this.bots) {
      if (!ai.bot.alive) continue;
      this.updateBot(ai, state, dt);
    }
  }

  private updateBot(ai: BotAI, state: GameState, dt: number) {
    ai.stateTimer += dt;
    ai.reactionTimer -= dt;
    const bot = ai.bot;

    // Storm avoidance priority
    const stormDist = dist(bot.pos, state.stormCenter);
    if (stormDist > state.stormRadius - 50 && ai.state !== 'moving_to_zone') {
      ai.state = 'moving_to_zone';
      ai.targetPos = this.findPointInZone(state);
      ai.stateTimer = 0;
    }

    switch (ai.state) {
      case 'patrolling': this.updatePatrolling(ai, state, dt); break;
      case 'attacking': this.updateAttacking(ai, state, dt); break;
      case 'fleeing': this.updateFleeing(ai, state, dt); break;
      case 'healing': this.updateHealing(ai, state, dt); break;
      case 'moving_to_zone': this.updateMovingToZone(ai, state, dt); break;
    }

    bot.pos.x += bot.vel.x * dt;
    bot.pos.y += bot.vel.y * dt;
    bot.pos.x = Math.max(bot.radius, Math.min(CONFIG.MAP_SIZE - bot.radius, bot.pos.x));
    bot.pos.y = Math.max(bot.radius, Math.min(CONFIG.MAP_SIZE - bot.radius, bot.pos.y));
  }

  private updatePatrolling(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    const enemy = this.findNearestEnemy(bot, state);
    if (enemy && dist(bot.pos, enemy.pos) < 400 && ai.reactionTimer <= 0) {
      ai.state = 'attacking';
      ai.targetEnemy = enemy.id;
      ai.stateTimer = 0;
      return;
    }
    if (!ai.targetPos || dist(bot.pos, ai.targetPos) < 30 || ai.stateTimer > 5) {
      ai.targetPos = vec2(
        Math.max(100, Math.min(CONFIG.MAP_SIZE - 100, bot.pos.x + (Math.random() - 0.5) * 400)),
        Math.max(100, Math.min(CONFIG.MAP_SIZE - 100, bot.pos.y + (Math.random() - 0.5) * 400))
      );
      ai.stateTimer = 0;
    }
    this.moveToTarget(bot, ai.targetPos);
  }

  private updateAttacking(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    const enemy = this.getTargetEnemy(ai, state);
    if (!enemy || !enemy.alive) {
      ai.state = 'patrolling';
      ai.targetEnemy = null;
      return;
    }
    const d = dist(bot.pos, enemy.pos);
    bot.rotation = angleTo(bot.pos, enemy.pos);
    if (d < 150) bot.selectedSlot = this.findWeaponSlot(bot, 'shotgun');
    else if (d > 500) bot.selectedSlot = this.findWeaponSlot(bot, 'sniper');
    else bot.selectedSlot = this.findWeaponSlot(bot, 'ar');
    bot.aiming = d > 200;
    if (ai.reactionTimer <= 0 && Math.random() < ai.accuracy * 0.3) {
      const error = (1 - ai.accuracy) * 0.3;
      bot.rotation += (Math.random() - 0.5) * error;
      this.combatSystem.fireWeapon(state, bot);
      ai.reactionTimer = 0.5 + Math.random();
    }
    if (d > 250) this.moveToTarget(bot, enemy.pos, 0.6);
    else if (d < 100) {
      const retreatDir = angleTo(enemy.pos, bot.pos);
      bot.vel = vec2Mul(vec2Norm(vec2(Math.cos(retreatDir), Math.sin(retreatDir))), bot.speed * 0.8);
    } else { bot.vel = vec2(0, 0); }
    if (bot.health < 30 && Math.random() < 0.01) {
      ai.state = 'fleeing';
      ai.targetPos = vec2(bot.pos.x + (Math.random() - 0.5) * 600, bot.pos.y + (Math.random() - 0.5) * 600);
    }
  }

  private updateFleeing(ai: BotAI, state: GameState, dt: number) {
    if (!ai.targetPos || dist(ai.bot.pos, ai.targetPos) < 30 || ai.stateTimer > 4) {
      ai.state = 'patrolling';
      ai.targetPos = null;
      return;
    }
    this.moveToTarget(ai.bot, ai.targetPos, 1.2);
  }

  private updateHealing(ai: BotAI, state: GameState, dt: number) {
    ai.bot.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, ai.bot.health + 20 * dt);
    ai.bot.vel = vec2(0, 0);
    if (ai.bot.health >= 80 || ai.stateTimer > 3) {
      ai.state = 'patrolling';
    }
  }

  private updateMovingToZone(ai: BotAI, state: GameState, dt: number) {
    if (!ai.targetPos || dist(ai.bot.pos, ai.targetPos) < 30) {
      const stormDist = dist(ai.bot.pos, state.stormCenter);
      if (stormDist <= state.stormRadius - 30) {
        ai.state = 'patrolling';
        return;
      }
      ai.targetPos = this.findPointInZone(state);
    }
    ai.bot.sprinting = true;
    this.moveToTarget(ai.bot, ai.targetPos, 1.0);
  }

  private moveToTarget(bot: Player, target: Vec2, speedMult: number = 1.0) {
    const dir = vec2Norm(vec2(target.x - bot.pos.x, target.y - bot.pos.y));
    bot.vel = vec2Mul(dir, bot.speed * speedMult);
  }

  private findNearestEnemy(bot: Player, state: GameState): Player | null {
    let nearest: Player | null = null;
    let nearestDist = Infinity;
    const targets = [state.player, ...state.bots].filter(e => e.id !== bot.id && e.alive);
    for (const t of targets) {
      const d = dist(bot.pos, t.pos);
      if (d < nearestDist && d < 500) { nearestDist = d; nearest = t; }
    }
    return nearest;
  }

  private getTargetEnemy(ai: BotAI, state: GameState): Player | null {
    if (!ai.targetEnemy) return null;
    return [state.player, ...state.bots].find(e => e.id === ai.targetEnemy) || null;
  }

  private findWeaponSlot(bot: Player, type: string): number {
    const idx = bot.inventory.findIndex(w => w && w.type === type);
    return idx !== -1 ? idx : 0;
  }

  private findPointInZone(state: GameState): Vec2 {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (state.stormRadius * 0.7);
    return vec2(
      Math.max(50, Math.min(CONFIG.MAP_SIZE - 50, state.stormCenter.x + Math.cos(angle) * r)),
      Math.max(50, Math.min(CONFIG.MAP_SIZE - 50, state.stormCenter.y + Math.sin(angle) * r))
    );
  }
}
