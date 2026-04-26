import { GameState, Player } from '../types.js';
import { dist } from '../utils/math.js';

export class SpectatorSystem {
  private targetIndex: number = 0;
  private targets: Player[] = [];
  active: boolean = false;

  startSpectating(state: GameState) {
    this.active = true;
    this.updateTargets(state);
  }

  stopSpectating() {
    this.active = false;
    this.targets = [];
    this.targetIndex = 0;
  }

  updateTargets(state: GameState) {
    this.targets = [state.player, ...state.bots].filter(p => p.alive);
    if (this.targetIndex >= this.targets.length) this.targetIndex = 0;
  }

  getCurrentTarget(): Player | null {
    if (!this.active || this.targets.length === 0) return null;
    return this.targets[this.targetIndex];
  }

  nextTarget(state: GameState) {
    this.updateTargets(state);
    this.targetIndex = (this.targetIndex + 1) % Math.max(1, this.targets.length);
  }

  prevTarget(state: GameState) {
    this.updateTargets(state);
    this.targetIndex = (this.targetIndex - 1 + Math.max(1, this.targets.length)) % Math.max(1, this.targets.length);
  }
}
