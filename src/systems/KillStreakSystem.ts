export interface KillStreakBanner {
  text: string;
  color: string;
  fontSize: number;
  timer: number;
  maxTimer: number;
  scale: number;
  isRainbow: boolean;
}

export interface ComboState {
  count: number;
  multiplier: number;
  timer: number;
  maxTimer: number;
}

export interface MatchStats {
  kills: number;
  damageDealt: number;
  damageTaken: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  buildingsBuilt: number;
  materialsUsed: number;
  distanceTraveled: number;
  timeSurvived: number;
  longestKill: number;
  bestStreak: number;
  lootPickedUp: number;
  chestsOpened: number;
}

interface StreakMilestone {
  kills: number;
  text: string;
  color: string;
  fontSize: number;
  isRainbow: boolean;
}

const STREAK_MILESTONES: StreakMilestone[] = [
  { kills: 2, text: "DOUBLE KILL!", color: "#FF8C00", fontSize: 48, isRainbow: false },
  { kills: 3, text: "TRIPLE KILL!", color: "#FF0000", fontSize: 52, isRainbow: false },
  { kills: 5, text: "RAMPAGE!", color: "#9B30FF", fontSize: 56, isRainbow: false },
  { kills: 7, text: "UNSTOPPABLE!", color: "#FFD700", fontSize: 60, isRainbow: false },
  { kills: 10, text: "GODLIKE!", color: "#FFD700", fontSize: 68, isRainbow: true },
];

const BANNER_DURATION = 2;
const BANNER_SCALE_UP_DURATION = 0.3;
const BANNER_SCALE_MIN = 0.5;
const BANNER_SCALE_MAX = 1.2;

export class KillStreakSystem {
  private currentStreak: number = 0;
  private streakTimer: number = 0;
  private streakTimeout: number = 10;
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private comboTimeout: number = 5;
  private activeBanner: KillStreakBanner | null = null;
  private stats: MatchStats;
  private lastKillDistance: number = 0;
  private lastKillWeapon: string = "";
  private timeAlive: number = 0;

  constructor() {
    this.stats = this.createEmptyStats();
  }

  private createEmptyStats(): MatchStats {
    return {
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      shotsFired: 0,
      shotsHit: 0,
      headshots: 0,
      buildingsBuilt: 0,
      materialsUsed: 0,
      distanceTraveled: 0,
      timeSurvived: 0,
      longestKill: 0,
      bestStreak: 0,
      lootPickedUp: 0,
      chestsOpened: 0,
    };
  }

  onKill(distance: number, weaponType: string, isHeadshot: boolean): KillStreakBanner | null {
    this.stats.kills++;
    if (isHeadshot) {
      this.stats.headshots++;
    }

    if (distance > this.stats.longestKill) {
      this.stats.longestKill = distance;
    }

    this.lastKillDistance = distance;
    this.lastKillWeapon = weaponType;

    if (this.currentStreak > 0 && this.streakTimer > 0) {
      this.currentStreak++;
    } else {
      this.currentStreak = 1;
    }

    this.streakTimer = this.streakTimeout;

    if (this.currentStreak > this.stats.bestStreak) {
      this.stats.bestStreak = this.currentStreak;
    }

    let bannerCreated: KillStreakBanner | null = null;
    let matchedMilestone: StreakMilestone | null = null;

    for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
      if (this.currentStreak >= STREAK_MILESTONES[i].kills) {
        if (this.currentStreak === STREAK_MILESTONES[i].kills) {
          matchedMilestone = STREAK_MILESTONES[i];
        }
        break;
      }
    }

    if (matchedMilestone) {
      this.activeBanner = {
        text: matchedMilestone.text,
        color: matchedMilestone.color,
        fontSize: matchedMilestone.fontSize,
        timer: BANNER_DURATION,
        maxTimer: BANNER_DURATION,
        scale: BANNER_SCALE_MIN,
        isRainbow: matchedMilestone.isRainbow,
      };
      bannerCreated = { ...this.activeBanner };
    }

    let distanceBanner: string | null = null;
    let distanceColor: string = "";
    if (distance > 500) {
      distanceBanner = "LONG SHOT!";
      distanceColor = "#00BFFF";
    } else if (distance < 50) {
      distanceBanner = "POINT BLANK!";
      distanceColor = "#FF4444";
    }

    if (distanceBanner && !this.activeBanner) {
      this.activeBanner = {
        text: distanceBanner,
        color: distanceColor,
        fontSize: 36,
        timer: BANNER_DURATION,
        maxTimer: BANNER_DURATION,
        scale: BANNER_SCALE_MIN,
        isRainbow: false,
      };
      bannerCreated = { ...this.activeBanner };
    }

    return bannerCreated;
  }

  onDamageDealt(amount: number): ComboState {
    this.stats.damageDealt += amount;
    this.comboCount++;
    this.comboTimer = this.comboTimeout;
    return this.getCombo();
  }

  onDamageTaken(amount: number): void {
    this.stats.damageTaken += amount;
  }

  onShotFired(hit: boolean): void {
    this.stats.shotsFired++;
    if (hit) {
      this.stats.shotsHit++;
    }
  }

  onBuildingBuilt(): void {
    this.stats.buildingsBuilt++;
  }

  onMaterialUsed(amount: number): void {
    this.stats.materialsUsed += amount;
  }

  onDistanceTraveled(distance: number): void {
    this.stats.distanceTraveled += distance;
  }

  onLootPickedUp(): void {
    this.stats.lootPickedUp++;
  }

  onChestOpened(): void {
    this.stats.chestsOpened++;
  }

  update(dt: number): void {
    this.timeAlive += dt;
    this.stats.timeSurvived = this.timeAlive;

    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) {
        this.streakTimer = 0;
        this.currentStreak = 0;
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboCount = 0;
      }
    }

    if (this.activeBanner) {
      this.activeBanner.timer -= dt;
      const elapsed = this.activeBanner.maxTimer - this.activeBanner.timer;

      if (elapsed < BANNER_SCALE_UP_DURATION) {
        const t = elapsed / BANNER_SCALE_UP_DURATION;
        const eased = 1 - Math.pow(1 - t, 3);
        this.activeBanner.scale = BANNER_SCALE_MIN + (BANNER_SCALE_MAX - BANNER_SCALE_MIN) * eased;
      } else {
        this.activeBanner.scale = BANNER_SCALE_MAX;
      }

      if (this.activeBanner.timer <= 0) {
        this.activeBanner = null;
      }
    }
  }

  getActiveBanner(): KillStreakBanner | null {
    return this.activeBanner;
  }

  getCombo(): ComboState {
    let multiplier: number;
    if (this.comboCount >= 16) {
      multiplier = 3;
    } else if (this.comboCount >= 11) {
      multiplier = 2;
    } else if (this.comboCount >= 6) {
      multiplier = 1.5;
    } else {
      multiplier = 1;
    }

    return {
      count: this.comboCount,
      multiplier,
      timer: this.comboTimer,
      maxTimer: this.comboTimeout,
    };
  }

  getStats(): MatchStats {
    return { ...this.stats };
  }

  renderBanner(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.activeBanner) return;

    const banner = this.activeBanner;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.3;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(banner.scale, banner.scale);

    const elapsed = banner.maxTimer - banner.timer;
    let alpha: number;
    if (elapsed < BANNER_SCALE_UP_DURATION) {
      alpha = 1;
    } else {
      const fadeElapsed = elapsed - BANNER_SCALE_UP_DURATION;
      const fadeDuration = banner.maxTimer - BANNER_SCALE_UP_DURATION;
      alpha = Math.max(0, 1 - fadeElapsed / fadeDuration);
    }

    let fillColor: string;
    if (banner.isRainbow) {
      const hue = ((1 - banner.timer / banner.maxTimer) * 360 * 3) % 360;
      fillColor = `hsla(${hue}, 100%, 60%, ${alpha})`;
    } else {
      const r = parseInt(banner.color.slice(1, 3), 16);
      const g = parseInt(banner.color.slice(3, 5), 16);
      const b = parseInt(banner.color.slice(5, 7), 16);
      fillColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    ctx.font = `bold ${banner.fontSize}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "rgba(0, 0, 0, " + alpha * 0.6 + ")";
    ctx.fillText(banner.text, 3, 3);

    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = fillColor;
    ctx.fillText(banner.text, 0, 0);

    ctx.restore();
  }

  renderCombo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const combo = this.getCombo();
    if (combo.count === 0) return;

    const alpha = Math.min(1, combo.timer / 1);
    const baseFontSize = 20;

    ctx.save();

    ctx.font = `bold ${baseFontSize}px Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    let comboColor: string;
    if (combo.multiplier >= 3) {
      comboColor = `rgba(255, 215, 0, ${alpha})`;
    } else if (combo.multiplier >= 2) {
      comboColor = `rgba(255, 100, 255, ${alpha})`;
    } else if (combo.multiplier >= 1.5) {
      comboColor = `rgba(100, 200, 255, ${alpha})`;
    } else {
      comboColor = `rgba(200, 200, 200, ${alpha})`;
    }

    ctx.fillStyle = comboColor;
    ctx.fillText(`COMBO x${combo.count}`, x, y);

    ctx.font = `bold ${baseFontSize - 4}px Arial, sans-serif`;
    ctx.fillText(`${combo.multiplier}x XP`, x, y + baseFontSize + 4);

    const barWidth = 80;
    const barHeight = 4;
    const barY = y + baseFontSize * 2 + 8;
    const fillRatio = combo.timer / combo.maxTimer;

    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(50, 50, 50, ${alpha * 0.7})`;
    ctx.fillRect(x, barY, barWidth, barHeight);
    ctx.fillStyle = comboColor;
    ctx.fillRect(x, barY, barWidth * fillRatio, barHeight);

    ctx.restore();
  }

  reset(): void {
    this.currentStreak = 0;
    this.streakTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.activeBanner = null;
    this.lastKillDistance = 0;
    this.lastKillWeapon = "";
    this.timeAlive = 0;
    this.stats = this.createEmptyStats();
  }
}
