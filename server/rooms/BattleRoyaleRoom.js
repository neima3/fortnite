import { Room } from 'colyseus';
import { StormSurgeState, PlayerState } from '../schema/StormSurgeState.js';
import { SERVER_EVENTS } from '../../shared/net/messageTypes.js';
import { ServerStormSystem } from '../engine/StormSystem.js';
import { ServerBotSystem } from '../engine/BotSystem.js';
import { ServerCombatSystem } from '../engine/CombatSystem.js';
import { ServerBuildingSystem } from '../engine/BuildingSystem.js';
import { SERVER_CONFIG } from '../config.js';

export class BattleRoyaleRoom extends Room {
  maxClients = 100;

  onCreate(options) {
    this.setState(new StormSurgeState());
    this.state.roomId = this.roomId;
    this.state.mode = options.mode || 'solo';
    this.state.seed = options.seed || Math.floor(Math.random() * 1000000);
    this.state.maxClients = options.maxClients || 100;

    this.stormSystem = new ServerStormSystem();
    this.botSystem = new ServerBotSystem();
    this.combatSystem = new ServerCombatSystem();
    this.buildingSystem = new ServerBuildingSystem();
    this.botSystem.spawnBots(this.state, 15);

    // Start game loop
    this.tickRate = 1000 / SERVER_CONFIG.TICK_RATE;
    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => {
      if (this.state.phase !== 'playing') return;
      const now = Date.now();
      const dt = Math.min((now - this.lastTick) / 1000, 0.1);
      this.lastTick = now;
      this.stormSystem.update(dt, this.state);
      this.botSystem.update(dt, this.state);
    }, this.tickRate);

    this.onMessage('move', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.alive && data.x != null && data.y != null) {
        const maxDist = SERVER_CONFIG.PLAYER_SPEED * 0.15 * 2;
        const dx = data.x - player.x;
        const dy = data.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= maxDist) {
          player.x = Math.max(0, Math.min(SERVER_CONFIG.MAP_SIZE, data.x));
          player.y = Math.max(0, Math.min(SERVER_CONFIG.MAP_SIZE, data.y));
        }
        player.rotation = data.rotation ?? player.rotation;
      }
    });

    this.onMessage('fire', (client, data) => {
      this.broadcast('fire', { sessionId: client.sessionId, ...data }, { except: client });
    });

    this.onMessage('hit', (client, data) => {
      const attacker = this.state.players.get(client.sessionId);
      const target = this.state.players.get(data.targetId);
      if (this.combatSystem.validateHit(attacker, target, data)) {
        this.combatSystem.applyDamage(target, data.damage || 20);
        this.state.playersAlive = Array.from(this.state.players.values()).filter(p => p.alive).length;
        this.broadcast('hit_confirmed', { attackerId: client.sessionId, targetId: data.targetId, damage: data.damage || 20, remainingHealth: target.health });
        if (!target.alive) {
          attacker.kills = (attacker.kills || 0) + 1;
          this.broadcast('elimination', { attackerId: client.sessionId, targetId: data.targetId });
        }
      }
    });

    this.onMessage('build', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      const valid = this.buildingSystem.validatePlacement(player, data);
      if (valid) {
        const b = this.buildingSystem.placeBuilding({ x: valid.x, y: valid.y, type: data.type, material: data.material, ownerId: client.sessionId });
        this.broadcast('build_confirmed', { ownerId: client.sessionId, building: b });
      }
    });

    this.onMessage('ready', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = !player.ready;
        this.broadcast(SERVER_EVENTS.ROOM_UPDATED, { readyCount: this.getReadyCount() });
      }
    });

    this.onMessage('start_match', (client) => {
      const readyCount = this.getReadyCount();
      const playerCount = this.state.players.size;
      if (readyCount >= 1 && readyCount === playerCount) {
        this.state.phase = 'playing';
        this.broadcast(SERVER_EVENTS.MATCH_START, { roomId: this.roomId, mode: this.state.mode });
      } else {
        client.send(SERVER_EVENTS.ERROR, { message: 'Not all players are ready' });
      }
    });

    this.onMessage('ping', (client) => {
      client.send('pong', { time: Date.now() });
    });

    console.log(`[BattleRoyaleRoom] created: ${this.roomId}, mode: ${this.state.mode}`);
  }

  onJoin(client, options) {
    console.log(`[BattleRoyaleRoom] client joined: ${client.sessionId}`);
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.name = options.playerName || 'PLAYER';
    player.connected = true;
    player.x = 2000 + (Math.random() - 0.5) * 200;
    player.y = 2000 + (Math.random() - 0.5) * 200;
    this.state.players.set(client.sessionId, player);
    this.state.playersAlive = Array.from(this.state.players.values()).filter(p => p.alive).length;
    this.broadcast(SERVER_EVENTS.PLAYER_JOINED, { sessionId: client.sessionId, name: player.name });
  }

  onLeave(client, consented) {
    console.log(`[BattleRoyaleRoom] client left: ${client.sessionId}`);
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
      player.alive = false;
    }
    this.state.playersAlive = Array.from(this.state.players.values()).filter(p => p.alive).length;
    this.broadcast(SERVER_EVENTS.PLAYER_LEFT, { sessionId: client.sessionId });
  }

  onDispose() {
    console.log(`[BattleRoyaleRoom] disposed: ${this.roomId}`);
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
  }

  getReadyCount() {
    return Array.from(this.state.players.values()).filter(p => p.ready).length;
  }
}
