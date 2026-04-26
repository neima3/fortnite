import { GameState } from '../types.js';

export class AIDirector {
  private playerPerformance: number = 0;
  private botAccuracyBase: number = 0.3;

  update(state: GameState, dt: number) {
    // Track player performance
    const playerKills = state.killFeed.filter(k => k.includes('player') && k.includes('eliminated')).length;
    const playerHealthPercent = state.player.health / 100;
    this.playerPerformance = (playerKills * 10) + (playerHealthPercent * 5);

    // Adjust bot accuracy based on performance
    // Higher performance = more accurate bots (harder)
    this.botAccuracyBase = 0.2 + Math.min(0.5, this.playerPerformance / 50);
  }

  getBotAccuracy(): number { return this.botAccuracyBase; }
}
