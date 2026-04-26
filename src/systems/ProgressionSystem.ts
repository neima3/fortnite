export interface PlayerProgress {
  level: number;
  xp: number;
  totalXp: number;
  matchesPlayed: number;
  wins: number;
  kills: number;
  top3: number;
  seasonPassTier: number;
  unlockedSkins: string[];
  challenges: Challenge[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  xpReward: number;
  type: 'daily' | 'weekly';
}

export const XP_REWARDS = {
  WIN: 500,
  TOP_3: 300,
  KILL: 50,
  DAMAGE_100: 10,
  BUILD_10: 20,
  LOOT_10: 15,
  STORM_SURVIVE: 25,
};

export const LEVEL_XP_REQUIREMENTS: number[] = [];
for (let i = 0; i < 100; i++) {
  LEVEL_XP_REQUIREMENTS.push(Math.floor(1000 * Math.pow(1.05, i)));
}

export const SEASON_PASS_REWARDS: Record<number, { type: string; name: string; unlocked: boolean }> = {
  1: { type: 'skin', name: 'Recruit Green', unlocked: false },
  5: { type: 'skin', name: 'Storm Trooper', unlocked: false },
  10: { type: 'emote', name: 'Victory Dance', unlocked: false },
  15: { type: 'skin', name: 'Camo Legend', unlocked: false },
  20: { type: 'skin', name: 'Golden Warrior', unlocked: false },
  25: { type: 'emote', name: 'Floss', unlocked: false },
  30: { type: 'skin', name: 'Platinum Elite', unlocked: false },
  50: { type: 'skin', name: 'Dark Matter', unlocked: false },
  75: { type: 'skin', name: 'Galaxy King', unlocked: false },
  100: { type: 'skin', name: 'Storm Surge Master', unlocked: false },
};

export class ProgressionSystem {
  private progress: PlayerProgress;
  private storageKey = 'stormsurge_progress_v1';

  constructor() {
    this.progress = this.load();
  }

  private load(): PlayerProgress {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return this.createDefaultProgress();
  }

  private save() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.progress)); } catch {}
  }

  private createDefaultProgress(): PlayerProgress {
    return {
      level: 1, xp: 0, totalXp: 0,
      matchesPlayed: 0, wins: 0, kills: 0, top3: 0,
      seasonPassTier: 0, unlockedSkins: ['default'],
      challenges: this.generateChallenges(),
    };
  }

  private generateChallenges(): Challenge[] {
    const dailies = [
      { id: 'd_kill', title: 'Elimination Specialist', description: 'Eliminate 3 enemies', target: 3, xpReward: 100 },
      { id: 'd_damage', title: 'Damage Dealer', description: 'Deal 500 damage', target: 500, xpReward: 100 },
      { id: 'd_build', title: 'Builder', description: 'Build 20 structures', target: 20, xpReward: 100 },
    ];
    const weeklies = [
      { id: 'w_win', title: 'Victory Royale', description: 'Win 1 match', target: 1, xpReward: 500 },
      { id: 'w_kills', title: 'Mass Elimination', description: 'Eliminate 20 enemies', target: 20, xpReward: 300 },
      { id: 'w_top3', title: 'Top 3 Finisher', description: 'Place top 3 three times', target: 3, xpReward: 300 },
    ];
    return [
      ...dailies.map(c => ({ ...c, progress: 0, completed: false, type: 'daily' as const })),
      ...weeklies.map(c => ({ ...c, progress: 0, completed: false, type: 'weekly' as const })),
    ];
  }

  getProgress(): PlayerProgress { return this.progress; }

  addXp(amount: number) {
    this.progress.xp += amount;
    this.progress.totalXp += amount;
    while (this.progress.level < 100 && this.progress.xp >= LEVEL_XP_REQUIREMENTS[this.progress.level - 1]) {
      this.progress.xp -= LEVEL_XP_REQUIREMENTS[this.progress.level - 1];
      this.progress.level++;
      this.checkSeasonPassUnlock(this.progress.level);
    }
    this.save();
  }

  private checkSeasonPassUnlock(level: number) {
    const reward = SEASON_PASS_REWARDS[level];
    if (reward && !reward.unlocked) {
      reward.unlocked = true;
      if (reward.type === 'skin') this.progress.unlockedSkins.push(reward.name);
      this.progress.seasonPassTier = Math.max(this.progress.seasonPassTier, level);
    }
  }

  reportMatchEnd(placement: number, kills: number, damageDealt: number, buildingsBuilt: number) {
    this.progress.matchesPlayed++;
    this.progress.kills += kills;
    if (placement === 1) { this.progress.wins++; this.addXp(XP_REWARDS.WIN); }
    else if (placement <= 3) { this.progress.top3++; this.addXp(XP_REWARDS.TOP_3); }
    this.addXp(kills * XP_REWARDS.KILL);
    this.addXp(Math.floor(damageDealt / 100) * XP_REWARDS.DAMAGE_100);
    this.addXp(Math.floor(buildingsBuilt / 10) * XP_REWARDS.BUILD_10);
    this.updateChallenges('kill', kills);
    this.updateChallenges('damage', damageDealt);
    this.updateChallenges('build', buildingsBuilt);
    this.updateChallenges('win', placement === 1 ? 1 : 0);
    this.updateChallenges('top3', placement <= 3 ? 1 : 0);
    this.save();
  }

  updateChallenges(type: string, amount: number) {
    for (const c of this.progress.challenges) {
      if (c.completed) continue;
      let matches = false;
      if (type === 'kill' && (c.id.startsWith('d_kill') || c.id.startsWith('w_kills'))) matches = true;
      if (type === 'damage' && c.id.startsWith('d_damage')) matches = true;
      if (type === 'build' && c.id.startsWith('d_build')) matches = true;
      if (type === 'win' && c.id.startsWith('w_win')) matches = true;
      if (type === 'top3' && c.id.startsWith('w_top3')) matches = true;
      if (matches) {
        c.progress += amount;
        if (c.progress >= c.target) {
          c.progress = c.target;
          c.completed = true;
          this.addXp(c.xpReward);
        }
      }
    }
    this.save();
  }

  resetDailyChallenges() {
    this.progress.challenges = this.progress.challenges.filter(c => c.type === 'weekly');
    const dailies = [
      { id: 'd_kill', title: 'Elimination Specialist', description: 'Eliminate 3 enemies', target: 3, xpReward: 100, progress: 0, completed: false, type: 'daily' as const },
      { id: 'd_damage', title: 'Damage Dealer', description: 'Deal 500 damage', target: 500, xpReward: 100, progress: 0, completed: false, type: 'daily' as const },
      { id: 'd_build', title: 'Builder', description: 'Build 20 structures', target: 20, xpReward: 100, progress: 0, completed: false, type: 'daily' as const },
    ];
    this.progress.challenges.push(...dailies);
    this.save();
  }
}
