import { Schema, MapSchema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  constructor() {
    super();
    this.sessionId = '';
    this.name = 'PLAYER';
    this.connected = false;
    this.ready = false;
    this.x = 2000;
    this.y = 2000;
    this.rotation = 0;
    this.health = 100;
    this.shield = 0;
    this.alive = true;
    this.kills = 0;
    this.materials = { wood: 0, brick: 0, metal: 0 };
    this.selectedSlot = 0;
  }
}

type('string')(PlayerState.prototype, 'sessionId');
type('string')(PlayerState.prototype, 'name');
type('boolean')(PlayerState.prototype, 'connected');
type('boolean')(PlayerState.prototype, 'ready');
type('number')(PlayerState.prototype, 'x');
type('number')(PlayerState.prototype, 'y');
type('number')(PlayerState.prototype, 'rotation');
type('number')(PlayerState.prototype, 'health');
type('number')(PlayerState.prototype, 'shield');
type('boolean')(PlayerState.prototype, 'alive');
type('number')(PlayerState.prototype, 'kills');
type('number')(PlayerState.prototype, 'selectedSlot');

export class StormSurgeState extends Schema {
  constructor() {
    super();
    this.roomId = '';
    this.mode = 'solo';
    this.seed = 0;
    this.phase = 'lobby';
    this.maxClients = 100;
    this.stormRadius = 3200;
    this.stormCenterX = 2000;
    this.stormCenterY = 2000;
    this.playersAlive = 0;
    this.matchTime = 0;
    this.stormTimer = 0;
    this.stormPhase = 0;
    this.stormDamage = 1;
    this.nextStormRadius = 3200;
    this.nextStormCenterX = 2000;
    this.nextStormCenterY = 2000;
    this.players = new MapSchema();
  }
}

type('string')(StormSurgeState.prototype, 'roomId');
type('string')(StormSurgeState.prototype, 'mode');
type('number')(StormSurgeState.prototype, 'seed');
type('string')(StormSurgeState.prototype, 'phase');
type('number')(StormSurgeState.prototype, 'maxClients');
type('number')(StormSurgeState.prototype, 'stormRadius');
type('number')(StormSurgeState.prototype, 'stormCenterX');
type('number')(StormSurgeState.prototype, 'stormCenterY');
type('number')(StormSurgeState.prototype, 'playersAlive');
type('number')(StormSurgeState.prototype, 'matchTime');
type('number')(StormSurgeState.prototype, 'stormTimer');
type('number')(StormSurgeState.prototype, 'stormPhase');
type('number')(StormSurgeState.prototype, 'stormDamage');
type('number')(StormSurgeState.prototype, 'nextStormRadius');
type('number')(StormSurgeState.prototype, 'nextStormCenterX');
type('number')(StormSurgeState.prototype, 'nextStormCenterY');
type({ map: PlayerState })(StormSurgeState.prototype, 'players');
