export const ROOM_MODES = Object.freeze({
  SOLO: 'solo',
  DUO: 'duo',
  SQUAD: 'squad',
});

export const ROOM_NAMES = Object.freeze({
  SOLO: 'stormsurge_solo',
  DUO: 'stormsurge_duo',
  SQUAD: 'stormsurge_squad',
});

export const DEFAULT_MAX_CLIENTS = 100;
export const MAX_ROOM_CODE_LENGTH = 8;
export const MIN_ROOM_CODE_LENGTH = 4;
export const MAX_PLAYER_NAME_LENGTH = 24;

const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;
const PLAYER_NAME_RE = /^[\w .'\-]+$/u;

function normalizeText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function normalizeRoomCode(value, fallback = '') {
  const code = normalizeText(value, fallback, MAX_ROOM_CODE_LENGTH).toUpperCase();
  return ROOM_CODE_RE.test(code) ? code : fallback;
}

export function normalizeCreateRoomOptions(input = {}) {
  const mode = input.mode === ROOM_MODES.DUO ? ROOM_MODES.DUO : input.mode === ROOM_MODES.SQUAD ? ROOM_MODES.SQUAD : ROOM_MODES.SOLO;
  const maxClients = input.maxClients || DEFAULT_MAX_CLIENTS;
  const privateCode = normalizeRoomCode(input.privateCode, '');
  const seed = Number(input.seed) || 0;
  return { mode, maxClients, privateCode, seed };
}

export function normalizeJoinRoomOptions(input = {}) {
  const playerName = normalizeText(input.playerName, 'PLAYER', MAX_PLAYER_NAME_LENGTH);
  const ready = input.ready === true;
  return { playerName: PLAYER_NAME_RE.test(playerName) ? playerName : 'PLAYER', ready };
}
