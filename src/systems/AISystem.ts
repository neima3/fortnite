import { Player, GameState, Vec2 } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, vec2Norm, vec2Mul, vec2Add, vec2Sub, dist, angleTo } from '../utils/math.js';
import { CombatSystem } from './CombatSystem.js';

export type BotState =
  | 'patrolling'
  | 'attacking'
  | 'fleeing'
  | 'healing'
  | 'moving_to_zone'
  | 'flanking'
  | 'looting'
  | 'building_cover'
  | 'sniping'
  | 'aggressive_push'
  | 'reviving';

export type BotPersonality = 'aggressive' | 'defensive' | 'balanced' | 'sniper';

export type DifficultyTier = 'noob' | 'average' | 'good' | 'pro' | 'godlike';

export interface BotAI {
  bot: Player;
  state: BotState;
  targetPos: Vec2 | null;
  targetEnemy: string | null;
  stateTimer: number;
  reactionTimer: number;
  accuracy: number;
  buildSkill: number;
  skillLevel: number;
  difficultyTier: DifficultyTier;
  personality: BotPersonality;
  lastDamageDir: Vec2 | null;
  lastDamageTime: number;
  isReloading: boolean;
  reloadTimer: number;
  strafeDir: number;
  strafeTimer: number;
  knownEnemies: { id: string; pos: Vec2; lastSeen: number }[];
  squadId: string | null;
  lastCalloutTime: number;
  wantsHighGround: boolean;
  pushTimer: number;
  healItemSlot: number;
  isHarvesting: boolean;
  harvestTimer: number;
  flankAngle: number;
  combatMode: boolean;
  retreatThreshold: number;
  aggressiveness: number;
  coverPos: Vec2 | null;
  buildingCooldown: number;
  shotLeadFactor: number;
}

const DIFFICULTY_THRESHOLDS: { tier: DifficultyTier; min: number; max: number }[] = [
  { tier: 'noob', min: 0, max: 0.2 },
  { tier: 'average', min: 0.2, max: 0.5 },
  { tier: 'good', min: 0.5, max: 0.7 },
  { tier: 'pro', min: 0.7, max: 0.9 },
  { tier: 'godlike', min: 0.9, max: 1.0 },
];

const DIFFICULTY_WEIGHTS = [0.30, 0.30, 0.25, 0.12, 0.03];

function rollDifficulty(): { level: number; tier: DifficultyTier } {
  const r = Math.random();
  let cumulative = 0;
  let tierIdx = 0;
  for (let i = 0; i < DIFFICULTY_WEIGHTS.length; i++) {
    cumulative += DIFFICULTY_WEIGHTS[i];
    if (r < cumulative) {
      tierIdx = i;
      break;
    }
  }
  const t = DIFFICULTY_THRESHOLDS[tierIdx];
  const level = t.min + Math.random() * (t.max - t.min);
  return { level, tier: t.tier };
}

function rollPersonality(): BotPersonality {
  const r = Math.random();
  if (r < 0.25) return 'aggressive';
  if (r < 0.50) return 'defensive';
  if (r < 0.75) return 'sniper';
  return 'balanced';
}

export class AISystem {
  private bots: BotAI[] = [];
  private combatSystem: CombatSystem;

  constructor(combat: CombatSystem) {
    this.combatSystem = combat;
  }

  spawnBots(state: GameState, count: number) {
    for (let i = 0; i < count; i++) {
      const { level, tier } = rollDifficulty();
      const personality = rollPersonality();

      const bot: Player = {
        id: `bot_${i}`,
        pos: vec2(Math.random() * CONFIG.MAP_SIZE, Math.random() * CONFIG.MAP_SIZE),
        vel: vec2(0, 0),
        radius: CONFIG.PLAYER_RADIUS,
        rotation: 0,
        alive: true,
        health: CONFIG.PLAYER_MAX_HEALTH,
        shield: Math.floor(Math.random() * 50),
        speed: CONFIG.PLAYER_SPEED,
        sprinting: false,
        materials: {
          wood: Math.floor(Math.random() * 200),
          brick: Math.floor(Math.random() * 100),
          metal: Math.floor(Math.random() * 50),
        },
        inventory: [
          this.createBotWeapon(tier),
          this.createBotWeapon(tier),
          Math.random() > 0.3 ? this.createBotWeapon(tier) : null,
          this.createConsumable(tier),
          this.createConsumable(tier),
        ],
        selectedSlot: 0,
        aiming: false,
      };

      const aggro = personality === 'aggressive' ? 0.9
        : personality === 'defensive' ? 0.2
        : personality === 'sniper' ? 0.3
        : 0.5;

      const accuracy = 0.2 + level * 0.7;
      const buildSkill = tier === 'noob' ? 0 : tier === 'average' ? level * 0.3 : 0.3 + level * 0.6;

      const ai: BotAI = {
        bot,
        state: 'patrolling',
        targetPos: null,
        targetEnemy: null,
        stateTimer: 0,
        reactionTimer: 0.5 + Math.random() * (1.5 - level * 1.2),
        accuracy,
        buildSkill,
        skillLevel: level,
        difficultyTier: tier,
        personality,
        lastDamageDir: null,
        lastDamageTime: -10,
        isReloading: false,
        reloadTimer: 0,
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        strafeTimer: 0,
        knownEnemies: [],
        squadId: i < count ? `squad_${Math.floor(i / 4)}` : null,
        lastCalloutTime: -10,
        wantsHighGround: personality === 'sniper' || personality === 'defensive',
        pushTimer: 0,
        healItemSlot: -1,
        isHarvesting: false,
        harvestTimer: 0,
        flankAngle: (Math.random() - 0.5) * Math.PI * 0.6,
        combatMode: false,
        retreatThreshold: personality === 'aggressive' ? 0.1 : personality === 'defensive' ? 0.5 : 0.25,
        aggressiveness: aggro,
        coverPos: null,
        buildingCooldown: 0,
        shotLeadFactor: level * 0.15,
      };

      this.bots.push(ai);
      state.bots.push(bot);
    }
    state.playersAlive = 1 + count;
  }

  private createBotWeapon(tier: DifficultyTier): any {
    let types: string[];
    switch (tier) {
      case 'noob': types = ['pistol', 'pistol', 'smg']; break;
      case 'average': types = ['ar', 'shotgun', 'smg', 'pistol']; break;
      case 'good': types = ['ar', 'shotgun', 'sniper', 'smg']; break;
      case 'pro': types = ['ar', 'shotgun', 'sniper', 'ar']; break;
      case 'godlike': types = ['sniper', 'ar', 'shotgun', 'ar']; break;
      default: types = ['pistol', 'ar', 'shotgun'];
    }
    const type = types[Math.floor(Math.random() * types.length)];
    const w = CONFIG.WEAPONS[type as keyof typeof CONFIG.WEAPONS];
    const rarities: Record<DifficultyTier, string[]> = {
      noob: ['common'],
      average: ['common', 'uncommon'],
      good: ['uncommon', 'rare'],
      pro: ['rare', 'epic'],
      godlike: ['epic', 'legendary'],
    };
    const rarityList = rarities[tier];
    const rarity = rarityList[Math.floor(Math.random() * rarityList.length)];
    const rarityMult = rarity === 'common' ? 1 : rarity === 'uncommon' ? 1.1 : rarity === 'rare' ? 1.2 : rarity === 'epic' ? 1.35 : 1.5;
    return {
      name: type,
      type,
      rarity,
      damage: Math.round(w.damage * rarityMult),
      fireRate: w.fireRate,
      magazine: w.magazine,
      ammo: w.magazine,
      maxAmmo: w.magazine,
      reloadTime: w.reloadTime,
      ammoType: type === 'shotgun' ? 'shells' : type === 'sniper' ? 'heavy' : 'medium',
      lastFireTime: 0,
      spread: w.spread,
      projectileSpeed: w.projectileSpeed,
    };
  }

  private createConsumable(tier: DifficultyTier): any {
    const types = ['medkit', 'bandage', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
      name: type,
      type,
      rarity: 'common',
      damage: 0,
      fireRate: 0,
      magazine: 1,
      ammo: 1,
      maxAmmo: 1,
      reloadTime: 0,
      ammoType: '',
      lastFireTime: 0,
      spread: 0,
      projectileSpeed: 0,
      healAmount: type === 'medkit' ? 50 : type === 'bandage' ? 15 : 50,
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
    ai.buildingCooldown -= dt;
    const bot = ai.bot;

    this.decayKnownEnemies(ai, dt);
    this.detectEnemies(ai, state);

    if (ai.squadId) {
      this.processSquadCallouts(ai, state);
    }

    if (ai.isReloading) {
      ai.reloadTimer -= dt;
      if (ai.reloadTimer <= 0) {
        const weapon = bot.inventory[bot.selectedSlot];
        if (weapon) {
          this.combatSystem.reload(weapon);
        }
        ai.isReloading = false;
      }
    }

    if (ai.isHarvesting) {
      ai.harvestTimer -= dt;
      if (ai.harvestTimer <= 0) {
        bot.materials.wood += 30 + Math.floor(Math.random() * 20);
        bot.materials.brick += 10 + Math.floor(Math.random() * 10);
        ai.isHarvesting = false;
      }
      bot.vel = vec2(0, 0);
      return;
    }

    const stormDist = dist(bot.pos, state.stormCenter);
    const stormUrgency = stormDist > state.stormRadius - 100;

    if (stormUrgency && ai.state !== 'moving_to_zone') {
      ai.state = 'moving_to_zone';
      ai.targetPos = this.findPointInZone(state);
      ai.stateTimer = 0;
      ai.combatMode = false;
    }

    if (ai.combatMode && stormDist > state.stormRadius - 200) {
      ai.state = 'moving_to_zone';
      ai.targetPos = this.findPointInZone(state);
      ai.stateTimer = 0;
      ai.combatMode = false;
    }

    if (bot.health < 40 && !ai.combatMode && ai.state !== 'healing' && ai.state !== 'moving_to_zone') {
      const healSlot = this.findHealItem(bot);
      if (healSlot >= 0) {
        ai.state = 'healing';
        ai.healItemSlot = healSlot;
        ai.stateTimer = 0;
      }
    }

    if (bot.materials.wood < 50 && ai.skillLevel > 0.2 && ai.state === 'patrolling' && !ai.combatMode) {
      const pickaxeSlot = this.findWeaponSlot(bot, 'pickaxe');
      if (pickaxeSlot >= 0) {
        ai.isHarvesting = true;
        ai.harvestTimer = 2.0;
        bot.selectedSlot = pickaxeSlot;
        return;
      }
    }

    const nearbyEnemies = this.countNearbyEnemies(bot, state, 300);
    if (nearbyEnemies >= 3 && bot.health < 60 && ai.skillLevel > 0.3 && ai.state !== 'fleeing') {
      ai.state = 'fleeing';
      ai.targetPos = this.findRetreatPosition(bot, state);
      ai.stateTimer = 0;
      ai.combatMode = false;
    }

    switch (ai.state) {
      case 'patrolling': this.updatePatrolling(ai, state, dt); break;
      case 'attacking': this.updateAttacking(ai, state, dt); break;
      case 'fleeing': this.updateFleeing(ai, state, dt); break;
      case 'healing': this.updateHealing(ai, state, dt); break;
      case 'moving_to_zone': this.updateMovingToZone(ai, state, dt); break;
      case 'flanking': this.updateFlanking(ai, state, dt); break;
      case 'looting': this.updateLooting(ai, state, dt); break;
      case 'building_cover': this.updateBuildingCover(ai, state, dt); break;
      case 'sniping': this.updateSniping(ai, state, dt); break;
      case 'aggressive_push': this.updateAggressivePush(ai, state, dt); break;
      case 'reviving': this.updatePatrolling(ai, state, dt); break;
    }

    bot.pos.x += bot.vel.x * dt;
    bot.pos.y += bot.vel.y * dt;
    bot.pos.x = Math.max(bot.radius, Math.min(CONFIG.MAP_SIZE - bot.radius, bot.pos.x));
    bot.pos.y = Math.max(bot.radius, Math.min(CONFIG.MAP_SIZE - bot.radius, bot.pos.y));
  }

  private detectEnemies(ai: BotAI, state: GameState) {
    const bot = ai.bot;
    const detectionRange = 300 + ai.skillLevel * 400;
    const targets = [state.player, ...state.bots].filter(e => e.id !== bot.id && e.alive);

    for (const t of targets) {
      const d = dist(bot.pos, t.pos);
      if (d < detectionRange) {
        const existing = ai.knownEnemies.find(ke => ke.id === t.id);
        if (existing) {
          existing.pos = vec2(t.pos.x, t.pos.y);
          existing.lastSeen = performance.now() / 1000;
        } else {
          ai.knownEnemies.push({ id: t.id, pos: vec2(t.pos.x, t.pos.y), lastSeen: performance.now() / 1000 });
        }
      }
    }
  }

  private decayKnownEnemies(ai: BotAI, dt: number) {
    const now = performance.now() / 1000;
    const memoryDuration = 3 + ai.skillLevel * 5;
    ai.knownEnemies = ai.knownEnemies.filter(ke => now - ke.lastSeen < memoryDuration);
  }

  private processSquadCallouts(ai: BotAI, state: GameState) {
    const now = performance.now() / 1000;
    if (now - ai.lastCalloutTime < 2) return;

    if (ai.targetEnemy) {
      const enemy = this.getTargetEnemy(ai, state);
      if (enemy) {
        for (const other of this.bots) {
          if (other.bot.id === ai.bot.id || !other.bot.alive) continue;
          if (other.squadId === ai.squadId) {
            const d = dist(ai.bot.pos, other.bot.pos);
            if (d < 500) {
              const existingTarget = other.knownEnemies.find(ke => ke.id === enemy.id);
              if (!existingTarget) {
                other.knownEnemies.push({ id: enemy.id, pos: vec2(enemy.pos.x, enemy.pos.y), lastSeen: now });
              } else {
                existingTarget.pos = vec2(enemy.pos.x, enemy.pos.y);
                existingTarget.lastSeen = now;
              }
              if (!other.targetEnemy && other.personality === 'aggressive') {
                other.targetEnemy = enemy.id;
                other.state = 'aggressive_push';
                other.stateTimer = 0;
                other.combatMode = true;
              }
            }
          }
        }
        ai.lastCalloutTime = now;
      }
    }
  }

  private updatePatrolling(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    const enemy = this.findNearestEnemy(bot, state);
    const detectionRange = 200 + ai.skillLevel * 300;

    if (enemy && dist(bot.pos, enemy.pos) < detectionRange && ai.reactionTimer <= 0) {
      ai.targetEnemy = enemy.id;
      ai.combatMode = true;
      ai.stateTimer = 0;

      const d = dist(bot.pos, enemy.pos);
      if (ai.personality === 'aggressive' && d < 400) {
        ai.state = 'aggressive_push';
      } else if (ai.personality === 'sniper' && d > 300 && this.hasWeaponType(bot, 'sniper')) {
        ai.state = 'sniping';
      } else if (ai.personality === 'defensive') {
        ai.state = 'attacking';
        ai.coverPos = this.findCoverPosition(bot, enemy.pos, state);
      } else if (ai.skillLevel > 0.5 && d > 200 && d < 600) {
        ai.state = 'flanking';
        ai.flankAngle = (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.3 + Math.random() * Math.PI * 0.4);
      } else {
        ai.state = 'attacking';
      }
      return;
    }

    if (state.lootItems && state.lootItems.length > 0 && ai.skillLevel > 0.15) {
      const nearLoot = this.findNearestLoot(bot, state, 400);
      if (nearLoot && Math.random() < 0.4) {
        ai.state = 'looting';
        ai.targetPos = vec2(nearLoot.pos.x, nearLoot.pos.y);
        ai.stateTimer = 0;
        return;
      }
    }

    if (!ai.targetPos || dist(bot.pos, ai.targetPos) < 30 || ai.stateTimer > 5) {
      ai.targetPos = vec2(
        Math.max(100, Math.min(CONFIG.MAP_SIZE - 100, bot.pos.x + (Math.random() - 0.5) * 500)),
        Math.max(100, Math.min(CONFIG.MAP_SIZE - 100, bot.pos.y + (Math.random() - 0.5) * 500))
      );
      ai.stateTimer = 0;
    }

    this.moveToTarget(bot, ai.targetPos);

    if (ai.squadId) {
      this.maintainSquadProximity(ai, state);
    }
  }

  private updateAttacking(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    const enemy = this.getTargetEnemy(ai, state);
    if (!enemy || !enemy.alive) {
      ai.state = 'patrolling';
      ai.targetEnemy = null;
      ai.combatMode = false;
      return;
    }

    const d = dist(bot.pos, enemy.pos);
    bot.rotation = angleTo(bot.pos, enemy.pos);

    if (ai.lastDamageDir && (performance.now() / 1000 - ai.lastDamageTime) < 1 && ai.buildSkill > 0.3) {
      if (ai.buildingCooldown <= 0 && bot.materials.wood >= 10) {
        ai.state = 'building_cover';
        ai.stateTimer = 0;
        return;
      }
    }

    if (d < 150) {
      bot.selectedSlot = this.findBestWeaponForRange(bot, 'close');
    } else if (d > 500) {
      bot.selectedSlot = this.findBestWeaponForRange(bot, 'far');
    } else {
      bot.selectedSlot = this.findBestWeaponForRange(bot, 'medium');
    }

    const weapon = bot.inventory[bot.selectedSlot];
    if (weapon && weapon.ammo <= 0 && !ai.isReloading) {
      if (ai.skillLevel > 0.3 && this.hasAmmoInOtherWeapon(bot)) {
        bot.selectedSlot = this.findWeaponWithAmmo(bot);
      } else {
        ai.isReloading = true;
        ai.reloadTimer = weapon.reloadTime * (1.1 - ai.skillLevel * 0.3);
      }
    }

    bot.aiming = d > 200 || (ai.personality === 'sniper');

    this.updateStrafe(ai, dt);
    const strafeVec = this.getStrafeVector(bot.rotation, ai.strafeDir);

    if (ai.reactionTimer <= 0 && !ai.isReloading) {
      const fireChance = ai.accuracy * (0.2 + ai.skillLevel * 0.3);
      if (Math.random() < fireChance) {
        const leadAngle = this.calculateShotLead(bot, enemy, ai.shotLeadFactor);
        const error = (1 - ai.accuracy) * 0.25;
        bot.rotation = leadAngle + (Math.random() - 0.5) * error;
        this.combatSystem.fireWeapon(state, bot);
        ai.reactionTimer = 0.1 + (1 - ai.skillLevel) * 0.4 + Math.random() * 0.2;
      }
    }

    if (ai.coverPos && dist(bot.pos, ai.coverPos) > 30) {
      this.moveToTarget(bot, ai.coverPos, 0.8);
      bot.vel = vec2Add(bot.vel, vec2Mul(strafeVec, bot.speed * 0.3));
    } else if (d > 300) {
      this.moveToTarget(bot, enemy.pos, 0.5 + ai.aggressiveness * 0.4);
      bot.vel = vec2Add(bot.vel, vec2Mul(strafeVec, bot.speed * 0.4));
    } else if (d < 80) {
      const retreatDir = angleTo(enemy.pos, bot.pos);
      bot.vel = vec2Mul(vec2Norm(vec2(Math.cos(retreatDir), Math.sin(retreatDir))), bot.speed * 0.9);
      bot.vel = vec2Add(bot.vel, vec2Mul(strafeVec, bot.speed * 0.5));
    } else {
      bot.vel = vec2Mul(strafeVec, bot.speed * 0.6);
    }

    if (bot.health < CONFIG.PLAYER_MAX_HEALTH * ai.retreatThreshold && Math.random() < 0.02 * ai.skillLevel) {
      ai.state = 'fleeing';
      ai.targetPos = this.findRetreatPosition(bot, state);
      ai.combatMode = false;
    }

    if (ai.personality === 'aggressive' && d < 200 && ai.skillLevel > 0.5) {
      ai.state = 'aggressive_push';
      ai.pushTimer = 0;
    }
  }

  private updateFleeing(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    if (!ai.targetPos || dist(bot.pos, ai.targetPos) < 30 || ai.stateTimer > 4) {
      ai.state = 'patrolling';
      ai.targetPos = null;
      ai.combatMode = false;
      return;
    }
    this.moveToTarget(bot, ai.targetPos, 1.3);
    bot.sprinting = true;

    if (bot.health < 50) {
      const healSlot = this.findHealItem(bot);
      if (healSlot >= 0 && !this.hasNearbyEnemies(bot, state, 200)) {
        ai.state = 'healing';
        ai.healItemSlot = healSlot;
        ai.stateTimer = 0;
        return;
      }
    }
  }

  private updateHealing(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    bot.vel = vec2(0, 0);

    if (this.hasNearbyEnemies(bot, state, 250)) {
      ai.state = 'attacking';
      ai.combatMode = true;
      return;
    }

    const healSlot = bot.inventory[ai.healItemSlot];
    if (healSlot && (healSlot.type === 'medkit' || healSlot.type === 'bandage' || healSlot.type === 'shield')) {
      const healAmount = (healSlot as any).healAmount || 25;
      if (healSlot.type === 'shield') {
        bot.shield = Math.min(CONFIG.PLAYER_MAX_SHIELD, bot.shield + healAmount * dt * 0.5);
      } else {
        bot.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, bot.health + healAmount * dt * 0.5);
      }
      if (bot.health >= 80 && bot.shield >= 50) {
        ai.state = 'patrolling';
        ai.combatMode = false;
      }
      if (ai.stateTimer > 5) {
        ai.state = 'patrolling';
        ai.combatMode = false;
      }
    } else {
      ai.state = 'patrolling';
      ai.combatMode = false;
    }
  }

  private updateMovingToZone(ai: BotAI, state: GameState, dt: number) {
    if (!ai.targetPos || dist(ai.bot.pos, ai.targetPos) < 30) {
      const stormDist = dist(ai.bot.pos, state.stormCenter);
      if (stormDist <= state.stormRadius - 60) {
        ai.state = 'patrolling';
        ai.combatMode = false;
        ai.bot.sprinting = false;
        return;
      }
      ai.targetPos = this.findPointInZone(state);
    }
    ai.bot.sprinting = true;
    this.moveToTarget(ai.bot, ai.targetPos, 1.0);
  }

  private updateFlanking(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    const enemy = this.getTargetEnemy(ai, state);
    if (!enemy || !enemy.alive) {
      ai.state = 'patrolling';
      ai.targetEnemy = null;
      ai.combatMode = false;
      return;
    }

    const d = dist(bot.pos, enemy.pos);
    if (ai.stateTimer > 8) {
      ai.state = 'attacking';
      ai.stateTimer = 0;
      return;
    }

    if (d < 100) {
      ai.state = 'aggressive_push';
      ai.pushTimer = 0;
      return;
    }

    const directAngle = angleTo(bot.pos, enemy.pos);
    const flankAngle = directAngle + ai.flankAngle;
    const flankTarget = vec2(
      enemy.pos.x - Math.cos(flankAngle) * 120,
      enemy.pos.y - Math.sin(flankAngle) * 120
    );

    this.moveToTarget(bot, flankTarget, 0.9);
    bot.sprinting = ai.skillLevel > 0.6;

    if (d < 350 && ai.reactionTimer <= 0 && ai.skillLevel > 0.5) {
      bot.selectedSlot = this.findBestWeaponForRange(bot, 'medium');
      bot.rotation = angleTo(bot.pos, enemy.pos);
      bot.aiming = true;
      const error = (1 - ai.accuracy) * 0.2;
      bot.rotation += (Math.random() - 0.5) * error;
      this.combatSystem.fireWeapon(state, bot);
      ai.reactionTimer = 0.3 + (1 - ai.skillLevel) * 0.3;
    }

    if (bot.health < 40) {
      ai.state = 'attacking';
      ai.stateTimer = 0;
    }
  }

  private updateLooting(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;

    if (!state.lootItems || state.lootItems.length === 0) {
      ai.state = 'patrolling';
      return;
    }

    if (!ai.targetPos) {
      const nearLoot = this.findNearestLoot(bot, state, 600);
      if (nearLoot) {
        ai.targetPos = vec2(nearLoot.pos.x, nearLoot.pos.y);
      } else {
        ai.state = 'patrolling';
        return;
      }
    }

    const lootDist = dist(bot.pos, ai.targetPos);
    if (lootDist < 30) {
      const lootIdx = state.lootItems.findIndex(l => dist(l.pos, bot.pos) < 50 && l.alive);
      if (lootIdx >= 0) {
        const loot = state.lootItems[lootIdx];
        if (typeof loot.item !== 'string' && loot.item) {
          const emptySlot = bot.inventory.findIndex(s => s === null);
          const worseSlot = bot.inventory.findIndex(s => s && typeof s !== 'string' && (loot.item as any).damage && s.damage < (loot.item as any).damage);
          if (emptySlot >= 0) {
            bot.inventory[emptySlot] = loot.item;
          } else if (worseSlot >= 0 && Math.random() < 0.6) {
            bot.inventory[worseSlot] = loot.item;
          }
        }
        loot.alive = false;
      }
      ai.state = 'patrolling';
      ai.targetPos = null;
      return;
    }

    this.moveToTarget(bot, ai.targetPos, 0.8);

    const enemy = this.findNearestEnemy(bot, state);
    if (enemy && dist(bot.pos, enemy.pos) < 250) {
      ai.state = 'attacking';
      ai.targetEnemy = enemy.id;
      ai.combatMode = true;
      ai.stateTimer = 0;
    }
  }

  private updateBuildingCover(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    bot.vel = vec2(0, 0);

    if (ai.buildSkill < 0.2 || bot.materials.wood < 10) {
      ai.state = 'attacking';
      ai.stateTimer = 0;
      return;
    }

    if (ai.stateTimer > 1.5) {
      ai.state = 'attacking';
      ai.stateTimer = 0;
      return;
    }

    if (ai.buildingCooldown <= 0 && bot.materials.wood >= 10) {
      const coverDir = ai.lastDamageDir
        ? vec2Norm(ai.lastDamageDir)
        : (ai.targetEnemy ? vec2Norm(vec2Sub(bot.pos, this.getTargetEnemy(ai, state)?.pos || bot.pos)) : vec2(1, 0));

      if (state.buildings && ai.buildSkill > 0.3) {
        const wallPos = vec2Add(bot.pos, vec2Mul(coverDir, CONFIG.BUILDING_GRID_SIZE));
        state.buildings.push({
          id: `build_${bot.id}_${Date.now()}`,
          pos: wallPos,
          vel: vec2(0, 0),
          radius: CONFIG.BUILDING_GRID_SIZE * 0.5,
          rotation: Math.atan2(coverDir.y, coverDir.x),
          alive: true,
          type: 'wall',
          material: 'wood',
          health: CONFIG.MATERIALS.wood.maxHealth,
          maxHealth: CONFIG.MATERIALS.wood.maxHealth,
          building: true,
          buildProgress: 0,
          buildTime: CONFIG.MATERIALS.wood.buildTime,
          builtAt: performance.now() / 1000,
        });
        bot.materials.wood -= 10;
        ai.buildingCooldown = 0.5;

        if (ai.buildSkill > 0.6 && bot.materials.wood >= 20) {
          const rampPos = vec2Add(bot.pos, vec2Mul(coverDir, CONFIG.BUILDING_GRID_SIZE * 0.5));
          state.buildings.push({
            id: `build_${bot.id}_${Date.now()}_r`,
            pos: rampPos,
            vel: vec2(0, 0),
            radius: CONFIG.BUILDING_GRID_SIZE * 0.5,
            rotation: Math.atan2(coverDir.y, coverDir.x),
            alive: true,
            type: 'stair',
            material: 'wood',
            health: CONFIG.MATERIALS.wood.maxHealth * 0.8,
            maxHealth: CONFIG.MATERIALS.wood.maxHealth * 0.8,
            building: true,
            buildProgress: 0,
            buildTime: CONFIG.MATERIALS.wood.buildTime,
            builtAt: performance.now() / 1000,
          });
          bot.materials.wood -= 10;
        }
      }

      ai.state = 'attacking';
      ai.stateTimer = 0;
    }
  }

  private updateSniping(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    const enemy = this.getTargetEnemy(ai, state);
    if (!enemy || !enemy.alive) {
      ai.state = 'patrolling';
      ai.targetEnemy = null;
      ai.combatMode = false;
      return;
    }

    const d = dist(bot.pos, enemy.pos);

    if (d < 200) {
      ai.state = 'attacking';
      ai.stateTimer = 0;
      return;
    }

    if (ai.wantsHighGround && !ai.targetPos) {
      const highGround = this.findHighGround(bot, state);
      ai.targetPos = highGround;
    }

    if (ai.targetPos && dist(bot.pos, ai.targetPos) > 30) {
      this.moveToTarget(bot, ai.targetPos, 0.6);
    } else {
      bot.vel = vec2(0, 0);
    }

    bot.rotation = angleTo(bot.pos, enemy.pos);
    bot.selectedSlot = this.findBestWeaponForRange(bot, 'far');
    bot.aiming = true;

    if (ai.reactionTimer <= 0 && !ai.isReloading) {
      const weapon = bot.inventory[bot.selectedSlot];
      if (weapon && weapon.ammo > 0) {
        const leadAngle = this.calculateShotLead(bot, enemy, ai.shotLeadFactor * 1.5);
        const error = (1 - ai.accuracy) * 0.15;
        bot.rotation = leadAngle + (Math.random() - 0.5) * error;
        this.combatSystem.fireWeapon(state, bot);
        ai.reactionTimer = 0.5 + (1 - ai.skillLevel) * 1.5 + Math.random() * 0.3;
      } else if (weapon && weapon.ammo <= 0 && !ai.isReloading) {
        ai.isReloading = true;
        ai.reloadTimer = weapon.reloadTime;
      }
    }

    if (bot.health < 50 && ai.skillLevel > 0.4) {
      ai.state = 'fleeing';
      ai.targetPos = this.findRetreatPosition(bot, state);
      ai.combatMode = false;
    }
  }

  private updateAggressivePush(ai: BotAI, state: GameState, dt: number) {
    const bot = ai.bot;
    const enemy = this.getTargetEnemy(ai, state);
    if (!enemy || !enemy.alive) {
      ai.state = 'patrolling';
      ai.targetEnemy = null;
      ai.combatMode = false;
      return;
    }

    ai.pushTimer += dt;
    const d = dist(bot.pos, enemy.pos);

    if (d < 100) {
      bot.selectedSlot = this.findBestWeaponForRange(bot, 'close');
    } else {
      bot.selectedSlot = this.findBestWeaponForRange(bot, 'medium');
    }

    bot.rotation = angleTo(bot.pos, enemy.pos);
    bot.aiming = d > 150;
    bot.sprinting = true;

    if (d > 60) {
      this.moveToTarget(bot, enemy.pos, 1.2 + ai.skillLevel * 0.3);
    } else {
      bot.vel = vec2(0, 0);
    }

    if (ai.reactionTimer <= 0 && !ai.isReloading) {
      const weapon = bot.inventory[bot.selectedSlot];
      if (weapon && weapon.ammo > 0) {
        const error = (1 - ai.accuracy) * 0.2;
        bot.rotation += (Math.random() - 0.5) * error;
        this.combatSystem.fireWeapon(state, bot);
        ai.reactionTimer = 0.1 + (1 - ai.skillLevel) * 0.2;
      } else if (weapon && weapon.ammo <= 0 && !ai.isReloading) {
        if (this.hasAmmoInOtherWeapon(bot)) {
          bot.selectedSlot = this.findWeaponWithAmmo(bot);
        } else {
          ai.isReloading = true;
          ai.reloadTimer = weapon.reloadTime;
        }
      }
    }

    if (ai.pushTimer > 5 || bot.health < 30) {
      if (bot.health < 50) {
        ai.state = 'fleeing';
        ai.targetPos = this.findRetreatPosition(bot, state);
        ai.combatMode = false;
      } else {
        ai.state = 'attacking';
        ai.stateTimer = 0;
      }
    }
  }

  private updateStrafe(ai: BotAI, dt: number) {
    ai.strafeTimer += dt;
    const interval = 0.8 + Math.random() * 1.5;
    if (ai.strafeTimer > interval) {
      ai.strafeDir *= -1;
      ai.strafeTimer = 0;
    }
  }

  private getStrafeVector(rotation: number, dir: number): Vec2 {
    const perpAngle = rotation + Math.PI / 2;
    return vec2(Math.cos(perpAngle) * dir, Math.sin(perpAngle) * dir);
  }

  private calculateShotLead(bot: Player, enemy: Player, factor: number): number {
    const baseAngle = angleTo(bot.pos, enemy.pos);
    if (factor < 0.01) return baseAngle;

    const velAngle = Math.atan2(enemy.vel.y, enemy.vel.x);
    const speed = Math.sqrt(enemy.vel.x * enemy.vel.x + enemy.vel.y * enemy.vel.y);

    if (speed < 10) return baseAngle;

    const d = dist(bot.pos, enemy.pos);
    const leadAmount = factor * speed * d / 1500 * 0.02;
    return baseAngle + Math.sin(velAngle - baseAngle) * leadAmount;
  }

  private findCoverPosition(bot: Player, enemyPos: Vec2, state: GameState): Vec2 | null {
    const awayFromEnemy = vec2Norm(vec2Sub(bot.pos, enemyPos));
    let bestPos: Vec2 | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const testPos = vec2Add(bot.pos, vec2Mul(vec2(Math.cos(angle), Math.sin(angle)), 80));
      const distFromEnemy = dist(testPos, enemyPos);
      const toEnemy = vec2Norm(vec2Sub(enemyPos, testPos));
      const dot = toEnemy.x * awayFromEnemy.x + toEnemy.y * awayFromEnemy.y;

      let score = distFromEnemy * 0.5 + dot * 100;

      if (state.buildings) {
        for (const b of state.buildings) {
          if (b.alive && b.type === 'wall' && dist(testPos, b.pos) < 60) {
            score += 200;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPos = testPos;
      }
    }

    return bestPos;
  }

  private findHighGround(bot: Player, state: GameState): Vec2 {
    const centerX = CONFIG.MAP_SIZE / 2;
    const centerY = CONFIG.MAP_SIZE / 2;

    const preferDist = 400 + Math.random() * 300;
    const preferAngle = Math.random() * Math.PI * 2;

    let target = vec2(
      Math.max(100, Math.min(CONFIG.MAP_SIZE - 100, bot.pos.x + Math.cos(preferAngle) * preferDist)),
      Math.max(100, Math.min(CONFIG.MAP_SIZE - 100, bot.pos.y + Math.sin(preferAngle) * preferDist))
    );

    const stormDist = dist(target, state.stormCenter);
    if (stormDist > state.stormRadius * 0.8) {
      target = this.findPointInZone(state);
    }

    return target;
  }

  private findRetreatPosition(bot: Player, state: GameState): Vec2 {
    const angle = Math.random() * Math.PI * 2;
    const retreatDist = 400 + Math.random() * 300;
    let target = vec2(
      bot.pos.x + Math.cos(angle) * retreatDist,
      bot.pos.y + Math.sin(angle) * retreatDist
    );
    target.x = Math.max(50, Math.min(CONFIG.MAP_SIZE - 50, target.x));
    target.y = Math.max(50, Math.min(CONFIG.MAP_SIZE - 50, target.y));

    const stormDist = dist(target, state.stormCenter);
    if (stormDist > state.stormRadius - 100) {
      target = this.findPointInZone(state);
    }

    return target;
  }

  private maintainSquadProximity(ai: BotAI, state: GameState) {
    const maxSpread = 300;
    let nearestMate: Player | null = null;
    let nearestDist = Infinity;

    for (const other of this.bots) {
      if (other.bot.id === ai.bot.id || !other.bot.alive || other.squadId !== ai.squadId) continue;
      const d = dist(ai.bot.pos, other.bot.pos);
      if (d < nearestDist) {
        nearestDist = d;
        nearestMate = other.bot;
      }
    }

    if (nearestMate && nearestDist > maxSpread && ai.state === 'patrolling') {
      const towardMate = vec2Norm(vec2Sub(nearestMate.pos, ai.bot.pos));
      ai.targetPos = vec2Add(ai.bot.pos, vec2Mul(towardMate, 100));
    }
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
      if (d < nearestDist) { nearestDist = d; nearest = t; }
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

  private findBestWeaponForRange(bot: Player, range: 'close' | 'medium' | 'far'): number {
    const rangePreference: Record<string, string[]> = {
      close: ['shotgun', 'smg', 'ar', 'pistol', 'sniper'],
      medium: ['ar', 'smg', 'pistol', 'shotgun', 'sniper'],
      far: ['sniper', 'ar', 'pistol', 'smg', 'shotgun'],
    };
    const prefs = rangePreference[range];
    for (const type of prefs) {
      const idx = bot.inventory.findIndex(w => w && w.type === type && w.ammo > 0);
      if (idx !== -1) return idx;
    }
    const anyWeapon = bot.inventory.findIndex(w => w && w.ammo > 0 && w.type !== 'medkit' && w.type !== 'bandage' && w.type !== 'shield');
    return anyWeapon !== -1 ? anyWeapon : 0;
  }

  private hasWeaponType(bot: Player, type: string): boolean {
    return bot.inventory.some(w => w && w.type === type);
  }

  private hasAmmoInOtherWeapon(bot: Player): boolean {
    return bot.inventory.some((w, i) => w && i !== bot.selectedSlot && w.ammo > 0 && w.type !== 'medkit' && w.type !== 'bandage' && w.type !== 'shield');
  }

  private findWeaponWithAmmo(bot: Player): number {
    const idx = bot.inventory.findIndex(w => w && w.ammo > 0 && w.type !== 'medkit' && w.type !== 'bandage' && w.type !== 'shield');
    return idx !== -1 ? idx : 0;
  }

  private findHealItem(bot: Player): number {
    if (bot.health < CONFIG.PLAYER_MAX_HEALTH) {
      const medkit = bot.inventory.findIndex(w => w && w.type === 'medkit');
      if (medkit >= 0) return medkit;
      const bandage = bot.inventory.findIndex(w => w && w.type === 'bandage');
      if (bandage >= 0 && bot.health < 75) return bandage;
    }
    if (bot.shield < CONFIG.PLAYER_MAX_SHIELD) {
      const shield = bot.inventory.findIndex(w => w && w.type === 'shield');
      if (shield >= 0) return shield;
    }
    return -1;
  }

  private findNearestLoot(bot: Player, state: GameState, range: number): any {
    if (!state.lootItems) return null;
    let nearest: any = null;
    let nearestDist = Infinity;
    for (const l of state.lootItems) {
      if (!l.alive) continue;
      const d = dist(bot.pos, l.pos);
      if (d < range && d < nearestDist) {
        nearestDist = d;
        nearest = l;
      }
    }
    return nearest;
  }

  private countNearbyEnemies(bot: Player, state: GameState, range: number): number {
    return [state.player, ...state.bots].filter(e => e.id !== bot.id && e.alive && dist(bot.pos, e.pos) < range).length;
  }

  private hasNearbyEnemies(bot: Player, state: GameState, range: number): boolean {
    return this.countNearbyEnemies(bot, state, range) > 0;
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
