export interface GameModeConfig {
  id: string;
  name: string;
  description: string;
  botCount: number;
  startInventory: string[];
  startMaterials: { wood: number; brick: number; metal: number };
  respawnEnabled: boolean;
  respawnDelay: number;
  lives: number;
  winCondition: 'last_standing' | 'kill_target' | 'team_score';
  winTarget: number;
  stormSpeed: number;
  stormDamage: number;
  teamMode: boolean;
  icon: string;
}

const SOLO_CONFIG: GameModeConfig = {
  id: 'solo',
  name: 'Solo',
  description: 'Standard Battle Royale. Last one standing wins.',
  botCount: 50,
  startInventory: ['pickaxe', 'pistol', 'ar', 'shotgun', 'sniper'],
  startMaterials: { wood: 0, brick: 0, metal: 0 },
  respawnEnabled: false,
  respawnDelay: 0,
  lives: 1,
  winCondition: 'last_standing',
  winTarget: 1,
  stormSpeed: 1,
  stormDamage: 1,
  teamMode: false,
  icon: '⚔️',
};

const ZONE_WARS_CONFIG: GameModeConfig = {
  id: 'zone_wars',
  name: 'Zone Wars',
  description: 'Small zone, fast movement. Everyone starts loaded. First to 20 kills wins.',
  botCount: 30,
  startInventory: ['pickaxe', 'pistol', 'ar', 'shotgun', 'sniper', 'smg'],
  startMaterials: { wood: 999, brick: 999, metal: 999 },
  respawnEnabled: true,
  respawnDelay: 3,
  lives: 5,
  winCondition: 'kill_target',
  winTarget: 20,
  stormSpeed: 2,
  stormDamage: 3,
  teamMode: false,
  icon: '🌀',
};

const TEAM_RUMBLE_CONFIG: GameModeConfig = {
  id: 'team_rumble',
  name: 'Team Rumble',
  description: 'Blue vs Red. First team to 100 eliminations wins. Respawn enabled.',
  botCount: 30,
  startInventory: ['pickaxe', 'pistol', 'ar'],
  startMaterials: { wood: 500, brick: 500, metal: 500 },
  respawnEnabled: true,
  respawnDelay: 3,
  lives: Infinity,
  winCondition: 'team_score',
  winTarget: 100,
  stormSpeed: 1,
  stormDamage: 1,
  teamMode: true,
  icon: '🏆',
};

export class GameModeSystem {
  private modes: GameModeConfig[];
  private activeMode: GameModeConfig;
  private teamScores: Map<string, number>;
  private playerLives: number;
  private respawnTimer: number;
  private playerTeam: string;
  private playerKillCount: number;

  constructor() {
    this.modes = [SOLO_CONFIG, ZONE_WARS_CONFIG, TEAM_RUMBLE_CONFIG];
    this.activeMode = SOLO_CONFIG;
    this.teamScores = new Map();
    this.playerLives = 1;
    this.respawnTimer = 0;
    this.playerTeam = '';
    this.playerKillCount = 0;
  }

  getModes(): GameModeConfig[] {
    return [...this.modes];
  }

  setMode(modeId: string): void {
    const mode = this.modes.find(m => m.id === modeId);
    if (!mode) {
      throw new Error(`Unknown game mode: ${modeId}`);
    }
    this.activeMode = mode;
    this.playerLives = mode.lives;
    this.respawnTimer = 0;
    this.teamScores = new Map();
    this.playerKillCount = 0;

    if (mode.teamMode) {
      this.playerTeam = 'blue';
      this.teamScores.set('blue', 0);
      this.teamScores.set('red', 0);
    } else {
      this.playerTeam = '';
    }
  }

  getActiveMode(): GameModeConfig {
    return this.activeMode;
  }

  getBotCount(): number {
    return this.activeMode.botCount;
  }

  getStartInventory(): string[] {
    return [...this.activeMode.startInventory];
  }

  getStartMaterials(): { wood: number; brick: number; metal: number } {
    return { ...this.activeMode.startMaterials };
  }

  recordKill(killerTeam: string): void {
    if (this.activeMode.winCondition === 'team_score') {
      const current = this.teamScores.get(killerTeam) ?? 0;
      this.teamScores.set(killerTeam, current + 1);
    } else if (this.activeMode.winCondition === 'kill_target') {
      if (killerTeam === 'player') {
        this.playerKillCount++;
      }
    }
  }

  getTeamScore(team: string): number {
    return this.teamScores.get(team) ?? 0;
  }

  checkWinCondition(
    playersAlive: number,
    playerAlive: boolean,
  ): { won: boolean; winner: string; message: string } {
    const mode = this.activeMode;

    if (mode.winCondition === 'last_standing') {
      if (playersAlive <= 1) {
        if (playerAlive) {
          return { won: true, winner: 'player', message: 'Victory Royale!' };
        }
        return { won: true, winner: 'bot', message: 'Eliminated. Better luck next time!' };
      }
      return { won: false, winner: '', message: '' };
    }

    if (mode.winCondition === 'kill_target') {
      if (this.playerKillCount >= mode.winTarget) {
        return { won: true, winner: 'player', message: `${mode.winTarget} eliminations! You win!` };
      }
      return { won: false, winner: '', message: '' };
    }

    if (mode.winCondition === 'team_score') {
      const blueScore = this.teamScores.get('blue') ?? 0;
      const redScore = this.teamScores.get('red') ?? 0;

      if (blueScore >= mode.winTarget) {
        const playerWon = this.playerTeam === 'blue';
        return {
          won: true,
          winner: 'blue',
          message: playerWon
            ? `Blue team wins ${blueScore}-${redScore}!`
            : `Blue team wins ${blueScore}-${redScore}. Red team defeated!`,
        };
      }
      if (redScore >= mode.winTarget) {
        const playerWon = this.playerTeam === 'red';
        return {
          won: true,
          winner: 'red',
          message: playerWon
            ? `Red team wins ${redScore}-${blueScore}!`
            : `Red team wins ${redScore}-${blueScore}. Blue team defeated!`,
        };
      }
      return { won: false, winner: '', message: '' };
    }

    return { won: false, winner: '', message: '' };
  }

  onPlayerDeath(): { shouldRespawn: boolean; respawnDelay: number } {
    if (!this.activeMode.respawnEnabled) {
      return { shouldRespawn: false, respawnDelay: 0 };
    }

    this.playerLives--;

    if (this.playerLives < 0) {
      return { shouldRespawn: false, respawnDelay: 0 };
    }

    return {
      shouldRespawn: true,
      respawnDelay: this.activeMode.respawnDelay,
    };
  }

  onBotDeath(botId: string): { shouldRespawn: boolean; respawnDelay: number } {
    if (!this.activeMode.respawnEnabled) {
      return { shouldRespawn: false, respawnDelay: 0 };
    }

    if (this.activeMode.winCondition === 'kill_target') {
      return {
        shouldRespawn: true,
        respawnDelay: this.activeMode.respawnDelay,
      };
    }

    if (this.activeMode.teamMode) {
      return {
        shouldRespawn: true,
        respawnDelay: this.activeMode.respawnDelay,
      };
    }

    return { shouldRespawn: false, respawnDelay: 0 };
  }

  respawnPlayer(
    playerPos: { x: number; y: number },
    mapSize: number,
  ): { x: number; y: number } {
    if (this.activeMode.teamMode) {
      if (this.playerTeam === 'blue') {
        return {
          x: mapSize * 0.15 + Math.random() * mapSize * 0.2,
          y: mapSize * 0.4 + Math.random() * mapSize * 0.2,
        };
      }
      return {
        x: mapSize * 0.65 + Math.random() * mapSize * 0.2,
        y: mapSize * 0.4 + Math.random() * mapSize * 0.2,
      };
    }

    const edge = Math.floor(Math.random() * 4);
    const offset = Math.random() * mapSize;
    switch (edge) {
      case 0:
        return { x: offset, y: mapSize * 0.1 };
      case 1:
        return { x: offset, y: mapSize * 0.9 };
      case 2:
        return { x: mapSize * 0.1, y: offset };
      default:
        return { x: mapSize * 0.9, y: offset };
    }
  }

  getPlayerTeam(): string {
    return this.playerTeam;
  }

  getBotTeam(botIndex: number, totalBots: number): string {
    if (!this.activeMode.teamMode) {
      return '';
    }

    const half = Math.floor(totalBots / 2);
    if (botIndex < half) {
      return 'blue';
    }
    return 'red';
  }

  isTeamFriendly(team1: string, team2: string): boolean {
    if (!this.activeMode.teamMode) {
      return false;
    }
    return team1 === team2;
  }
}
