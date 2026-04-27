export interface Vec2 { x: number; y: number; }

export interface Entity {
  id: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  rotation: number;
  alive: boolean;
}

export interface Player extends Entity {
  health: number;
  shield: number;
  speed: number;
  sprinting: boolean;
  materials: { wood: number; brick: number; metal: number };
  inventory: (Weapon | null)[];
  selectedSlot: number;
  aiming: boolean;
  isBoss?: boolean;
}

export interface Weapon {
  name: string;
  type: string;
  rarity: string;
  damage: number;
  fireRate: number;
  magazine: number;
  ammo: number;
  maxAmmo: number;
  reloadTime: number;
  ammoType: string;
  lastFireTime: number;
  spread: number;
  projectileSpeed: number;
}

export interface Projectile extends Entity {
  ownerId: string;
  damage: number;
  lifeTime: number;
  maxLifeTime: number;
  type: string;
}

export interface Building extends Entity {
  type: 'wall' | 'floor' | 'stair' | 'roof';
  material: 'wood' | 'brick' | 'metal';
  health: number;
  maxHealth: number;
  building: boolean;
  buildProgress: number;
  buildTime: number;
  builtAt: number;
}

export interface LootItem extends Entity {
  item: Weapon | string;
  quantity: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Grenade {
  id: string;
  pos: Vec2;
  vel: Vec2;
  ownerId: string;
  lifeTime: number;
  maxLifeTime: number;
  damage: number;
  explosionRadius: number;
  alive: boolean;
}

export interface Trap {
  id: string;
  pos: Vec2;
  ownerId: string;
  damage: number;
  radius: number;
  triggered: boolean;
  alive: boolean;
}

export interface SupplyDrop {
  id: string;
  pos: Vec2;
  landed: boolean;
  fallSpeed: number;
  height: number;
  items: any[];
  alive: boolean;
}

export interface Glider {
  active: boolean;
  height: number;
  targetX: number;
  targetY: number;
  speed: number;
}

export interface LaunchPad {
  id: string;
  pos: Vec2;
  radius: number;
  active: boolean;
}

export interface SpeedBoost {
  id: string;
  pos: Vec2;
  radius: number;
  active: boolean;
  multiplier: number;
  duration: number;
}

export interface Zipline {
  id: string;
  start: Vec2;
  end: Vec2;
  active: boolean;
}

export interface LootChest {
  id: string;
  pos: Vec2;
  state: 'closed' | 'opening' | 'opened';
  openTimer: number;
  items: any[];
}

export interface NPCVendor {
  id: string;
  pos: Vec2;
  type: 'weaponsmith' | 'healer' | 'blacksmith';
  name: string;
  items: any[];
}

export interface GameState {
  player: Player;
  bots: Player[];
  projectiles: any[];
  buildings: any[];
  lootItems: LootItem[];
  particles: Particle[];
  camera: Vec2;
  mapSize: number;
  stormCenter: Vec2;
  stormRadius: number;
  nextStormCenter: Vec2;
  nextStormRadius: number;
  stormPhase: number;
  stormTimer: number;
  stormDamage: number;
  matchTime: number;
  matchPhase: 'lobby' | 'bus' | 'drop' | 'playing' | 'ended';
  playersAlive: number;
  killFeed: string[];
  grenades: Grenade[];
  traps: Trap[];
  supplyDrops: SupplyDrop[];
  chests: LootChest[];
  npcs: NPCVendor[];
}
