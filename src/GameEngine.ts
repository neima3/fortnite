import { GameState, Player, Weapon } from './types.js';
import { CONFIG } from './config.js';
import { InputManager } from './engine/InputManager.js';
import { Camera } from './engine/Camera.js';
import { clamp, vec2, vec2Norm, vec2Mul, angleTo, dist } from './utils/math.js';
import { MapGenerator, Tile, Biome } from './world/MapGenerator.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { BuildingSystem } from './systems/BuildingSystem.js';
import { LootSystem } from './systems/LootSystem.js';
import { StormSystem } from './systems/StormSystem.js';
import { MobilitySystem } from './systems/MobilitySystem.js';
import { ItemSystem } from './systems/ItemSystem.js';
import { AISystem } from './systems/AISystem.js';
import { MenuScreen } from './ui/MenuScreen.js';
import { AudioManager } from './engine/AudioManager.js';
import { createExplosion, createMuzzleFlash, createHitMarker, updateParticle } from './entities/Particle.js';
import { ColyseusSession } from './client/network/ColyseusSession.js';
import { ProgressionSystem } from './systems/ProgressionSystem.js';
import { ReplaySystem } from './systems/ReplaySystem.js';
import { SpectatorSystem } from './systems/SpectatorSystem.js';
import { BossSystem } from './systems/BossSystem.js';
import { AIDirector } from './systems/AIDirector.js';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  private camera: Camera;
  private state: GameState;
  private lastTime: number = 0;
  private running: boolean = false;
  private mapGen: MapGenerator;
  private tiles: Tile[][];
  private combatSystem: CombatSystem;
  private buildingSystem: BuildingSystem;
  private lootSystem: LootSystem;
  private stormSystem: StormSystem;
  private mobilitySystem: MobilitySystem;
  private itemSystem: ItemSystem;
  private aiSystem: AISystem;
  private menu: MenuScreen;
  private gameStarted: boolean = false;
  private paused: boolean = false;
  private audioManager: AudioManager;
  private screenShake: number = 0;
  private multiplayerSession: ColyseusSession | null = null;
  private isMultiplayer: boolean = false;
  private remotePlayers: Map<string, any> = new Map();
  private progression: ProgressionSystem;
  private matchStats = { kills: 0, damageDealt: 0, buildingsBuilt: 0 };
  private matchStatsReported = false;
  private replaySystem: ReplaySystem;
  private spectatorSystem: SpectatorSystem;
  private bossSystem: BossSystem;
  private aiDirector: AIDirector;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.input = new InputManager(canvas);
    this.camera = new Camera(canvas);
    this.mapGen = new MapGenerator(42);
    const mapData = this.mapGen.generate();
    this.tiles = mapData.tiles;
    this.state = this.createInitialState();
    this.combatSystem = new CombatSystem();
    this.buildingSystem = new BuildingSystem();
    this.lootSystem = new LootSystem();
    this.lootSystem.spawnFloorLoot(this.state);
    this.mobilitySystem = new MobilitySystem();
    this.mobilitySystem.spawnMobilityFeatures(this.state);
    this.itemSystem = new ItemSystem();
    this.aiSystem = new AISystem(this.combatSystem);
    this.aiSystem.spawnBots(this.state, 20);
    this.stormSystem = new StormSystem();
    this.state.stormRadius = CONFIG.MAP_SIZE * 0.8;
    this.state.stormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormRadius = CONFIG.MAP_SIZE * 0.8;
    this.menu = new MenuScreen();
    this.audioManager = new AudioManager();
    this.progression = new ProgressionSystem();
    this.replaySystem = new ReplaySystem();
    this.spectatorSystem = new SpectatorSystem();
    this.bossSystem = new BossSystem();
    this.aiDirector = new AIDirector();

    // Wrap applyDamage to track match stats
    const originalApplyDamage = this.combatSystem.applyDamage.bind(this.combatSystem);
    this.combatSystem.applyDamage = (state: GameState, targetId: string, damage: number, attackerId: string) => {
      let target = state.player.id === targetId ? state.player : state.bots.find(b => b.id === targetId);
      const wasAlive = target?.alive ?? false;
      if (attackerId === 'player') {
        this.matchStats.damageDealt += damage;
      }
      originalApplyDamage(state, targetId, damage, attackerId);
      if (attackerId === 'player' && wasAlive && target && !target.alive) {
        this.matchStats.kills++;
      }
    };

    this.showMainMenu();
  }

  private showMainMenu() {
    this.menu.showMainMenu(
      () => { this.menu.hide(); this.showModeSelect(); },
      () => this.showSettings(),
      () => { this.menu.showProgression(this.progression.getProgress(), () => this.showMainMenu()); }
    );
  }

  private showModeSelect() {
    this.menu.showModeSelect(
      () => { this.menu.hide(); this.input.destroy(); this.input = new InputManager(this.canvas); this.gameStarted = true; this.isMultiplayer = false; this.start(); },
      () => { this.menu.hide(); this.showMultiplayerLobby(); }
    );
  }

  private async showMultiplayerLobby() {
    this.isMultiplayer = true;
    this.multiplayerSession = new ColyseusSession();

    const onReady = () => { this.multiplayerSession?.send('ready', {}); };
    const onStart = () => {
      this.multiplayerSession?.send('start_match', {});
      this.menu.hide();
      this.gameStarted = true;
      this.start();
    };
    const onLeave = () => {
      this.multiplayerSession?.disconnect();
      this.showMainMenu();
    };

    this.multiplayerSession.on('connected', (snapshot) => {
      this.menu.showLobby(snapshot, true, onReady, onStart, onLeave);
    });

    this.multiplayerSession.on('state', (snapshot) => {
      if (this.menu.isVisible()) {
        this.menu.showLobby(snapshot, true, onReady, onStart, onLeave);
      }
      for (const p of snapshot.remotePlayers) {
        this.remotePlayers.set(p.sessionId, p);
      }
      // Remove players no longer in snapshot
      const activeIds = new Set(snapshot.players.map((p: any) => p.sessionId));
      for (const id of this.remotePlayers.keys()) {
        if (!activeIds.has(id)) this.remotePlayers.delete(id);
      }
    });

    this.multiplayerSession.on('match_start', () => {
      this.menu.hide();
      this.gameStarted = true;
      this.start();
    });

    try {
      await this.multiplayerSession.connect({ mode: 'solo', playerName: 'Player1' });
      // Wrap applyDamage to report local-player hits to server
      const originalApplyDamage = this.combatSystem.applyDamage.bind(this.combatSystem);
      this.combatSystem.applyDamage = (state: any, targetId: string, damage: number, attackerId: string) => {
        if (attackerId === 'player' && this.multiplayerSession?.room) {
          this.multiplayerSession.send('hit', { targetId, damage });
        }
        originalApplyDamage(state, targetId, damage, attackerId);
      };
      this.multiplayerSession.on('hit_confirmed', (data: any) => {
        if (data.targetId === this.multiplayerSession?.room?.sessionId) {
          this.state.player.health = data.remainingHealth;
          if (this.state.player.health <= 0) {
            this.state.player.health = 0;
            this.state.player.alive = false;
            this.state.matchPhase = 'ended';
          }
        }
      });
      this.multiplayerSession.on('elimination', (data: any) => {
        this.state.killFeed.unshift(`${data.attackerId} eliminated ${data.targetId}`);
        if (this.state.killFeed.length > 5) this.state.killFeed.pop();
      });
      this.multiplayerSession.on('build_confirmed', (data: any) => {
        if (data.ownerId !== this.multiplayerSession?.room?.sessionId) {
          const b = data.building;
          this.state.buildings.push({
            id: b.id,
            pos: { x: b.x, y: b.y },
            vel: { x: 0, y: 0 },
            radius: CONFIG.BUILDING_GRID_SIZE / 2,
            rotation: 0,
            alive: true,
            type: b.type,
            material: b.material,
            health: b.health,
            maxHealth: b.maxHealth,
            building: false,
            buildProgress: 1,
            buildTime: 0,
            builtAt: performance.now() / 1000,
          } as any);
        }
      });
    } catch (err: any) {
      console.error('Failed to connect:', err);
      this.menu.hide();
      this.showMainMenu();
    }
  }

  private showSettings() {
    // Simple settings page
    this.menu.showMainMenu(
      () => { this.menu.hide(); this.input.destroy(); this.input = new InputManager(this.canvas); this.gameStarted = true; this.start(); },
      () => {}
    );
  }

  private showPauseMenu() {
    this.paused = true;
    this.menu.showPauseMenu(
      () => { this.paused = false; this.menu.hide(); this.lastTime = performance.now(); },
      () => { this.menu.hide(); this.restart(); this.paused = false; },
      () => { this.stop(); this.showMainMenu(); }
    );
  }

  private createWeapon(type: string): Weapon {
    const w = CONFIG.WEAPONS[type as keyof typeof CONFIG.WEAPONS];
    return {
      name: type, type: type as any, rarity: 'common',
      damage: w.damage, fireRate: w.fireRate, magazine: w.magazine,
      ammo: w.magazine === Infinity ? Infinity : w.magazine,
      maxAmmo: w.magazine, reloadTime: w.reloadTime,
      ammoType: type === 'pickaxe' ? 'none' : type === 'shotgun' ? 'shells' : type === 'sniper' ? 'heavy' : 'medium',
      lastFireTime: 0, spread: w.spread, projectileSpeed: w.projectileSpeed,
    };
  }

  private createInitialState(): GameState {
    const mapSize = CONFIG.MAP_SIZE;

    const player: Player = {
      id: 'player',
      pos: { x: mapSize / 2, y: mapSize / 2 },
      vel: { x: 0, y: 0 },
      radius: CONFIG.PLAYER_RADIUS,
      rotation: 0,
      alive: true,
      health: CONFIG.PLAYER_MAX_HEALTH,
      shield: 0,
      speed: CONFIG.PLAYER_SPEED,
      sprinting: false,
      materials: { wood: 300, brick: 200, metal: 100 },
      inventory: [
        this.createWeapon('pickaxe'),
        this.createWeapon('pistol'),
        this.createWeapon('ar'),
        this.createWeapon('shotgun'),
        this.createWeapon('sniper'),
      ],
      selectedSlot: 0,
      aiming: false,
    };

    // Spawn player on land
    let spawnFound = false;
    while (!spawnFound) {
      const tx = Math.floor(Math.random() * this.tiles.length);
      const ty = Math.floor(Math.random() * this.tiles[0].length);
      const tile = this.tiles[tx][ty];
      if (tile.biome !== 'water' && tile.biome !== 'beach') {
        player.pos = vec2(tile.x + CONFIG.TILE_SIZE / 2, tile.y + CONFIG.TILE_SIZE / 2);
        spawnFound = true;
      }
    }

    return {
      player,
      bots: [],
      projectiles: [],
      buildings: [],
      lootItems: [],
      particles: [],
      grenades: [],
      traps: [],
      supplyDrops: [],
      camera: { x: 0, y: 0 },
      mapSize,
      stormCenter: { x: mapSize / 2, y: mapSize / 2 },
      stormRadius: mapSize * 0.45,
      nextStormCenter: { x: mapSize / 2, y: mapSize / 2 },
      nextStormRadius: mapSize * 0.35,
      stormPhase: 0,
      stormTimer: 0,
      stormDamage: 1,
      matchTime: 0,
      matchPhase: 'playing',
      playersAlive: 100,
      killFeed: [],
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.replaySystem.startRecording();
    requestAnimationFrame(this.loop);
  }

  private loop = (time: number) => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(dt);
    this.render();
    this.input.resetFrame();

    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.paused || !this.gameStarted) return;
    if (!this.isMultiplayer) {
      this.aiSystem.update(this.state, dt);
    }

    const player = this.state.player;
    const input = this.input;

    this.mobilitySystem.update(this.state, dt);
    this.itemSystem.update(this.state, dt);
    this.bossSystem.update(this.state, dt);
    this.aiDirector.update(this.state, dt);
    this.replaySystem.recordFrame(this.state.matchTime, this.state);

    // Glider deployment on Space
    if (input.isKeyDown(' ')) {
      const glideDist = 300;
      this.mobilitySystem.startGlide(this.state.player, this.state.player.pos.x + Math.cos(this.state.player.rotation) * glideDist, this.state.player.pos.y + Math.sin(this.state.player.rotation) * glideDist);
    }

    // Movement (skip if gliding)
    if (!this.mobilitySystem.isGliding(this.state.player.id)) {
      let dx = 0;
      let dy = 0;
      if (input.isKeyDown('w') || input.isKeyDown('arrowup')) dy -= 1;
      if (input.isKeyDown('s') || input.isKeyDown('arrowdown')) dy += 1;
      if (input.isKeyDown('a') || input.isKeyDown('arrowleft')) dx -= 1;
      if (input.isKeyDown('d') || input.isKeyDown('arrowright')) dx += 1;

      // Sprint
      player.sprinting = input.isKeyDown('shift');
      const baseSpeed = player.speed || CONFIG.PLAYER_SPEED;
      const speed = player.sprinting ? baseSpeed * (CONFIG.PLAYER_SPRINT_SPEED / CONFIG.PLAYER_SPEED) : baseSpeed;

      if (dx !== 0 || dy !== 0) {
        const dir = vec2Norm({ x: dx, y: dy });
        player.vel = vec2Mul(dir, speed);
      } else {
        player.vel = { x: 0, y: 0 };
      }

      player.pos.x += player.vel.x * dt;
      player.pos.y += player.vel.y * dt;

      // Clamp to map bounds
      player.pos.x = clamp(player.pos.x, player.radius, this.state.mapSize - player.radius);
      player.pos.y = clamp(player.pos.y, player.radius, this.state.mapSize - player.radius);

      // Obstacle collision
      const p = player;
      const tx = Math.floor(p.pos.x / CONFIG.TILE_SIZE);
      const ty = Math.floor(p.pos.y / CONFIG.TILE_SIZE);
      if (tx >= 0 && tx < this.tiles.length && ty >= 0 && ty < this.tiles[0].length) {
        const tile = this.tiles[tx][ty];
        if (tile.obstacle !== 'none' || tile.biome === 'water') {
          const dx = p.pos.x - (tile.x + CONFIG.TILE_SIZE / 2);
          const dy = p.pos.y - (tile.y + CONFIG.TILE_SIZE / 2);
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const push = p.radius + CONFIG.TILE_SIZE / 2;
          p.pos.x = tile.x + CONFIG.TILE_SIZE / 2 + (dx / len) * push;
          p.pos.y = tile.y + CONFIG.TILE_SIZE / 2 + (dy / len) * push;
        }
      }

      // Building collision
      for (const b of this.state.buildings) {
        if (!b.alive) continue;
        const d = dist(p.pos, b.pos);
        if (d < p.radius + b.radius) {
          const dx = p.pos.x - b.pos.x;
          const dy = p.pos.y - b.pos.y;
          const len = d || 1;
          const push = p.radius + b.radius;
          p.pos.x = b.pos.x + (dx / len) * push;
          p.pos.y = b.pos.y + (dy / len) * push;
        }
      }
    }

    // Aim at mouse world position
    const mouseWorld = this.camera.screenToWorld(input.mousePos);
    this.input.setMouseWorld(mouseWorld);
    player.rotation = angleTo(player.pos, mouseWorld);
    player.aiming = input.mouseDown;

    // Building controls
    if (this.input.isKeyDown('q')) this.buildingSystem.setBuildMode('wall');
    if (this.input.isKeyDown('e')) this.buildingSystem.setBuildMode('floor');
    if (this.input.isKeyDown('r')) {
      if (this.buildingSystem.isBuilding) {
        this.buildingSystem.setBuildMode('stair');
      }
    }
    if (this.input.isKeyDown('t')) this.buildingSystem.setBuildMode('roof');
    if (this.input.isKeyDown('g')) this.buildingSystem.toggleMaterial();
    if (this.input.isKeyDown('escape')) {
      if (this.buildingSystem.isBuilding) {
        this.buildingSystem.setBuildMode(null);
      } else if (this.gameStarted) {
        if (this.paused) {
          this.paused = false;
          this.menu.hide();
          this.lastTime = performance.now();
        } else {
          this.showPauseMenu();
        }
      }
    }

    this.buildingSystem.updateGhost(player.pos, mouseWorld);
    if (this.buildingSystem.isBuilding && this.input.mouseClicked) {
      const placed = this.buildingSystem.placeBuilding(this.state);
      if (placed) {
        this.matchStats.buildingsBuilt++;
        this.audioManager.playBuild();
        if (this.isMultiplayer && this.multiplayerSession?.room) {
          this.multiplayerSession.send('build', { x: placed.pos.x, y: placed.pos.y, type: placed.type, material: placed.material });
        }
      }
    }

    // Weapon slot selection
    for (let i = 1; i <= 5; i++) {
      if (input.isKeyDown(String(i))) {
        player.selectedSlot = i - 1;
      }
    }

    // Camera follow
    if (!this.spectatorSystem.active) {
      this.camera.follow(player.pos, dt, CONFIG.CAMERA_SMOOTH);
    }

    if (this.isMultiplayer && this.multiplayerSession?.room?.state) {
      const s = this.multiplayerSession.room.state;
      this.state.stormRadius = s.stormRadius;
      this.state.stormCenter.x = s.stormCenterX;
      this.state.stormCenter.y = s.stormCenterY;
      this.state.stormPhase = s.stormPhase ?? 0;
      this.state.stormDamage = s.stormDamage ?? 1;
      this.state.stormTimer = s.stormTimer ?? 0;
      this.state.nextStormRadius = s.nextStormRadius ?? this.state.stormRadius;
      this.state.nextStormCenter.x = s.nextStormCenterX ?? this.state.stormCenter.x;
      this.state.nextStormCenter.y = s.nextStormCenterY ?? this.state.stormCenter.y;
      this.state.playersAlive = s.playersAlive;
      this.state.matchTime = s.matchTime;
      // Update remote players from server state
      if (s.players?.forEach) {
        const activeIds = new Set<string>();
        s.players.forEach((p: any) => {
          activeIds.add(p.sessionId);
          if (p.sessionId === this.multiplayerSession?.room?.sessionId) {
            // Update local player health/shield from server
            this.state.player.health = p.health;
            this.state.player.shield = p.shield;
            this.state.player.alive = p.alive;
          } else {
            this.remotePlayers.set(p.sessionId, p);
          }
        });
        // Remove players no longer in state
        for (const id of this.remotePlayers.keys()) {
          if (!activeIds.has(id)) this.remotePlayers.delete(id);
        }
      }
      // End-game detection for client
      if (!this.state.player.alive) {
        this.state.matchPhase = 'ended';
      } else if (this.state.playersAlive <= 1) {
        this.state.matchPhase = 'ended';
      }
    } else {
      // Single player: use local storm system
      this.stormSystem.update(this.state, dt);
    }
    // Storm warning audio
    const playerDist = dist(this.state.player.pos, this.state.stormCenter);
    if (playerDist > this.state.stormRadius && Math.random() < 0.02) {
      this.audioManager.playStormWarning();
    }
    // Check win condition
    if (this.state.matchPhase === 'playing' && this.state.playersAlive <= 1 && this.state.player.alive) {
      this.state.matchPhase = 'ended';
      this.state.killFeed.unshift('VICTORY ROYALE!');
    }

    // Spectator mode on death
    if (!this.spectatorSystem.active && !this.state.player.alive && this.state.matchPhase === 'ended') {
      this.spectatorSystem.startSpectating(this.state);
    }
    if (this.spectatorSystem.active) {
      this.spectatorSystem.updateTargets(this.state);
      const target = this.spectatorSystem.getCurrentTarget();
      if (target) {
        this.camera.follow(target.pos, dt, 0.05);
      }
    }

    this.combatSystem.update(this.state, dt);
    this.buildingSystem.updateBuildings(this.state, dt);
    if (this.input.mouseClicked && !this.buildingSystem.isBuilding) {
      const weapon = this.state.player.inventory[this.state.player.selectedSlot];
      if (weapon && weapon.type === 'grenade') {
        this.itemSystem.throwGrenade(this.state, this.state.player);
      } else if (weapon && weapon.type === 'trap') {
        this.itemSystem.placeTrap(this.state, this.state.player);
      } else {
        const fired = this.combatSystem.fireWeapon(this.state, this.state.player);
        if (fired) {
          if (weapon) {
            this.audioManager.playShoot(weapon.type);
            this.state.particles.push(...createMuzzleFlash(this.state.player.pos, this.state.player.rotation));
            this.screenShake = weapon.type === 'shotgun' || weapon.type === 'sniper' ? 5 : 2;
          }
        }
      }
    }
    if (this.input.isKeyDown('x')) {
      const w = this.state.player.inventory[this.state.player.selectedSlot];
      if (w) this.combatSystem.reload(w);
    }

    if (this.input.isKeyDown('f')) {
      const picked = this.lootSystem.tryPickup(this.state, this.state.player);
      const opened = this.itemSystem.tryOpenSupplyDrop(this.state, this.state.player);
      if (picked || opened) this.audioManager.playPickup();
    }

    if (this.input.isKeyDown('v')) {
      this.itemSystem.useConsumable(this.state, this.state.player);
    }

    for (const p of this.state.particles) {
      updateParticle(p, dt);
    }
    this.state.particles = this.state.particles.filter(p => p.alive);
    if (this.state.particles.length > 500) {
      this.state.particles = this.state.particles.slice(-500);
    }
    if (this.state.projectiles.length > 200) {
      this.state.projectiles = this.state.projectiles.slice(-200);
    }
    this.screenShake *= 0.9;
    if (this.screenShake < 0.5) this.screenShake = 0;

    if (this.input.isKeyDown('n') && this.state.matchPhase === 'ended') {
      this.restart();
    }

    if (this.input.isKeyDown('KeyK') && this.state.matchPhase === 'ended') {
      this.showKillCam();
    }

    // Spectator controls
    if (this.spectatorSystem.active) {
      if (this.input.isKeyDown('ArrowRight') || this.input.isKeyDown('KeyD')) this.spectatorSystem.nextTarget(this.state);
      if (this.input.isKeyDown('ArrowLeft') || this.input.isKeyDown('KeyA')) this.spectatorSystem.prevTarget(this.state);
    }

    // Multiplayer sync
    if (this.isMultiplayer && this.multiplayerSession?.room && this.state.player.alive) {
      this.multiplayerSession.send('move', {
        x: this.state.player.pos.x,
        y: this.state.player.pos.y,
        rotation: this.state.player.rotation,
      });
    }

    // Report match stats when match ends
    if (this.state.matchPhase === 'ended' && !this.matchStatsReported) {
      this.matchStatsReported = true;
      const placement = this.state.player.alive ? 1 : this.state.playersAlive + 1;
      this.progression.reportMatchEnd(placement, this.matchStats.kills, this.matchStats.damageDealt, this.matchStats.buildingsBuilt);
    }
  }

  private render(): void {
    if (!this.gameStarted) return;
    const ctx = this.ctx;
    const cam = this.camera;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Green background
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake * 2;
      const shakeY = (Math.random() - 0.5) * this.screenShake * 2;
      ctx.translate(shakeX, shakeY);
    }
    ctx.translate(-cam.pos.x, -cam.pos.y);

    // Terrain rendering
    const tileSize = CONFIG.TILE_SIZE;
    const startX = Math.max(0, Math.floor(cam.pos.x / tileSize) - 1);
    const endX = Math.min(this.tiles.length, Math.ceil((cam.pos.x + cam.width) / tileSize) + 1);
    const startY = Math.max(0, Math.floor(cam.pos.y / tileSize) - 1);
    const endY = Math.min(this.tiles[0].length, Math.ceil((cam.pos.y + cam.height) / tileSize) + 1);

    for (let tx = startX; tx < endX; tx++) {
      for (let ty = startY; ty < endY; ty++) {
        const tile = this.tiles[tx][ty];
        ctx.fillStyle = this.getBiomeColor(tile.biome);
        ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
        if (tile.obstacle === 'tree') {
          ctx.fillStyle = '#2d5016';
          ctx.beginPath();
          ctx.arc(tile.x + tileSize / 2, tile.y + tileSize / 2, tileSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile.obstacle === 'rock') {
          ctx.fillStyle = '#7f8c8d';
          ctx.beginPath();
          ctx.arc(tile.x + tileSize / 2, tile.y + tileSize / 2, tileSize * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile.obstacle === 'bush') {
          ctx.fillStyle = '#27ae60';
          ctx.beginPath();
          ctx.arc(tile.x + tileSize / 2, tile.y + tileSize / 2, tileSize * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const viewLeft = cam.pos.x - 100;
    const viewRight = cam.pos.x + cam.width + 100;
    const viewTop = cam.pos.y - 100;
    const viewBottom = cam.pos.y + cam.height + 100;

    // Loot items
    for (const loot of this.state.lootItems) {
      if (!loot.alive) continue;
      // Cull off-screen loot
      if (loot.pos.x < viewLeft || loot.pos.x > viewRight || loot.pos.y < viewTop || loot.pos.y > viewBottom) continue;
      ctx.save();
      ctx.translate(loot.pos.x, loot.pos.y);
      ctx.fillStyle = typeof loot.item === 'string' ? '#f39c12' : '#e74c3c';
      ctx.beginPath(); ctx.arc(0, 0, loot.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      const label = typeof loot.item === 'string' ? loot.item : loot.item.name;
      ctx.fillText(label.substring(0, 4), 0, 4);
      ctx.restore();
    }

    // Draw buildings
    ctx.fillStyle = '#8e44ad';
    for (const b of this.mapGen.buildings) {
      if (b.x + b.width < viewLeft || b.x > viewRight || b.y + b.height < viewTop || b.y > viewBottom) continue;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeStyle = '#6c3483';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
    }

    // Ghost preview
    if (this.buildingSystem.isBuilding && this.buildingSystem.getGhostPos()) {
      const ghost = this.buildingSystem.getGhostPos()!;
      const canPlace = this.buildingSystem.canPlace(this.state);
      ctx.save();
      ctx.translate(ghost.x, ghost.y);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = canPlace ? '#3498db' : '#e74c3c';
      const mode = this.buildingSystem.getBuildMode();
      const r = CONFIG.BUILDING_GRID_SIZE / 2;
      if (mode === 'wall') ctx.fillRect(-r, -r, r * 2, r * 2);
      else if (mode === 'floor') ctx.fillRect(-r, -r, r * 2, r * 2);
      else if (mode === 'stair') { ctx.beginPath(); ctx.moveTo(-r, r); ctx.lineTo(r, r); ctx.lineTo(-r, -r); ctx.closePath(); ctx.fill(); }
      else if (mode === 'roof') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }

    // Player-built buildings
    for (const b of this.state.buildings) {
      if (!b.alive) continue;
      if (b.pos.x < viewLeft || b.pos.x > viewRight || b.pos.y < viewTop || b.pos.y > viewBottom) continue;
      ctx.save();
      ctx.translate(b.pos.x, b.pos.y);
      const alpha = b.building ? 0.5 + b.buildProgress * 0.5 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.buildingSystem.getMaterialColor(b.material);
      if (b.type === 'wall') {
        ctx.fillRect(-b.radius, -b.radius, b.radius * 2, b.radius * 2);
      } else if (b.type === 'floor') {
        ctx.fillRect(-b.radius, -b.radius, b.radius * 2, b.radius * 2);
        ctx.strokeStyle = '#fff'; ctx.strokeRect(-b.radius + 2, -b.radius + 2, b.radius * 2 - 4, b.radius * 2 - 4);
      } else if (b.type === 'stair') {
        ctx.beginPath(); ctx.moveTo(-b.radius, b.radius); ctx.lineTo(b.radius, b.radius); ctx.lineTo(-b.radius, -b.radius); ctx.closePath(); ctx.fill();
      } else if (b.type === 'roof') {
        ctx.beginPath(); ctx.moveTo(0, -b.radius); ctx.lineTo(b.radius, 0); ctx.lineTo(0, b.radius); ctx.lineTo(-b.radius, 0); ctx.closePath(); ctx.fill();
      }
      if (b.health < b.maxHealth) {
        ctx.fillStyle = '#333'; ctx.fillRect(-15, -b.radius - 8, 30, 4);
        ctx.fillStyle = '#2ecc71'; ctx.fillRect(-15, -b.radius - 8, 30 * (b.health / b.maxHealth), 4);
      }
      ctx.restore();
    }

    // Map border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.state.mapSize, this.state.mapSize);

    // Draw storm (outside safe zone)
    ctx.fillStyle = 'rgba(138, 43, 226, 0.3)';
    ctx.fillRect(-1000, -1000, CONFIG.MAP_SIZE + 2000, CONFIG.MAP_SIZE + 2000);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(this.state.stormCenter.x, this.state.stormCenter.y, this.state.stormRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(138, 43, 226, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.state.stormCenter.x, this.state.stormCenter.y, this.state.stormRadius, 0, Math.PI * 2);
    ctx.stroke();
    if (this.stormSystem['moving'] || this.state.stormTimer > 0) {
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.state.nextStormCenter.x, this.state.nextStormCenter.y, this.state.nextStormRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Particles
    for (const p of this.state.particles) {
      if (!p.alive) continue;
      if (p.pos.x < viewLeft || p.pos.x > viewRight || p.pos.y < viewTop || p.pos.y > viewBottom) continue;
      ctx.globalAlpha = 1 - (p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size * (1 - p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Projectiles
    ctx.fillStyle = '#f1c40f';
    for (const proj of this.state.projectiles) {
      if (!proj.alive) continue;
      if (proj.pos.x < viewLeft || proj.pos.x > viewRight || proj.pos.y < viewTop || proj.pos.y > viewBottom) continue;
      ctx.beginPath();
      ctx.arc(proj.pos.x, proj.pos.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bots (single-player only)
    if (!this.isMultiplayer) {
      for (const bot of this.state.bots) {
        if (!bot.alive) continue;
        // Cull off-screen bots
        if (bot.pos.x < viewLeft || bot.pos.x > viewRight || bot.pos.y < viewTop || bot.pos.y > viewBottom) continue;
        ctx.save();
        ctx.translate(bot.pos.x, bot.pos.y);
        ctx.rotate(bot.rotation);
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(0, 0, bot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(bot.radius + 5, 0);
        ctx.lineTo(bot.radius - 5, -5);
        ctx.lineTo(bot.radius - 5, 5);
        ctx.fill();
        ctx.restore();
        // Health bar above bot
        const barW = 30;
        ctx.fillStyle = '#333';
        ctx.fillRect(bot.pos.x - barW / 2, bot.pos.y - bot.radius - 10, barW, 4);
        ctx.fillStyle = bot.health > 50 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(bot.pos.x - barW / 2, bot.pos.y - bot.radius - 10, barW * (bot.health / CONFIG.PLAYER_MAX_HEALTH), 4);
      }
    }

    // Draw remote players
    for (const [sessionId, rp] of this.remotePlayers) {
      if (sessionId === this.multiplayerSession?.room?.sessionId) continue;
      if (!rp.alive) continue;
      ctx.save();
      ctx.translate(rp.x, rp.y);
      ctx.rotate(rp.rotation || 0);
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.arc(0, 0, CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(CONFIG.PLAYER_RADIUS + 5, 0);
      ctx.lineTo(CONFIG.PLAYER_RADIUS - 5, -5);
      ctx.lineTo(CONFIG.PLAYER_RADIUS - 5, 5);
      ctx.fill();
      ctx.restore();
      // Name tag
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(rp.name || 'Player', rp.x, rp.y - CONFIG.PLAYER_RADIUS - 8);
    }

    // Mobility features
    this.mobilitySystem.render(ctx, this.state);

    // Items (grenades, traps, supply drops)
    this.itemSystem.render(ctx, this.state);

    // Bosses
    this.bossSystem.render(ctx, this.state);

    // Player
    this.renderPlayer(ctx, this.state.player);

    ctx.restore();

    // HUD
    this.renderHUD();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
    const { x, y } = player.pos;
    const r = player.radius;

    // Body
    ctx.fillStyle = '#4a90d9';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(player.rotation) * (r + 10), y + Math.sin(player.rotation) * (r + 10));
    ctx.stroke();

    // Outline
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  private getBiomeColor(biome: Biome): string {
    switch (biome) {
      case 'water': return '#2980b9';
      case 'beach': return '#f4d03f';
      case 'grass': return '#58d68d';
      case 'forest': return '#2ecc71';
      case 'mountain': return '#95a5a6';
      default: return '#58d68d';
    }
  }

  private renderHUD() {
    const ctx = this.ctx; const p = this.state.player;
    const cw = this.camera.width; const ch = this.camera.height;

    // Health bar (bottom center, above weapon slots)
    const barW = 200, barH = 20;
    const bx = cw / 2 - barW / 2;
    const by = ch - 80;
    ctx.fillStyle = '#333'; ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(bx, by, barW * (p.health / CONFIG.PLAYER_MAX_HEALTH), barH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(p.health)} HP`, bx + barW / 2, by + 15);

    // Shield bar
    if (p.shield > 0) {
      ctx.fillStyle = '#333'; ctx.fillRect(bx, by - 14, barW, 12);
      ctx.fillStyle = '#3498db'; ctx.fillRect(bx, by - 14, barW * (p.shield / CONFIG.PLAYER_MAX_SHIELD), 12);
      ctx.strokeRect(bx, by - 14, barW, 12);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace';
      ctx.fillText(`${Math.ceil(p.shield)} SHIELD`, bx + barW / 2, by - 4);
    }

    // Weapon slots
    const slotSize = 50; const slotGap = 5;
    const totalWidth = 5 * (slotSize + slotGap) - slotGap;
    const startX = cw / 2 - totalWidth / 2;
    const slotY = ch - 50;
    for (let i = 0; i < 5; i++) {
      const sx = startX + i * (slotSize + slotGap);
      const isSelected = i === p.selectedSlot;
      ctx.fillStyle = isSelected ? '#f1c40f' : '#2c3e50';
      ctx.fillRect(sx, slotY, slotSize, slotSize);
      ctx.strokeStyle = isSelected ? '#fff' : '#555';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(sx, slotY, slotSize, slotSize);
      const weapon = p.inventory[i];
      if (weapon) {
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(weapon.name.substring(0, 6), sx + slotSize / 2, slotY + 20);
        if (weapon.ammo !== Infinity) ctx.fillText(`${weapon.ammo}`, sx + slotSize / 2, slotY + 38);
      }
      ctx.fillStyle = '#aaa'; ctx.font = 'bold 12px monospace';
      ctx.fillText(`${i + 1}`, sx + 8, slotY + 12);
    }

    // Materials
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d4a373'; ctx.fillText(`Wood: ${p.materials.wood}`, 20, ch - 60);
    ctx.fillStyle = '#c0392b'; ctx.fillText(`Brick: ${p.materials.brick}`, 20, ch - 45);
    ctx.fillStyle = '#7f8c8d'; ctx.fillText(`Metal: ${p.materials.metal}`, 20, ch - 30);

    // Building indicator
    if (this.buildingSystem.isBuilding) {
      ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 14px monospace';
      ctx.fillText(`BUILDING: ${this.buildingSystem.getBuildMode()?.toUpperCase()} [${this.buildingSystem.getMaterial().toUpperCase()}]`, 20, ch - 100);
    }

    // Coordinates & alive count
    ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
    ctx.fillText(`Pos: ${Math.round(p.pos.x)}, ${Math.round(p.pos.y)}`, 20, 30);
    ctx.fillText(`Alive: ${this.state.playersAlive}`, 20, 50);

    // After coordinates, add:
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Storm Phase: ${this.state.stormPhase + 1}`, 20, 70);
    ctx.fillText(`Storm Dmg: ${this.state.stormDamage}/s`, 20, 90);

    // Minimap (top right)
    const mapSize = 150;
    const mx = cw - mapSize - 20;
    const my = 20;
    const scale = mapSize / CONFIG.MAP_SIZE;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mx, my, mapSize, mapSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mapSize, mapSize);

    // Storm on minimap
    ctx.fillStyle = 'rgba(138,43,226,0.5)';
    ctx.beginPath();
    ctx.arc(mx + this.state.stormCenter.x * scale, my + this.state.stormCenter.y * scale, this.state.stormRadius * scale, 0, Math.PI * 2);
    ctx.fill();

    // Player on minimap
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.arc(mx + p.pos.x * scale, my + p.pos.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bots on minimap (single-player only)
    if (!this.isMultiplayer) {
      ctx.fillStyle = 'rgba(231,76,60,0.6)';
      for (const bot of this.state.bots) {
        if (!bot.alive) continue;
        ctx.beginPath();
        ctx.arc(mx + bot.pos.x * scale, my + bot.pos.y * scale, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Remote players on minimap (multiplayer)
    if (this.isMultiplayer) {
      ctx.fillStyle = 'rgba(155,89,182,0.6)';
      for (const [_, rp] of this.remotePlayers) {
        if (!rp.alive) continue;
        ctx.beginPath();
        ctx.arc(mx + rp.x * scale, my + rp.y * scale, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Safe zone outline
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx + this.state.stormCenter.x * scale, my + this.state.stormCenter.y * scale, this.state.stormRadius * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Storm warning overlay
    const warning = this.stormSystem.getStormWarning(this.state);
    if (warning > 0) {
      ctx.fillStyle = `rgba(138, 43, 226, ${warning * 0.3})`;
      ctx.fillRect(0, 0, cw, ch);
    }

    // Victory/Defeat screen
    if (this.state.matchPhase === 'ended') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      const msg = this.state.player.alive ? 'VICTORY ROYALE!' : 'ELIMINATED';
      ctx.fillText(msg, cw / 2, ch / 2);
      ctx.font = '20px monospace';
      ctx.fillText('Press N to restart', cw / 2, ch / 2 + 50);
      ctx.fillStyle = '#3498db';
      ctx.font = '16px monospace';
      ctx.fillText('Press K for Kill Cam', cw / 2, ch / 2 + 80);
    }

    // Spectator indicator
    if (this.spectatorSystem.active) {
      const target = this.spectatorSystem.getCurrentTarget();
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`SPECTATING: ${target?.id === 'player' ? 'YOU' : target?.id || 'NONE'}`, cw / 2, ch / 2 + 110);
      ctx.font = '14px monospace';
      ctx.fillText('LEFT/RIGHT to switch targets', cw / 2, ch / 2 + 130);
    }

    // Kill feed
    ctx.textAlign = 'right';
    for (let i = 0; i < this.state.killFeed.length; i++) {
      ctx.fillText(this.state.killFeed[i], cw - 20, 30 + i * 18);
    }
  }

  private showKillCam() {
    const frames = this.replaySystem.getKillCamFrames(this.state.matchTime, 3);
    if (frames.length === 0) return;
    // Simple: just log for now, full playback is complex
    console.log('Kill cam frames:', frames.length);
  }

  private restart() {
    this.stop();
    this.input = new InputManager(this.canvas);
    this.state = this.createInitialState();
    const mapData = this.mapGen.generate();
    this.tiles = mapData.tiles;
    this.lootSystem.spawnFloorLoot(this.state);
    this.mobilitySystem = new MobilitySystem();
    this.mobilitySystem.spawnMobilityFeatures(this.state);
    this.itemSystem = new ItemSystem();
    this.aiSystem = new AISystem(this.combatSystem);
    this.aiSystem.spawnBots(this.state, 20);
    this.stormSystem = new StormSystem();
    this.state.stormRadius = CONFIG.MAP_SIZE * 0.8;
    this.state.stormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormRadius = CONFIG.MAP_SIZE * 0.8;
    this.bossSystem = new BossSystem();
    this.aiDirector = new AIDirector();
    this.lastTime = performance.now();
    this.matchStats = { kills: 0, damageDealt: 0, buildingsBuilt: 0 };
    this.matchStatsReported = false;
    this.spectatorSystem.stopSpectating();
    this.replaySystem.clear();
    this.start();
  }

  stop(): void {
    this.running = false;
    this.input.destroy();
  }
}
