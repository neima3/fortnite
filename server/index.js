import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineRoom, defineServer } from 'colyseus';
import { BattleRoyaleRoom } from './rooms/BattleRoyaleRoom.js';
import { ROOM_NAMES } from '../shared/net/roomOptions.js';

export const ROOM_DEFINITIONS = Object.freeze({
  [ROOM_NAMES.SOLO]: defineRoom(BattleRoyaleRoom),
});

export function createGameServer() {
  return defineServer({
    rooms: ROOM_DEFINITIONS,
  });
}

export async function startServer({ port = Number(process.env.PORT || 2567) } = {}) {
  const server = createGameServer();
  await server.listen(port);
  console.log(`[StormSurge] multiplayer server listening on port ${port}`);
  return server;
}

const isMain = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
})();

if (isMain) {
  startServer().catch(error => {
    console.error('[StormSurge] multiplayer bootstrap failed');
    console.error(error);
    process.exitCode = 1;
  });
}
