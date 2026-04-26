import { GameState, Player, Vec2, LaunchPad, SpeedBoost, Zipline } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, dist } from '../utils/math.js';

export class MobilitySystem {
  private launchPads: LaunchPad[] = [];
  private speedBoosts: SpeedBoost[] = [];
  private ziplines: Zipline[] = [];
  private glidingPlayers: Map<string, { targetX: number; targetY: number; startX: number; startY: number; progress: number }> = new Map();

  spawnMobilityFeatures(state: GameState) {
    // Launch pads near POIs
    for (let i = 0; i < 10; i++) {
      this.launchPads.push({
        id: `pad_${i}`,
        pos: vec2(Math.random() * CONFIG.MAP_SIZE, Math.random() * CONFIG.MAP_SIZE),
        radius: 30,
        active: true,
      });
    }
    // Speed boosts
    for (let i = 0; i < 15; i++) {
      this.speedBoosts.push({
        id: `boost_${i}`,
        pos: vec2(Math.random() * CONFIG.MAP_SIZE, Math.random() * CONFIG.MAP_SIZE),
        radius: 25,
        active: true,
        multiplier: 2.0,
        duration: 3,
      });
    }
    // Ziplines between random points
    for (let i = 0; i < 5; i++) {
      this.ziplines.push({
        id: `zip_${i}`,
        start: vec2(Math.random() * CONFIG.MAP_SIZE, Math.random() * CONFIG.MAP_SIZE),
        end: vec2(Math.random() * CONFIG.MAP_SIZE, Math.random() * CONFIG.MAP_SIZE),
        active: true,
      });
    }
  }

  startGlide(player: Player, targetX: number, targetY: number) {
    this.glidingPlayers.set(player.id, { targetX, targetY, startX: player.pos.x, startY: player.pos.y, progress: 0 });
  }

  update(state: GameState, dt: number) {
    const p = state.player;
    if (!p.alive) return;

    // Update gliders
    for (const [id, glide] of this.glidingPlayers) {
      glide.progress += dt * 0.5;
      if (glide.progress >= 1) {
        this.glidingPlayers.delete(id);
        continue;
      }
      // Lerp position for the correct player
      const player = state.player.id === id ? state.player : state.bots.find(b => b.id === id);
      if (!player) continue;
      const t = glide.progress;
      const ease = 1 - Math.pow(1 - t, 2); // ease out
      player.pos.x = glide.startX + (glide.targetX - glide.startX) * ease;
      player.pos.y = glide.startY + (glide.targetY - glide.startY) * ease;
    }

    // Launch pads
    for (const pad of this.launchPads) {
      if (!pad.active) continue;
      if (dist(p.pos, pad.pos) < pad.radius + p.radius) {
        pad.active = false;
        // Launch player in air toward mouse direction
        const launchDist = 400;
        const angle = p.rotation;
        const targetX = p.pos.x + Math.cos(angle) * launchDist;
        const targetY = p.pos.y + Math.sin(angle) * launchDist;
        this.startGlide(p, targetX, targetY);
        setTimeout(() => pad.active = true, 5000);
      }
    }

    // Speed boosts
    for (const boost of this.speedBoosts) {
      if (!boost.active) continue;
      if (dist(p.pos, boost.pos) < boost.radius + p.radius) {
        boost.active = false;
        this.applySpeedBoost(p, boost.multiplier, boost.duration);
        setTimeout(() => boost.active = true, 10000);
      }
    }

    // Ziplines
    for (const zip of this.ziplines) {
      if (!zip.active) continue;
      if (dist(p.pos, zip.start) < 30) {
        zip.active = false;
        this.startGlide(p, zip.end.x, zip.end.y);
        setTimeout(() => zip.active = true, 8000);
      }
    }
  }

  private applySpeedBoost(player: Player, multiplier: number, duration: number) {
    const originalSpeed = CONFIG.PLAYER_SPEED;
    player.speed = originalSpeed * multiplier;
    setTimeout(() => {
      player.speed = originalSpeed;
    }, duration * 1000);
  }

  isGliding(playerId: string): boolean {
    return this.glidingPlayers.has(playerId);
  }

  render(ctx: CanvasRenderingContext2D, state: GameState) {
    // Render launch pads
    for (const pad of this.launchPads) {
      if (!pad.active) continue;
      ctx.save();
      ctx.translate(pad.pos.x, pad.pos.y);
      ctx.fillStyle = '#e67e22';
      ctx.beginPath();
      ctx.arc(0, 0, pad.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAD', 0, 5);
      ctx.restore();
    }
    // Render speed boosts
    for (const boost of this.speedBoosts) {
      if (!boost.active) continue;
      ctx.save();
      ctx.translate(boost.pos.x, boost.pos.y);
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(0, 0, boost.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BOOST', 0, 4);
      ctx.restore();
    }
    // Render ziplines
    for (const zip of this.ziplines) {
      if (!zip.active) continue;
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(zip.start.x, zip.start.y);
      ctx.lineTo(zip.end.x, zip.end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Start/end markers
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(zip.start.x, zip.start.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(zip.end.x, zip.end.y, 8, 0, Math.PI * 2); ctx.fill();
    }
    // Render gliding players
    for (const [id, glide] of this.glidingPlayers) {
      const player = state.player.id === id ? state.player : state.bots.find(b => b.id === id);
      if (!player) continue;
      ctx.save();
      ctx.translate(player.pos.x, player.pos.y - 20);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 25, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    }
  }
}
