import { Client } from '@colyseus/sdk';
import { SERVER_EVENTS } from '../../../shared/net/messageTypes.js';
import { ROOM_NAMES, ROOM_MODES, normalizeRoomCode, normalizeJoinRoomOptions } from '../../../shared/net/roomOptions.js';

export function getDefaultEndpoint(locationLike = globalThis.location) {
  const protocol = locationLike?.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = locationLike?.host?.replace(/:\d+$/, '') || 'localhost';
  return `${protocol}//${host}:2567`;
}

export class ColyseusSession {
  endpoint: string;
  client: Client | null = null;
  room: any = null;
  mode: string = ROOM_MODES.SOLO;
  roomCode: string = '';
  lastError: string = '';
  private _listeners: Map<string, Set<(payload: any) => void>> = new Map();

  constructor({ endpoint = getDefaultEndpoint() } = {}) {
    this.endpoint = endpoint;
  }

  on(eventName: string, handler: (payload: any) => void) {
    if (!this._listeners.has(eventName)) this._listeners.set(eventName, new Set());
    this._listeners.get(eventName)!.add(handler);
    return () => this._listeners.get(eventName)?.delete(handler);
  }

  emit(eventName: string, payload?: any) {
    const listeners = this._listeners.get(eventName);
    if (!listeners) return;
    for (const listener of listeners) listener(payload);
  }

  snapshot() {
    const room = this.room;
    const state = room?.state;
    const players: any[] = [];
    if (state?.players?.forEach) {
      state.players.forEach((p: any) => {
        players.push({ sessionId: p.sessionId, name: p.name, ready: p.ready, alive: p.alive, x: p.x, y: p.y, rotation: p.rotation, health: p.health });
      });
    }
    return {
      connected: !!room,
      roomId: room?.roomId || '',
      mode: this.mode,
      phase: state?.phase || 'lobby',
      playerCount: players.length,
      localSessionId: room?.sessionId || '',
      players,
      remotePlayers: players.filter((p: any) => p.sessionId !== room?.sessionId),
      roomCode: this.roomCode,
      lastError: this.lastError,
    };
  }

  async connect({ mode = ROOM_MODES.SOLO, roomCode = '', playerName = 'PLAYER' } = {}) {
    this.lastError = '';
    await this.disconnect({ reason: 'reconnect' });
    this.mode = mode === ROOM_MODES.DUO ? ROOM_MODES.DUO : mode === ROOM_MODES.SQUAD ? ROOM_MODES.SQUAD : ROOM_MODES.SOLO;
    this.roomCode = normalizeRoomCode(roomCode, '');
    this.client = new Client(this.endpoint);

    try {
      const roomName = ROOM_NAMES.SOLO;
      this.room = await this.client.joinOrCreate(roomName, {
        mode: this.mode,
        playerName: normalizeJoinRoomOptions({ playerName }).playerName,
        roomCode: this.roomCode,
      });
      this._wireRoom();
      this.emit('connected', this.snapshot());
      return this.snapshot();
    } catch (error: any) {
      this.lastError = error?.message || 'Failed to connect';
      this.emit('error', { message: this.lastError });
      throw error;
    }
  }

  _wireRoom() {
    if (!this.room) return;
    this.room.onStateChange?.(() => {
      this.emit('state', this.snapshot());
    });
    this.room.onError?.((code: any, message: string) => {
      this.lastError = message || `Room error ${code}`;
      this.emit('error', { code, message: this.lastError });
    });
    this.room.onLeave?.(() => {
      this.emit('left', this.snapshot());
      this.room = null;
    });
    this.room.onMessage?.(SERVER_EVENTS.PLAYER_JOINED, (payload: any) => {
      this.emit('player_joined', payload);
      this.emit('state', this.snapshot());
    });
    this.room.onMessage?.(SERVER_EVENTS.PLAYER_LEFT, (payload: any) => {
      this.emit('player_left', payload);
      this.emit('state', this.snapshot());
    });
    this.room.onMessage?.(SERVER_EVENTS.ROOM_UPDATED, (payload: any) => {
      this.emit('room_updated', payload);
      this.emit('state', this.snapshot());
    });
    this.room.onMessage?.(SERVER_EVENTS.MATCH_START, (payload: any) => {
      this.emit('match_start', payload);
    });
    this.room.onMessage?.('fire', (payload: any) => {
      this.emit('remote_fire', payload);
    });
    this.room.onMessage?.('build', (payload: any) => {
      this.emit('remote_build', payload);
    });
    this.room.onMessage?.('hit_confirmed', (payload: any) => {
      this.emit('hit_confirmed', payload);
    });
    this.room.onMessage?.('elimination', (payload: any) => {
      this.emit('elimination', payload);
    });
    this.room.onMessage?.('build_confirmed', (payload: any) => {
      this.emit('build_confirmed', payload);
    });
    this.room.onMessage?.('pong', (payload: any) => {
      this.emit('pong', payload);
    });
  }

  send(type: string, payload: any = {}) {
    if (!this.room) return false;
    this.room.send(type, payload);
    return true;
  }

  async disconnect({ reason = 'manual' } = {}) {
    if (!this.room) return;
    try { await this.room.leave(true); } catch {}
    this.room = null;
    this.emit('disconnected', { reason });
  }
}
