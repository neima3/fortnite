import { SERVER_CONFIG } from '../config.js';
import { PlayerState } from '../schema/StormSurgeState.js';

export class ServerBotSystem {
  constructor() {
    this.bots = [];
  }

  spawnBots(state, count) {
    for (let i = 0; i < count; i++) {
      const bot = new PlayerState();
      bot.sessionId = `bot_${i}`;
      bot.name = `Bot ${i}`;
      bot.x = Math.random() * SERVER_CONFIG.MAP_SIZE;
      bot.y = Math.random() * SERVER_CONFIG.MAP_SIZE;
      bot.rotation = 0;
      bot.health = 100;
      bot.shield = 0;
      bot.alive = true;
      bot.kills = 0;
      bot.targetX = bot.x;
      bot.targetY = bot.y;
      bot.stateTimer = 0;
      this.bots.push(bot);
      state.players.set(bot.sessionId, bot);
    }
    state.playersAlive = Array.from(state.players.values()).filter(p => p.alive).length;
  }

  update(dt, state) {
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      bot.stateTimer += dt;
      if (Math.abs(bot.x - bot.targetX) < 30 && Math.abs(bot.y - bot.targetY) < 30 || bot.stateTimer > 5) {
        bot.targetX = Math.max(100, Math.min(SERVER_CONFIG.MAP_SIZE - 100, bot.x + (Math.random() - 0.5) * 600));
        bot.targetY = Math.max(100, Math.min(SERVER_CONFIG.MAP_SIZE - 100, bot.y + (Math.random() - 0.5) * 600));
        bot.stateTimer = 0;
      }
      const dx = bot.targetX - bot.x;
      const dy = bot.targetY - bot.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = SERVER_CONFIG.PLAYER_SPEED;
      bot.x += (dx / dist) * speed * dt;
      bot.y += (dy / dist) * speed * dt;
      bot.rotation = Math.atan2(dy, dx);
      // Move toward safe zone if in storm
      const sdx = bot.x - state.stormCenterX;
      const sdy = bot.y - state.stormCenterY;
      const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
      if (sdist > state.stormRadius - 100) {
        const angle = Math.atan2(sdy, sdx);
        bot.x -= Math.cos(angle) * speed * dt * 1.5;
        bot.y -= Math.sin(angle) * speed * dt * 1.5;
      }
    }
  }
}
