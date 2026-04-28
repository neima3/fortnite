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
import { GameRenderer, Light, WeatherConfig } from './engine/Renderer.js';
import { HUDRenderer } from './ui/HUD.js';
import { PhysicsEngine } from './engine/Physics.js';
import { VehicleSystem } from './systems/VehicleSystem.js';
import { BattleBusSystem } from './systems/BattleBusSystem.js';
import { LootChestSystem } from './systems/LootChestSystem.js';
import { EmoteSystem } from './systems/EmoteSystem.js';
import { NPCSystem } from './systems/NPCSystem.js';
import { GameModeSystem } from './systems/GameModeSystem.js';
import { FishingSystem } from './systems/FishingSystem.js';
import { KillStreakSystem } from './systems/KillStreakSystem.js';
import { createExplosion, createMuzzleFlash, createHitMarker, updateParticle, createBloodSplat, createFootstepDust, createLootBeam } from './entities/Particle.js';
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
  private renderer: GameRenderer;
  private hud: HUDRenderer;
  private physics: PhysicsEngine;
  private vehicleSystem: VehicleSystem;
  private matchStats = { kills: 0, damageDealt: 0, buildingsBuilt: 0 };
  private matchStatsReported = false;
  private multiplayerSession: ColyseusSession | null = null;
  private isMultiplayer: boolean = false;
  private remotePlayers: Map<string, any> = new Map();
  private progression: ProgressionSystem;
  private replaySystem: ReplaySystem;
  private spectatorSystem: SpectatorSystem;
  private bossSystem: BossSystem;
  private aiDirector: AIDirector;
  private battleBusSystem: BattleBusSystem;
  private chestSystem: LootChestSystem;
  private emoteSystem: EmoteSystem;
  private npcSystem: NPCSystem;
  private gameModeSystem: GameModeSystem;
  private fishingSystem: FishingSystem;
  private killStreakSystem: KillStreakSystem;
  private gameTime: number = 0;
  private lastDamageTime: number = 0;
  private lastPlayerPos: { x: number; y: number } = { x: 0, y: 0 };
  private playerInVehicle: boolean = false;
  private currentWeaponSpread: number = 0;
  private crosshairOnTarget: boolean = false;
  private showFps: boolean = false;
  private fpsCounter: number = 0;
  private fpsTimer: number = 0;
  private currentFps: number = 60;
  private busPhase: 'bus' | 'drop' | 'playing' = 'bus';
  private busState: any = null;
  private countdownTimer: number = 3;
  private showCountdown: boolean = false;
  private graphicsQuality: string = 'high';
  private settingsLoaded: boolean = false;

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
    this.aiSystem.spawnBots(this.state, 50);
    this.stormSystem = new StormSystem();
    this.state.stormRadius = CONFIG.MAP_SIZE * 0.8;
    this.state.stormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormRadius = CONFIG.MAP_SIZE * 0.8;
    this.menu = new MenuScreen();
    this.audioManager = new AudioManager();
    this.renderer = new GameRenderer(canvas, this.camera);
    this.hud = new HUDRenderer();
    this.physics = new PhysicsEngine();
    this.vehicleSystem = new VehicleSystem();
    this.vehicleSystem.spawnVehicles(CONFIG.MAP_SIZE);
    this.progression = new ProgressionSystem();
    this.replaySystem = new ReplaySystem();
    this.spectatorSystem = new SpectatorSystem();
    this.bossSystem = new BossSystem();
    this.aiDirector = new AIDirector();
    this.renderer.setDayNightSpeed(0.005);
    this.renderer.setWeather({ type: 'clear', intensity: 0, windAngle: Math.PI * 0.25, windSpeed: 50 });
    this.battleBusSystem = new BattleBusSystem();
    this.chestSystem = new LootChestSystem();
    this.chestSystem.spawnChests(this.mapGen.buildings);
    this.emoteSystem = new EmoteSystem();
    this.npcSystem = new NPCSystem();
    this.npcSystem.spawnNPCs(this.mapGen.buildings);
    this.gameModeSystem = new GameModeSystem();
    this.fishingSystem = new FishingSystem();
    const allTiles = this.tiles.flat();
    this.fishingSystem.spawnFishingSpots(allTiles);
    this.fishingSystem.spawnForageBushes(allTiles);
    this.killStreakSystem = new KillStreakSystem();
    this.loadSettings();

    const originalApplyDamage = this.combatSystem.applyDamage.bind(this.combatSystem);
    this.combatSystem.applyDamage = (state: GameState, targetId: string, damage: number, attackerId: string) => {
      let target = state.player.id === targetId ? state.player : state.bots.find(b => b.id === targetId);
      const wasAlive = target?.alive ?? false;
      const wasShielded = (target?.shield ?? 0) > 0;
      if (attackerId === 'player') {
        this.matchStats.damageDealt += damage;
      }
      const prevHealth = target?.health ?? 0;
      const prevShield = target?.shield ?? 0;
      originalApplyDamage(state, targetId, damage, attackerId);
      if (target) {
        const actualDmg = prevHealth - target.health;
        const shieldDmg = prevShield - target.shield;
        if (actualDmg > 0 || shieldDmg > 0) {
          this.hud.addDamageNumber(target.pos.x, target.pos.y, Math.round(actualDmg || shieldDmg), shieldDmg > 0 && actualDmg === 0, false);
          if (attackerId === 'player') {
            this.audioManager.playHit();
            this.killStreakSystem.onDamageDealt(actualDmg || shieldDmg);
          }
          if (targetId === 'player') {
            this.renderer.triggerDamageFlash();
            this.lastDamageTime = this.gameTime;
            this.audioManager.playDamage();
          }
          if (attackerId !== 'player' && targetId === 'player') {
            this.state.particles.push(...createBloodSplat(target.pos, attackerId === 'player' ? target.rotation + Math.PI : target.rotation));
          }
        }
      }
      if (attackerId === 'player' && wasAlive && target && !target.alive) {
        this.matchStats.kills++;
        this.renderer.triggerKillFlash();
        this.audioManager.playElimination();
        this.hud.addKillFeedEntry(`You eliminated ${target.id}`, true);
        const killDist = dist(this.state.player.pos, target.pos);
        const weapon = this.state.player.inventory[this.state.player.selectedSlot];
        const banner = this.killStreakSystem.onKill(killDist, weapon?.type || 'pickaxe', false);
        this.killStreakSystem.onShotFired(true);
      } else if (wasAlive && target && !target.alive && attackerId !== 'player') {
        this.hud.addKillFeedEntry(`${attackerId} eliminated ${target.id}`, false);
      }
    };

    this.showMainMenu();
  }

  private showMainMenu() {
    this.menu.showMainMenu(
      () => { this.menu.hide(); this.showModeSelect(); },
      () => { this.menu.showSettings(); },
      () => { this.menu.showProgression(this.progression.getProgress(), () => this.showMainMenu()); }
    );
  }

  private showModeSelect() {
    const modes = this.gameModeSystem.getModes();
    const modeButtons = modes.map(m =>
      `<button id="btn-mode-${m.id}" style="padding:15px 40px;font-size:18px;background:${m.id === 'solo' ? '#f1c40f' : m.id === 'zonewars' ? '#e74c3c' : '#3498db'};color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;margin:8px;font-family:monospace;font-weight:bold;min-width:250px;">
        ${m.icon} ${m.name}
        <div style="font-size:11px;font-weight:normal;color:#333;margin-top:4px;">${m.description}</div>
      </button>`
    ).join('');
    this.menu.container.innerHTML = `
      <div id="mode-select" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;font-family:monospace;">
        <h1 style="font-size:48px;margin-bottom:40px;text-shadow:0 0 20px #f1c40f;">SELECT MODE</h1>
        ${modeButtons}
        <button id="btn-multi" style="padding:12px 40px;font-size:16px;background:transparent;color:#f1c40f;border:2px solid #f1c40f;border-radius:8px;cursor:pointer;margin:15px;font-family:monospace;">MULTIPLAYER</button>
      </div>
    `;
    this.menu.container.style.pointerEvents = 'auto';
    modes.forEach(m => {
      document.getElementById(`btn-mode-${m.id}`)!.onclick = () => {
        this.gameModeSystem.setMode(m.id);
        this.menu.hide();
        this.input.destroy();
        this.input = new InputManager(this.canvas);
        this.gameStarted = true;
        this.isMultiplayer = false;
        this.audioManager.resume();
        this.applyGameMode();
        this.initBusPhase();
        this.start();
      };
    });
    document.getElementById('btn-multi')!.onclick = () => { this.menu.hide(); this.showMultiplayerLobby(); };
  }

  private applyGameMode() {
    const mode = this.gameModeSystem.getActiveMode();
    const p = this.state.player;
    p.materials = { ...mode.startMaterials };
    p.inventory = mode.startInventory.map(t => this.createWeapon(t));
    while (p.inventory.length < 5) p.inventory.push(null);
    const botCount = mode.botCount;
    this.aiSystem = new AISystem(this.combatSystem);
    this.aiSystem.spawnBots(this.state, botCount);
    this.state.playersAlive = 1 + botCount;
  }

  private async showMultiplayerLobby() {
    this.isMultiplayer = true;
    this.multiplayerSession = new ColyseusSession();
    const onReady = () => { this.multiplayerSession?.send('ready', {}); };
    const onStart = () => { this.multiplayerSession?.send('start_match', {}); this.menu.hide(); this.gameStarted = true; this.start(); };
    const onLeave = () => { this.multiplayerSession?.disconnect(); this.showMainMenu(); };
    this.multiplayerSession.on('connected', (snapshot) => { this.menu.showLobby(snapshot, true, onReady, onStart, onLeave); });
    this.multiplayerSession.on('state', (snapshot) => {
      if (this.menu.isVisible()) this.menu.showLobby(snapshot, true, onReady, onStart, onLeave);
      for (const p of snapshot.remotePlayers) this.remotePlayers.set(p.sessionId, p);
      const activeIds = new Set(snapshot.players.map((p: any) => p.sessionId));
      for (const id of this.remotePlayers.keys()) { if (!activeIds.has(id)) this.remotePlayers.delete(id); }
    });
    this.multiplayerSession.on('match_start', () => { this.menu.hide(); this.gameStarted = true; this.start(); });
    try {
      await this.multiplayerSession.connect({ mode: 'solo', playerName: 'Player1' });
      const originalApplyDamage = this.combatSystem.applyDamage.bind(this.combatSystem);
      this.combatSystem.applyDamage = (state: any, targetId: string, damage: number, attackerId: string) => {
        if (attackerId === 'player' && this.multiplayerSession?.room) this.multiplayerSession.send('hit', { targetId, damage });
        originalApplyDamage(state, targetId, damage, attackerId);
      };
      this.multiplayerSession.on('hit_confirmed', (data: any) => {
        if (data.targetId === this.multiplayerSession?.room?.sessionId) {
          this.state.player.health = data.remainingHealth;
          if (this.state.player.health <= 0) { this.state.player.health = 0; this.state.player.alive = false; this.state.matchPhase = 'ended'; }
        }
      });
      this.multiplayerSession.on('elimination', (data: any) => { this.state.killFeed.unshift(`${data.attackerId} eliminated ${data.targetId}`); if (this.state.killFeed.length > 5) this.state.killFeed.pop(); });
      this.multiplayerSession.on('build_confirmed', (data: any) => {
        if (data.ownerId !== this.multiplayerSession?.room?.sessionId) {
          const b = data.building;
          this.state.buildings.push({ id: b.id, pos: { x: b.x, y: b.y }, vel: { x: 0, y: 0 }, radius: CONFIG.BUILDING_GRID_SIZE / 2, rotation: 0, alive: true, type: b.type, material: b.material, health: b.health, maxHealth: b.maxHealth, building: false, buildProgress: 1, buildTime: 0, builtAt: performance.now() / 1000 } as any);
        }
      });
    } catch (err: any) {
      console.error('Failed to connect:', err);
      this.menu.hide();
      this.showMainMenu();
    }
  }

  private showSettings() {
    this.menu.showSettings();
  }

  private loadSettings() {
    if (this.settingsLoaded) return;
    this.settingsLoaded = true;
    try {
      const saved = JSON.parse(localStorage.getItem('stormsurge_settings') || '{}');
      if (saved.volume !== undefined) this.audioManager.setVolume(saved.volume / 100);
      if (saved.quality) this.graphicsQuality = saved.quality;
    } catch {}
  }

  private initBusPhase() {
    this.busPhase = 'bus';
    this.busState = this.battleBusSystem.init(CONFIG.MAP_SIZE);
    this.state.matchPhase = 'bus';
    this.countdownTimer = 3;
    this.showCountdown = true;
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
      player, bots: [], projectiles: [], buildings: [], lootItems: [], particles: [],
      grenades: [], traps: [], supplyDrops: [],
      chests: [], npcs: [],
      camera: { x: 0, y: 0 }, mapSize,
      stormCenter: { x: mapSize / 2, y: mapSize / 2 }, stormRadius: mapSize * 0.45,
      nextStormCenter: { x: mapSize / 2, y: mapSize / 2 }, nextStormRadius: mapSize * 0.35,
      stormPhase: 0, stormTimer: 0, stormDamage: 1,
      matchTime: 0, matchPhase: 'playing', playersAlive: 100, killFeed: [],
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.replaySystem.startRecording();
    this.audioManager.startAmbient();
    requestAnimationFrame(this.loop);
  }

  private loop = (time: number) => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.fpsCounter++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) { this.currentFps = this.fpsCounter; this.fpsCounter = 0; this.fpsTimer = 0; }
    this.update(dt);
    this.render();
    this.input.resetFrame();
    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.paused || !this.gameStarted) return;
    this.gameTime += dt;
    this.hud.update(dt);

    if (this.busPhase !== 'playing') {
      this.updateBusPhase(dt);
      return;
    }

    if (this.showCountdown) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) this.showCountdown = false;
      return;
    }

    if (!this.isMultiplayer) this.aiSystem.update(this.state, dt);
    const player = this.state.player;
    const input = this.input;

    this.renderer.updateDayNight(dt);
    this.renderer.updateWeather(dt);
    this.audioManager.setCameraPosition(this.camera.pos.x + this.camera.width / 2, this.camera.pos.y + this.camera.height / 2);

    if (this.gameTime % 30 < dt) {
      const weatherRoll = Math.random();
      if (weatherRoll < 0.5) this.renderer.setWeather({ type: 'clear', intensity: 0, windAngle: Math.random() * Math.PI * 2, windSpeed: 30 + Math.random() * 50 });
      else if (weatherRoll < 0.75) this.renderer.setWeather({ type: 'rain', intensity: 0.3 + Math.random() * 0.5, windAngle: Math.random() * Math.PI * 2, windSpeed: 80 + Math.random() * 120 });
      else if (weatherRoll < 0.9) this.renderer.setWeather({ type: 'fog', intensity: 0.3 + Math.random() * 0.4, windAngle: 0, windSpeed: 0 });
      else this.renderer.setWeather({ type: 'storm', intensity: 0.6 + Math.random() * 0.4, windAngle: Math.random() * Math.PI * 2, windSpeed: 150 + Math.random() * 100 });
    }

    this.renderer.clearLights();
    this.renderer.addLight({ x: player.pos.x, y: player.pos.y, radius: 300, color: '#ffffff', intensity: 0.3, falloff: 2 });

    this.mobilitySystem.update(this.state, dt);
    this.itemSystem.update(this.state, dt);
    this.bossSystem.update(this.state, dt);
    this.aiDirector.update(this.state, dt);
    this.vehicleSystem.update(this.state, dt);
    this.replaySystem.recordFrame(this.state.matchTime, this.state);
    this.killStreakSystem.update(dt);

    const fishingResult = this.fishingSystem.update(dt);
    if (fishingResult) {
      if (fishingResult.shieldAmount) { player.shield = Math.min(CONFIG.PLAYER_MAX_SHIELD, player.shield + fishingResult.shieldAmount); }
      if (fishingResult.healthAmount) { player.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, player.health + fishingResult.healthAmount); }
      if (fishingResult.speedBoost) { player.speed = CONFIG.PLAYER_SPEED * fishingResult.speedBoost; setTimeout(() => { player.speed = CONFIG.PLAYER_SPEED; }, (fishingResult.speedDuration || 5) * 1000); }
      if (fishingResult.materials) { player.materials.wood += fishingResult.materials.wood || 0; player.materials.brick += fishingResult.materials.brick || 0; player.materials.metal += fishingResult.materials.metal || 0; }
      if (fishingResult.weaponType) {
        const emptySlot = player.inventory.findIndex(w => w === null);
        if (emptySlot !== -1) player.inventory[emptySlot] = this.createWeapon(fishingResult.weaponType);
      }
      this.audioManager.playPickup();
    }

    this.playerInVehicle = this.vehicleSystem.getVehicleForPlayer('player') !== null;

    if (input.isKeyDown('b')) {
      if (this.playerInVehicle) {
        this.vehicleSystem.tryExit('player');
        this.playerInVehicle = false;
      } else {
        const v = this.vehicleSystem.tryEnter('player', player.pos, true);
        if (v) this.playerInVehicle = true;
      }
    }

    if (this.playerInVehicle) {
      const vehicle = this.vehicleSystem.getVehicleForPlayer('player')!;
      this.vehicleSystem.handleInput(vehicle, {
        forward: input.isKeyDown('w') || input.isKeyDown('arrowup'),
        backward: input.isKeyDown('s') || input.isKeyDown('arrowdown'),
        left: input.isKeyDown('a') || input.isKeyDown('arrowleft'),
        right: input.isKeyDown('d') || input.isKeyDown('arrowright'),
        boost: input.isKeyDown('shift'),
      }, dt);
      player.pos.x = vehicle.pos.x;
      player.pos.y = vehicle.pos.y;
    } else if (!this.mobilitySystem.isGliding(this.state.player.id)) {
      let dx = 0, dy = 0;
      if (input.isKeyDown('w') || input.isKeyDown('arrowup')) dy -= 1;
      if (input.isKeyDown('s') || input.isKeyDown('arrowdown')) dy += 1;
      if (input.isKeyDown('a') || input.isKeyDown('arrowleft')) dx -= 1;
      if (input.isKeyDown('d') || input.isKeyDown('arrowright')) dx += 1;

      if (input.isKeyDown(' ')) {
        const glideDist = 300;
        this.mobilitySystem.startGlide(player, player.pos.x + Math.cos(player.rotation) * glideDist, player.pos.y + Math.sin(player.rotation) * glideDist);
      }

      player.sprinting = input.isKeyDown('shift');
      const baseSpeed = player.speed || CONFIG.PLAYER_SPEED;
      const speed = player.sprinting ? baseSpeed * (CONFIG.PLAYER_SPRINT_SPEED / CONFIG.PLAYER_SPEED) : baseSpeed;

      if (dx !== 0 || dy !== 0) {
        const dir = vec2Norm({ x: dx, y: dy });
        player.vel = vec2Mul(dir, speed);
        this.audioManager.playFootstep(player.pos.x, player.pos.y, player.sprinting);
        if (Math.random() < 0.1) this.state.particles.push(...createFootstepDust(player.pos));
        const forage = this.fishingSystem.tryForage(player.pos, player.radius);
        if (forage) {
          if (forage.type === 'apple') player.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, player.health + 10);
          else if (forage.type === 'mushroom') player.shield = Math.min(CONFIG.PLAYER_MAX_SHIELD, player.shield + 10);
          else if (forage.type === 'hop') { player.speed *= 1.3; setTimeout(() => { player.speed = CONFIG.PLAYER_SPEED; }, 10000); }
          this.audioManager.playPickup();
        }
      } else {
        player.vel = { x: 0, y: 0 };
      }

      player.pos.x += player.vel.x * dt;
      player.pos.y += player.vel.y * dt;
      player.pos.x = clamp(player.pos.x, player.radius, this.state.mapSize - player.radius);
      player.pos.y = clamp(player.pos.y, player.radius, this.state.mapSize - player.radius);

      const tx = Math.floor(player.pos.x / CONFIG.TILE_SIZE);
      const ty = Math.floor(player.pos.y / CONFIG.TILE_SIZE);
      if (tx >= 0 && tx < this.tiles.length && ty >= 0 && ty < this.tiles[0].length) {
        const tile = this.tiles[tx][ty];
        if (tile.obstacle !== 'none' || tile.biome === 'water') {
          const ddx = player.pos.x - (tile.x + CONFIG.TILE_SIZE / 2);
          const ddy = player.pos.y - (tile.y + CONFIG.TILE_SIZE / 2);
          const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const push = player.radius + CONFIG.TILE_SIZE / 2;
          player.pos.x = tile.x + CONFIG.TILE_SIZE / 2 + (ddx / len) * push;
          player.pos.y = tile.y + CONFIG.TILE_SIZE / 2 + (ddy / len) * push;
        }
      }
      for (const b of this.state.buildings) {
        if (!b.alive) continue;
        const d = dist(player.pos, b.pos);
        if (d < player.radius + b.radius) {
          const ddx = player.pos.x - b.pos.x;
          const ddy = player.pos.y - b.pos.y;
          const len = d || 1;
          const push = player.radius + b.radius;
          player.pos.x = b.pos.x + (ddx / len) * push;
          player.pos.y = b.pos.y + (ddy / len) * push;
        }
      }
    }

    const mouseWorld = this.camera.screenToWorld(input.mousePos);
    input.setMouseWorld(mouseWorld);
    player.rotation = angleTo(player.pos, mouseWorld);
    player.aiming = input.mouseDown;

    this.crosshairOnTarget = false;
    for (const bot of this.state.bots) {
      if (!bot.alive) continue;
      if (dist(mouseWorld, bot.pos) < bot.radius + 10) { this.crosshairOnTarget = true; break; }
    }

    const weapon = player.inventory[player.selectedSlot];
    this.currentWeaponSpread = weapon ? (player.aiming ? weapon.spread * 0.5 : weapon.spread) * (player.sprinting ? 1.5 : 1) : 0;

    if (input.isKeyDown('q')) this.buildingSystem.setBuildMode('wall');
    if (input.isKeyDown('e')) this.buildingSystem.setBuildMode('floor');
    if (input.isKeyDown('r') && this.buildingSystem.isBuilding) this.buildingSystem.setBuildMode('stair');
    if (input.isKeyDown('t')) this.buildingSystem.setBuildMode('roof');
    if (input.isKeyDown('g')) this.buildingSystem.toggleMaterial();
    if (input.isKeyDown('escape')) {
      if (this.buildingSystem.isBuilding) this.buildingSystem.setBuildMode(null);
      else if (this.gameStarted) {
        if (this.paused) { this.paused = false; this.menu.hide(); this.lastTime = performance.now(); }
        else this.showPauseMenu();
      }
    }

    this.buildingSystem.updateGhost(player.pos, mouseWorld);
    if (this.buildingSystem.isBuilding && input.mouseClicked) {
      const placed = this.buildingSystem.placeBuilding(this.state);
      if (placed) {
        this.matchStats.buildingsBuilt++;
        this.audioManager.playBuild(placed.pos.x, placed.pos.y);
        if (this.isMultiplayer && this.multiplayerSession?.room) {
          this.multiplayerSession.send('build', { x: placed.pos.x, y: placed.pos.y, type: placed.type, material: placed.material });
        }
      }
    }

    for (let i = 1; i <= 5; i++) { if (input.isKeyDown(String(i))) player.selectedSlot = i - 1; }

    if (!this.spectatorSystem.active) this.camera.follow(player.pos, dt, CONFIG.CAMERA_SMOOTH);

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
      if (s.players?.forEach) {
        const activeIds = new Set<string>();
        s.players.forEach((p: any) => {
          activeIds.add(p.sessionId);
          if (p.sessionId === this.multiplayerSession?.room?.sessionId) {
            this.state.player.health = p.health; this.state.player.shield = p.shield; this.state.player.alive = p.alive;
          } else this.remotePlayers.set(p.sessionId, p);
        });
        for (const id of this.remotePlayers.keys()) { if (!activeIds.has(id)) this.remotePlayers.delete(id); }
      }
      if (!this.state.player.alive) this.state.matchPhase = 'ended';
      else if (this.state.playersAlive <= 1) this.state.matchPhase = 'ended';
    } else {
      this.stormSystem.update(this.state, dt);
    }

    const playerDist = dist(this.state.player.pos, this.state.stormCenter);
    if (playerDist > this.state.stormRadius) {
      this.audioManager.playStormWarning();
      this.audioManager.setStormIntensity(Math.min(1, (playerDist - this.state.stormRadius) / 200));
    } else {
      this.audioManager.setStormIntensity(0);
    }

    if (this.state.matchPhase === 'playing' && this.state.playersAlive <= 1 && this.state.player.alive) {
      this.state.matchPhase = 'ended';
      this.state.killFeed.unshift('VICTORY ROYALE!');
      this.audioManager.playVictory();
    }

    const modeResult = this.gameModeSystem.checkWinCondition(this.state.playersAlive, this.state.player.alive);
    if (modeResult.won && this.state.matchPhase === 'playing') {
      this.state.matchPhase = 'ended';
      this.state.killFeed.unshift(modeResult.message);
      if (modeResult.winner === 'player') this.audioManager.playVictory();
    }

    if (!this.spectatorSystem.active && !this.state.player.alive && this.state.matchPhase === 'ended') {
      this.spectatorSystem.startSpectating(this.state);
    }
    if (this.spectatorSystem.active) {
      this.spectatorSystem.updateTargets(this.state);
      const target = this.spectatorSystem.getCurrentTarget();
      if (target) this.camera.follow(target.pos, dt, 0.05);
    }

    this.combatSystem.update(this.state, dt);
    this.buildingSystem.updateBuildings(this.state, dt);

    if (input.mouseClicked && !this.buildingSystem.isBuilding) {
      const w = this.state.player.inventory[this.state.player.selectedSlot];
      if (w && w.type === 'grenade') {
        this.itemSystem.throwGrenade(this.state, this.state.player);
      } else if (w && w.type === 'trap') {
        this.itemSystem.placeTrap(this.state, this.state.player);
      } else {
        const fired = this.combatSystem.fireWeapon(this.state, this.state.player);
        if (fired && w) {
          this.audioManager.playShoot(w.type, player.pos.x, player.pos.y);
          this.state.particles.push(...createMuzzleFlash(player.pos, player.rotation));
          this.renderer.triggerScreenShake(w.type === 'shotgun' || w.type === 'sniper' ? 4 : 1.5, 0.15);
          this.renderer.addLight({ x: player.pos.x + Math.cos(player.rotation) * 30, y: player.pos.y + Math.sin(player.rotation) * 30, radius: 200, color: '#ffaa44', intensity: 0.8, falloff: 3 });
        }
      }
    }

    if (input.isKeyDown('x')) {
      const w = this.state.player.inventory[this.state.player.selectedSlot];
      if (w) this.combatSystem.reload(w);
    }

    if (input.isKeyDown('f')) {
      const picked = this.lootSystem.tryPickup(this.state, this.state.player);
      const opened = this.itemSystem.tryOpenSupplyDrop(this.state, this.state.player);
      const chest = this.chestSystem.tryOpen(player.pos, player.radius);
      const npc = this.npcSystem.tryInteract(player.pos, player.radius);
      if (picked || opened) { this.audioManager.playPickup(); this.renderer.triggerHealFlash(); }
      if (chest) {
        this.audioManager.playPickup();
        const items = this.chestSystem.getChests().find(c => c.id === chest.id);
        if (items) {
          for (const item of (items as any).flyingItems || []) {
            this.state.lootItems.push({
              id: `loot_${Date.now()}_${Math.random()}`,
              pos: vec2(item.x, item.y), vel: vec2(0, 0), radius: 15, rotation: 0, alive: true,
              item: item.weapon || item.type, quantity: item.quantity || 1,
            });
          }
        }
      }
      if (npc && !this.npcSystem.isShopOpen()) {
        this.audioManager.playPickup();
      }
      if (!this.fishingSystem.tryFish(player.pos, player.radius) && !picked && !opened && !chest && !npc) {
      }
    }

    if (input.isKeyDown('h')) {
      this.fishingSystem.tryFish(player.pos, player.radius);
    }

    if (input.isKeyDown('v')) {
      if (this.itemSystem.useConsumable(this.state, this.state.player)) {
        this.audioManager.playHeal();
        this.renderer.triggerHealFlash();
      }
    }

    for (const p of this.state.particles) updateParticle(p, dt);
    this.state.particles = this.state.particles.filter(p => p.alive);
    if (this.state.particles.length > 800) this.state.particles = this.state.particles.slice(-800);
    if (this.state.projectiles.length > 300) this.state.projectiles = this.state.projectiles.slice(-300);

    if (input.isKeyDown('n') && this.state.matchPhase === 'ended') this.restart();
    if (input.isKeyDown('KeyK') && this.state.matchPhase === 'ended') this.showKillCam();

    if (this.spectatorSystem.active) {
      if (input.isKeyDown('ArrowRight') || input.isKeyDown('KeyD')) this.spectatorSystem.nextTarget(this.state);
      if (input.isKeyDown('ArrowLeft') || input.isKeyDown('KeyA')) this.spectatorSystem.prevTarget(this.state);
    }

    if (input.isKeyDown('f3')) this.showFps = !this.showFps;

    if (input.isKeyDown('tab') && !this.emoteSystem.getState().showWheel) {
      this.emoteSystem.toggleWheel();
    }
    if (this.emoteSystem.getState().showWheel) {
      const mouseWorld2 = this.camera.screenToWorld(input.mousePos);
      const screenCX = this.camera.width / 2;
      const screenCY = this.camera.height / 2;
      const angle = Math.atan2(input.mousePos.y - screenCY, input.mousePos.x - screenCX);
      const idx = Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / 8));
      this.emoteSystem.setWheelSelection(idx);
    }
    if (!input.isKeyDown('tab') && this.emoteSystem.getState().showWheel) {
      this.emoteSystem.confirmWheelSelection();
    }

    const emotePlaying = this.emoteSystem.update(dt);
    if (emotePlaying) {
      player.vel = { x: 0, y: 0 };
    }

    if (this.isMultiplayer && this.multiplayerSession?.room && this.state.player.alive) {
      this.multiplayerSession.send('move', { x: this.state.player.pos.x, y: this.state.player.pos.y, rotation: this.state.player.rotation });
    }

    if (this.state.matchPhase === 'ended' && !this.matchStatsReported) {
      this.matchStatsReported = true;
      const placement = this.state.player.alive ? 1 : this.state.playersAlive + 1;
      this.progression.reportMatchEnd(placement, this.matchStats.kills, this.matchStats.damageDealt, this.matchStats.buildingsBuilt);
    }

    this.lastPlayerPos = { x: player.pos.x, y: player.pos.y };
    this.killStreakSystem.onDistanceTraveled(dist(player.pos, this.lastPlayerPos));
  }

  private updateBusPhase(dt: number): void {
    this.renderer.updateDayNight(dt);
    this.renderer.updateWeather(dt);
    this.chestSystem.update(dt);
    this.npcSystem.update(dt);

    const input = this.input;
    if (this.busPhase === 'bus') {
      this.busState = this.battleBusSystem.update(this.busState, dt, this.state.player.pos, false, false, false, false, input.isKeyDown(' '));
      if (input.isKeyDown(' ')) {
        this.busPhase = 'drop';
        this.state.matchPhase = 'drop';
        this.state.player.pos.x = this.busState.busX;
        this.state.player.pos.y = this.busState.busY;
        this.camera.follow(this.state.player.pos, dt, 1);
      }
    } else if (this.busPhase === 'drop') {
      this.busState = this.battleBusSystem.update(this.busState, dt, this.state.player.pos,
        input.isKeyDown('w') || input.isKeyDown('arrowup'),
        input.isKeyDown('a') || input.isKeyDown('arrowleft'),
        input.isKeyDown('d') || input.isKeyDown('arrowright'),
        input.isKeyDown('s') || input.isKeyDown('arrowdown'),
        false
      );
      this.state.player.pos.x = this.busState.dropX || this.state.player.pos.x;
      this.state.player.pos.y = this.busState.dropY || this.state.player.pos.y;
      if (this.battleBusSystem.shouldTransitionToPlaying(this.busState)) {
        this.busPhase = 'playing';
        this.state.matchPhase = 'playing';
        this.showCountdown = true;
        this.countdownTimer = 3;
        this.stormSystem.update(this.state, 0);
      }
    }
  }

  private render(): void {
    if (!this.gameStarted) return;
    const ctx = this.ctx;
    const cam = this.camera;

    this.renderer.beginFrame();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    const shake = this.renderer.getScreenShake();
    ctx.translate(shake.x, shake.y);
    ctx.translate(-cam.pos.x, -cam.pos.y);

    const tileSize = CONFIG.TILE_SIZE;
    const startX = Math.max(0, Math.floor(cam.pos.x / tileSize) - 1);
    const endX = Math.min(this.tiles.length, Math.ceil((cam.pos.x + cam.width) / tileSize) + 1);
    const startY = Math.max(0, Math.floor(cam.pos.y / tileSize) - 1);
    const endY = Math.min(this.tiles[0].length, Math.ceil((cam.pos.y + cam.height) / tileSize) + 1);
    this.mapGen.renderChunk(ctx, startX, startY, endX, endY, tileSize, this.gameTime);

    const viewLeft = cam.pos.x - 200;
    const viewRight = cam.pos.x + cam.width + 200;
    const viewTop = cam.pos.y - 200;
    const viewBottom = cam.pos.y + cam.height + 200;

    for (const loot of this.state.lootItems) {
      if (!loot.alive) continue;
      if (loot.pos.x < viewLeft || loot.pos.x > viewRight || loot.pos.y < viewTop || loot.pos.y > viewBottom) continue;
      ctx.save();
      ctx.translate(loot.pos.x, loot.pos.y);
      const pulse = 1 + Math.sin(this.gameTime * 4) * 0.15;
      const lootRadius = loot.radius * pulse;
      const rarityColors: Record<string, string> = { common: '#8d8d8d', uncommon: '#30b42d', rare: '#3caceb', epic: '#b44ceb', legendary: '#eb9b3c' };
      const rarityColor = typeof loot.item === 'object' && (loot.item as any).rarity ? (rarityColors[(loot.item as any).rarity as string] || '#f39c12') : '#f39c12';
      ctx.shadowColor = rarityColor;
      ctx.shadowBlur = 15;
      ctx.fillStyle = rarityColor;
      ctx.beginPath(); ctx.arc(0, 0, lootRadius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
      const label = typeof loot.item === 'string' ? loot.item : (loot.item as any).name || '?';
      ctx.fillText(label.substring(0, 4).toUpperCase(), 0, 3);
      this.state.particles.push(...createLootBeam(loot.pos, rarityColor));
      ctx.restore();
    }

    ctx.fillStyle = '#6b4f3a';
    ctx.strokeStyle = '#4a3525';
    ctx.lineWidth = 3;
    for (const b of this.mapGen.buildings) {
      if (b.x + b.width < viewLeft || b.x > viewRight || b.y + b.height < viewTop || b.y > viewBottom) continue;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let wx = b.x; wx < b.x + b.width; wx += 50) { ctx.fillRect(wx, b.y, 2, b.height); }
      for (let wy = b.y; wy < b.y + b.height; wy += 50) { ctx.fillRect(b.x, wy, b.width, 2); }
      ctx.fillStyle = '#6b4f3a';
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.width / 2, b.y + b.height / 2);
      ctx.fillStyle = '#6b4f3a';
    }

    if (this.buildingSystem.isBuilding && this.buildingSystem.getGhostPos()) {
      const ghost = this.buildingSystem.getGhostPos()!;
      const canPlace = this.buildingSystem.canPlace(this.state);
      ctx.save();
      ctx.translate(ghost.x, ghost.y);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = canPlace ? 'rgba(52,152,219,0.6)' : 'rgba(231,76,60,0.6)';
      const mode = this.buildingSystem.getBuildMode();
      const r = CONFIG.BUILDING_GRID_SIZE / 2;
      if (mode === 'wall') ctx.fillRect(-r, -r, r * 2, r * 2);
      else if (mode === 'floor') ctx.fillRect(-r, -r, r * 2, r * 2);
      else if (mode === 'stair') { ctx.beginPath(); ctx.moveTo(-r, r); ctx.lineTo(r, r); ctx.lineTo(-r, -r); ctx.closePath(); ctx.fill(); }
      else if (mode === 'roof') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); }
      if (canPlace) { ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.strokeRect(-r, -r, r * 2, r * 2); ctx.setLineDash([]); }
      ctx.restore();
    }

    for (const b of this.state.buildings) {
      if (!b.alive) continue;
      if (b.pos.x < viewLeft || b.pos.x > viewRight || b.pos.y < viewTop || b.pos.y > viewBottom) continue;
      ctx.save();
      ctx.translate(b.pos.x, b.pos.y);
      const alpha = b.building ? 0.5 + b.buildProgress * 0.5 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.buildingSystem.getMaterialColor(b.material);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      if (b.type === 'wall') {
        ctx.fillRect(-b.radius, -b.radius, b.radius * 2, b.radius * 2);
        ctx.strokeRect(-b.radius, -b.radius, b.radius * 2, b.radius * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(-b.radius, -b.radius, b.radius * 2, b.radius);
      } else if (b.type === 'floor') {
        ctx.fillRect(-b.radius, -b.radius, b.radius * 2, b.radius * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(-b.radius + 3, -b.radius + 3, b.radius * 2 - 6, b.radius * 2 - 6);
      } else if (b.type === 'stair') {
        ctx.beginPath(); ctx.moveTo(-b.radius, b.radius); ctx.lineTo(b.radius, b.radius); ctx.lineTo(-b.radius, -b.radius); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (b.type === 'roof') {
        ctx.beginPath(); ctx.moveTo(0, -b.radius); ctx.lineTo(b.radius, 0); ctx.lineTo(0, b.radius); ctx.lineTo(-b.radius, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (b.health < b.maxHealth) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-15, -b.radius - 10, 30, 5);
        ctx.fillStyle = b.health > b.maxHealth * 0.5 ? '#2ecc71' : b.health > b.maxHealth * 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillRect(-14, -b.radius - 9, 28 * (b.health / b.maxHealth), 3);
      }
      ctx.restore();
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.state.mapSize, this.state.mapSize);

    ctx.fillStyle = 'rgba(138, 43, 226, 0.25)';
    ctx.beginPath();
    ctx.rect(-2000, -2000, CONFIG.MAP_SIZE + 4000, CONFIG.MAP_SIZE + 4000);
    ctx.arc(this.state.stormCenter.x, this.state.stormCenter.y, this.state.stormRadius, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.strokeStyle = 'rgba(138, 43, 226, 0.9)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#8a2be2';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(this.state.stormCenter.x, this.state.stormCenter.y, this.state.stormRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (this.state.stormTimer > 0) {
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.state.nextStormCenter.x, this.state.nextStormCenter.y, this.state.nextStormRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const p of this.state.particles) {
      if (!p.alive) continue;
      if (p.pos.x < viewLeft || p.pos.x > viewRight || p.pos.y < viewTop || p.pos.y > viewBottom) continue;
      ctx.globalAlpha = Math.max(0, 1 - (p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      const size = p.size * (1 - (p.life / p.maxLife) * 0.5);
      ctx.arc(p.pos.x, p.pos.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#f1c40f';
    for (const proj of this.state.projectiles) {
      if (!proj.alive) continue;
      if (proj.pos.x < viewLeft || proj.pos.x > viewRight || proj.pos.y < viewTop || proj.pos.y > viewBottom) continue;
      ctx.save();
      ctx.translate(proj.pos.x, proj.pos.y);
      ctx.rotate(proj.rotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, proj.radius * 2, proj.radius, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    if (!this.isMultiplayer) {
      for (const bot of this.state.bots) {
        if (!bot.alive) continue;
        if (bot.pos.x < viewLeft || bot.pos.x > viewRight || bot.pos.y < viewTop || bot.pos.y > viewBottom) continue;
        this.renderBot(ctx, bot);
      }
    }

    for (const [sessionId, rp] of this.remotePlayers) {
      if (sessionId === this.multiplayerSession?.room?.sessionId) continue;
      if (!rp.alive) continue;
      ctx.save();
      ctx.translate(rp.x, rp.y);
      ctx.rotate(rp.rotation || 0);
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath(); ctx.arc(0, 0, CONFIG.PLAYER_RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6c3483'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(CONFIG.PLAYER_RADIUS + 5, 0); ctx.lineTo(CONFIG.PLAYER_RADIUS - 5, -5); ctx.lineTo(CONFIG.PLAYER_RADIUS - 5, 5); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(rp.name || 'Player', rp.x, rp.y - CONFIG.PLAYER_RADIUS - 12);
    }

    this.mobilitySystem.render(ctx, this.state);
    this.itemSystem.render(ctx, this.state);
    this.bossSystem.render(ctx, this.state);
    this.vehicleSystem.render(ctx, this.camera);
    this.chestSystem.render(ctx, this.gameTime);
    this.npcSystem.render(ctx, this.gameTime);
    this.fishingSystem.render(ctx, this.gameTime);
    if (!this.npcSystem.isShopOpen()) {
      (this.npcSystem as any).renderInteractPrompt?.(ctx, this.state.player.pos, this.state.player.radius);
    }
    this.renderPlayer(ctx, this.state.player);
    if (this.emoteSystem.getState().active) {
      this.emoteSystem.renderPlayerEmote(ctx, this.state.player.pos.x, this.state.player.pos.y, this.state.player.radius, this.gameTime);
    }

    this.renderer.renderLights(ctx);

    ctx.restore();

    this.renderer.renderWeather(ctx, cam.pos.x, cam.pos.y, cam.width, cam.height);
    this.renderer.renderScreenEffects(ctx, this.state.player.health, CONFIG.PLAYER_MAX_HEALTH);
    this.renderer.renderFlashlight(ctx, this.state.player.pos.x, this.state.player.pos.y, this.state.player.rotation);
    this.renderer.applyPostProcessing(ctx);

    this.hud.renderCrosshair(ctx, this.camera.width / 2, this.camera.height / 2, this.currentWeaponSpread, this.crosshairOnTarget, this.state.player.inventory[this.state.player.selectedSlot]?.type === 'sniper');

    const nearbyLoot = this.state.lootItems.filter(l => l.alive && dist(this.state.player.pos, l.pos) < l.radius + this.state.player.radius + 25);
    this.hud.render(ctx, this.camera.width, this.camera.height, this.state.player, this.state, this.camera, this.buildingSystem.isBuilding ? this.buildingSystem.getBuildMode() : null, this.buildingSystem.getMaterial(), nearbyLoot);

    if (this.playerInVehicle) {
      const v = this.vehicleSystem.getVehicleForPlayer('player')!;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`[ ${v.type.toUpperCase()} ] Press B to exit`, this.camera.width / 2, 30);
    }

    if (this.busPhase !== 'playing') {
      ctx.restore();
      this.battleBusSystem.renderBus(ctx, this.busState, this.camera);
      this.battleBusSystem.renderDropUI(ctx, this.busState, this.camera.width, this.camera.height);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, this.camera.width, this.camera.height);
      ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center';
      if (this.busPhase === 'bus') {
        ctx.fillText('PRESS SPACE TO DEPLOY', this.camera.width / 2, this.camera.height / 2 - 50);
        ctx.fillStyle = '#aaa'; ctx.font = '18px monospace';
        ctx.fillText(`Bus Position: ${Math.round(this.busState.busX)}, ${Math.round(this.busState.busY)}`, this.camera.width / 2, this.camera.height / 2);
      }
      return;
    }

    if (this.showCountdown && this.countdownTimer > 0) {
      const num = Math.ceil(this.countdownTimer);
      ctx.fillStyle = '#f1c40f'; ctx.font = `bold ${80 + Math.sin(this.gameTime * 10) * 10}px monospace`; ctx.textAlign = 'center';
      ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 30;
      ctx.fillText(num > 0 ? String(num) : 'GO!', this.camera.width / 2, this.camera.height / 2);
      ctx.shadowBlur = 0;
    }

    if (this.emoteSystem.getState().showWheel) {
      this.emoteSystem.renderEmoteWheel(ctx, this.camera.width / 2, this.camera.height / 2, this.input.mousePos.x, this.input.mousePos.y);
    }

    if (this.npcSystem.isShopOpen()) {
      this.npcSystem.renderShop(ctx, this.camera.width, this.camera.height, this.state.player.materials);
    }

    if (this.state.matchPhase === 'ended' && this.state.player.alive) {
      const t = this.gameTime * 2;
      ctx.save();
      ctx.translate(this.camera.width / 2, this.camera.height / 2 - 40);
      ctx.scale(1 + Math.sin(t) * 0.05, 1 + Math.sin(t) * 0.05);
      ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center';
      ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 40;
      ctx.fillText('VICTORY ROYALE!', 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = '18px monospace';
      ctx.fillText(`Kills: ${this.matchStats.kills} | Damage: ${this.matchStats.damageDealt} | Placement: #1`, 0, 50);
      const ks = this.killStreakSystem.getStats();
      ctx.fillStyle = '#aaa'; ctx.font = '14px monospace';
      ctx.fillText(`Best Streak: ${ks.bestStreak} | Headshots: ${ks.headshots} | Accuracy: ${ks.shotsFired > 0 ? Math.round(ks.shotsHit / ks.shotsFired * 100) : 0}%`, 0, 80);
      ctx.fillText(`Chests: ${ks.chestsOpened} | Built: ${ks.buildingsBuilt} | Distance: ${Math.round(ks.distanceTraveled)}m`, 0, 100);
      ctx.restore();
    }

    if (this.showFps) {
      ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`FPS: ${this.currentFps}`, 10, this.camera.height - 10);
      ctx.fillText(`Particles: ${this.state.particles.length}`, 10, this.camera.height - 28);
      ctx.fillText(`Time: ${this.renderer.getTimeOfDay().toFixed(1)}h`, 10, this.camera.height - 46);
    }

    this.killStreakSystem.renderBanner(ctx, this.camera.width, this.camera.height);
    this.killStreakSystem.renderCombo(ctx, this.camera.width - 160, this.camera.height / 2);
    this.fishingSystem.renderFishingUI(ctx, this.camera.width, this.camera.height);

    const activeMode = this.gameModeSystem.getActiveMode();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${activeMode.icon} ${activeMode.name}`, this.camera.width / 2, 15);
    if (activeMode.teamMode) {
      ctx.fillStyle = this.gameModeSystem.getPlayerTeam() === 'blue' ? '#3498db' : '#e74c3c';
      ctx.fillText(`Team: ${this.gameModeSystem.getPlayerTeam().toUpperCase()} | Score: ${this.gameModeSystem.getTeamScore(this.gameModeSystem.getPlayerTeam())}`, this.camera.width / 2, 30);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px monospace';
    ctx.fillText('F3: Debug | B: Vehicle', 10, this.camera.height - 5);
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
    const { x, y } = player.pos;
    const r = player.radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.rotation);

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(2, 2, r + 2, r, 0, 0, Math.PI * 2); ctx.fill();

    const grad = ctx.createRadialGradient(-3, -3, 0, 0, 0, r);
    grad.addColorStop(0, '#6bb5ff');
    grad.addColorStop(1, '#2a7cc7');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#1a5a9c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();

    const weapon = player.inventory[player.selectedSlot];
    if (weapon && weapon.type !== 'pickaxe') {
      ctx.fillStyle = '#555';
      ctx.fillRect(r - 2, -2.5, 14, 5);
      ctx.fillStyle = '#888';
      ctx.fillRect(r + 8, -3.5, 4, 7);
    } else {
      ctx.fillStyle = '#aaa';
      ctx.fillRect(r - 2, -2, 10, 4);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(-4, -4, r * 0.5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  private renderBot(ctx: CanvasRenderingContext2D, bot: Player): void {
    ctx.save();
    ctx.translate(bot.pos.x, bot.pos.y);

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(2, 2, bot.radius + 2, bot.radius, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.rotate(bot.rotation);
    const grad = ctx.createRadialGradient(-2, -2, 0, 0, 0, bot.radius);
    grad.addColorStop(0, '#ff6b6b');
    grad.addColorStop(1, '#c0392b');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, bot.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8e2424'; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(bot.radius + 6, 0);
    ctx.lineTo(bot.radius - 4, -5);
    ctx.lineTo(bot.radius - 4, 5);
    ctx.fill();

    if (bot.inventory && bot.inventory[bot.selectedSlot]) {
      ctx.fillStyle = '#555';
      ctx.fillRect(bot.radius - 2, -2.5, 12, 5);
    }
    ctx.restore();

    const barW = 32;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-barW / 2, -bot.radius - 12, barW, 5);
    const healthPct = bot.health / CONFIG.PLAYER_MAX_HEALTH;
    ctx.fillStyle = healthPct > 0.5 ? '#2ecc71' : healthPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(-barW / 2, -bot.radius - 12, barW * healthPct, 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(-barW / 2, -bot.radius - 12, barW, 5);

    if (bot.shield > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-barW / 2, -bot.radius - 18, barW, 4);
      ctx.fillStyle = '#3498db'; ctx.fillRect(-barW / 2, -bot.radius - 18, barW * (bot.shield / CONFIG.PLAYER_MAX_SHIELD), 4);
    }

    ctx.restore();
  }

  private showKillCam() {
    const frames = this.replaySystem.getKillCamFrames(this.state.matchTime, 3);
    if (frames.length === 0) return;
    console.log('Kill cam frames:', frames.length);
  }

  private restart() {
    this.stop();
    this.input = new InputManager(this.canvas);
    this.state = this.createInitialState();
    const mapData = this.mapGen.generate();
    this.tiles = mapData.tiles;
    this.lootSystem.spawnFloorLoot(this.state);
    this.chestSystem = new LootChestSystem();
    this.chestSystem.spawnChests(this.mapGen.buildings);
    this.npcSystem = new NPCSystem();
    this.npcSystem.spawnNPCs(this.mapGen.buildings);
    this.mobilitySystem = new MobilitySystem();
    this.mobilitySystem.spawnMobilityFeatures(this.state);
    this.itemSystem = new ItemSystem();
    this.aiSystem = new AISystem(this.combatSystem);
    this.aiSystem.spawnBots(this.state, 50);
    this.stormSystem = new StormSystem();
    this.state.stormRadius = CONFIG.MAP_SIZE * 0.8;
    this.state.stormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormCenter = vec2(CONFIG.MAP_SIZE / 2, CONFIG.MAP_SIZE / 2);
    this.state.nextStormRadius = CONFIG.MAP_SIZE * 0.8;
    this.bossSystem = new BossSystem();
    this.aiDirector = new AIDirector();
    this.vehicleSystem = new VehicleSystem();
    this.vehicleSystem.spawnVehicles(CONFIG.MAP_SIZE);
    this.emoteSystem = new EmoteSystem();
    this.fishingSystem = new FishingSystem();
    this.fishingSystem.spawnFishingSpots(this.tiles.flat());
    this.fishingSystem.spawnForageBushes(this.tiles.flat());
    this.killStreakSystem = new KillStreakSystem();
    this.applyGameMode();
    this.lastTime = performance.now();
    this.matchStats = { kills: 0, damageDealt: 0, buildingsBuilt: 0 };
    this.matchStatsReported = false;
    this.spectatorSystem.stopSpectating();
    this.replaySystem.clear();
    this.gameTime = 0;
    this.hud = new HUDRenderer();
    this.initBusPhase();
    this.start();
  }

  stop(): void {
    this.running = false;
    this.input.destroy();
  }
}
