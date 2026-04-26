export const SERVER_CONFIG = {
  MAP_SIZE: 4000,
  TILE_SIZE: 50,
  PLAYER_SPEED: 300,
  PLAYER_SPRINT_SPEED: 450,
  PLAYER_RADIUS: 20,
  PLAYER_MAX_HEALTH: 100,
  STORM_PHASES: [
    { time: 60, radius: 1600, damage: 1 },
    { time: 120, radius: 1000, damage: 2 },
    { time: 120, radius: 600, damage: 5 },
    { time: 120, radius: 300, damage: 8 },
    { time: 120, radius: 100, damage: 10 },
  ],
  TICK_RATE: 20,
};
