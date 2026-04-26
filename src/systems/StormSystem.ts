import { GameState, Vec2 } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, dist } from '../utils/math.js';

export class StormSystem {
  private phaseIndex: number = 0;
  private phaseTimer: number = 0;
  private moving: boolean = false;
  private moveDuration: number = 30;
  private moveTimer: number = 0;
  private startRadius: number = 0;
  private startCenter: Vec2 = vec2(0, 0);

  update(state: GameState, dt: number) {
    if (state.matchPhase !== 'playing') return;
    state.stormTimer += dt;
    state.matchTime += dt;

    if (this.phaseIndex < CONFIG.STORM_PHASES.length) {
      const phase = CONFIG.STORM_PHASES[this.phaseIndex];
      if (!this.moving && state.stormTimer >= phase.time) {
        this.moving = true;
        this.moveTimer = 0;
        this.startRadius = state.stormRadius;
        this.startCenter = vec2(state.stormCenter.x, state.stormCenter.y);
        state.nextStormRadius = phase.radius;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * (state.stormRadius - state.nextStormRadius);
        state.nextStormCenter = vec2(
          state.stormCenter.x + Math.cos(angle) * r,
          state.stormCenter.y + Math.sin(angle) * r
        );
        state.nextStormCenter.x = Math.max(state.nextStormRadius, Math.min(CONFIG.MAP_SIZE - state.nextStormRadius, state.nextStormCenter.x));
        state.nextStormCenter.y = Math.max(state.nextStormRadius, Math.min(CONFIG.MAP_SIZE - state.nextStormRadius, state.nextStormCenter.y));
        state.stormDamage = phase.damage;
        this.phaseIndex++;
        state.stormPhase = this.phaseIndex;
      }
      if (this.moving) {
        this.moveTimer += dt;
        const t = Math.min(1, this.moveTimer / this.moveDuration);
        state.stormRadius = this.startRadius + (state.nextStormRadius - this.startRadius) * t;
        state.stormCenter.x = this.startCenter.x + (state.nextStormCenter.x - this.startCenter.x) * t;
        state.stormCenter.y = this.startCenter.y + (state.nextStormCenter.y - this.startCenter.y) * t;
        if (t >= 1) { this.moving = false; state.stormTimer = 0; }
      }
    }

    // Apply storm damage to player
    const playerDist = dist(state.player.pos, state.stormCenter);
    if (playerDist > state.stormRadius) {
      const dmg = state.stormDamage * dt;
      if (state.player.shield > 0) {
        const sd = Math.min(state.player.shield, dmg);
        state.player.shield -= sd;
      } else {
        state.player.health -= dmg;
      }
      if (state.player.health <= 0) {
        state.player.health = 0;
        state.player.alive = false;
        state.matchPhase = 'ended';
      }
    }
  }

  getStormWarning(state: GameState): number {
    const d = dist(state.player.pos, state.stormCenter);
    if (d > state.stormRadius) return 1;
    if (d > state.stormRadius - 100) return (state.stormRadius - d) / 100;
    return 0;
  }

  reset() {
    this.phaseIndex = 0;
    this.phaseTimer = 0;
    this.moving = false;
    this.moveTimer = 0;
  }
}
