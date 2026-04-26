export const CLIENT_COMMANDS = Object.freeze({
  MOVE: 'move',
  AIM: 'aim',
  FIRE: 'fire',
  BUILD: 'build',
  RELOAD: 'reload',
  PICKUP: 'pickup',
  WEAPON_SWITCH: 'weapon_switch',
  READY: 'ready',
  PING: 'ping',
});

export const SERVER_EVENTS = Object.freeze({
  STATE_SYNC: 'state_sync',
  MATCH_START: 'match_start',
  MATCH_END: 'match_end',
  ROOM_READY: 'room_ready',
  ROOM_UPDATED: 'room_updated',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  ERROR: 'error',
});
