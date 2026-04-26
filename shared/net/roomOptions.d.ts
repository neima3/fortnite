export const ROOM_MODES: Record<string, string>;
export const ROOM_NAMES: Record<string, string>;
export const DEFAULT_MAX_CLIENTS: number;
export const MAX_ROOM_CODE_LENGTH: number;
export const MIN_ROOM_CODE_LENGTH: number;
export const MAX_PLAYER_NAME_LENGTH: number;
export function normalizeRoomCode(value: string, fallback?: string): string;
export function normalizeCreateRoomOptions(input?: any): any;
export function normalizeJoinRoomOptions(input?: any): any;
