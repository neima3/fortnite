import { SERVER_CONFIG } from '../config.js';

export class ServerStormSystem {
  constructor() {
    this.phaseIndex = 0;
    this.phaseTimer = 0;
    this.moving = false;
    this.moveDuration = 30;
    this.moveTimer = 0;
    this.startRadius = 3200;
    this.startCenter = { x: 2000, y: 2000 };
    this.stormRadius = 3200;
    this.stormCenter = { x: 2000, y: 2000 };
    this.nextStormRadius = 3200;
    this.nextStormCenter = { x: 2000, y: 2000 };
    this.stormDamage = 1;
  }

  update(dt, state) {
    state.matchTime += dt;
    state.stormTimer += dt;
    if (this.phaseIndex < SERVER_CONFIG.STORM_PHASES.length) {
      const phase = SERVER_CONFIG.STORM_PHASES[this.phaseIndex];
      if (!this.moving && state.stormTimer >= phase.time) {
        this.moving = true;
        this.moveTimer = 0;
        this.startRadius = this.stormRadius;
        this.startCenter = { x: this.stormCenter.x, y: this.stormCenter.y };
        this.nextStormRadius = phase.radius;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * (this.stormRadius - this.nextStormRadius);
        this.nextStormCenter = {
          x: Math.max(this.nextStormRadius, Math.min(SERVER_CONFIG.MAP_SIZE - this.nextStormRadius, this.stormCenter.x + Math.cos(angle) * r)),
          y: Math.max(this.nextStormRadius, Math.min(SERVER_CONFIG.MAP_SIZE - this.nextStormRadius, this.stormCenter.y + Math.sin(angle) * r)),
        };
        this.stormDamage = phase.damage;
        this.phaseIndex++;
      }
      if (this.moving) {
        this.moveTimer += dt;
        const t = Math.min(1, this.moveTimer / this.moveDuration);
        this.stormRadius = this.startRadius + (this.nextStormRadius - this.startRadius) * t;
        this.stormCenter.x = this.startCenter.x + (this.nextStormCenter.x - this.startCenter.x) * t;
        this.stormCenter.y = this.startCenter.y + (this.nextStormCenter.y - this.startCenter.y) * t;
        if (t >= 1) { this.moving = false; state.stormTimer = 0; }
      }
    }
    // Apply storm damage to all players
    state.players.forEach((player) => {
      if (!player.alive) return;
      const dx = player.x - this.stormCenter.x;
      const dy = player.y - this.stormCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this.stormRadius) {
        const dmg = this.stormDamage * dt;
        if (player.shield > 0) {
          const sd = Math.min(player.shield, dmg);
          player.shield -= sd;
        } else {
          player.health -= dmg;
        }
        if (player.health <= 0) {
          player.health = 0;
          player.alive = false;
        }
      }
    });
    state.stormRadius = this.stormRadius;
    state.stormCenterX = this.stormCenter.x;
    state.stormCenterY = this.stormCenter.y;
    state.stormPhase = this.phaseIndex;
    state.stormDamage = this.stormDamage;
    state.nextStormRadius = this.nextStormRadius;
    state.nextStormCenterX = this.nextStormCenter.x;
    state.nextStormCenterY = this.nextStormCenter.y;
    state.playersAlive = Array.from(state.players.values()).filter(p => p.alive).length;
  }
}
