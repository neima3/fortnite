# StormSurge Implementation Plan - Phases 11-20

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Add multiplayer (Colyseus-based), new gameplay features, progression, replay/spectator modes, advanced AI, and final deployment polish.

**Architecture:** Reuse the proven Colyseus multiplayer stack from the existing FPS game (`/Users/neima/Desktop/Apps/fps`). Client-server with authoritative server, schema-based state sync, room-based matchmaking.

**Tech Stack:** TypeScript, Vite, HTML5 Canvas 2D, Colyseus (server + client SDK + schema), Web Audio API.

**Multiplayer Credentials from FPS game:**
- Package: `colyseus` (server), `@colyseus/sdk` (client), `@colyseus/schema` (state)
- Server port: 2567 (default)
- Pattern: `Client` → `joinOrCreate(roomName, options)` → `Room` with `onStateChange`, `onMessage`, `send()`
- Session wrapper: `ColyseusSession` class with event emitters

---

## Phase 11: Multiplayer Foundation & Server Scaffold
- Install Colyseus dependencies (`colyseus`, `@colyseus/sdk`, `@colyseus/schema`)
- Create `server/` directory with Express + Colyseus server
- Create `BattleRoyaleRoom.ts` with basic room lifecycle
- Create shared `messageTypes.ts` (client commands, server events)
- Create shared `roomOptions.ts` (room config, normalization)
- Create `StormSurgeState.ts` schema (player positions, health, match phase)
- Test server starts on port 2567

## Phase 12: Multiplayer Client & Lobby UI
- Create `ColyseusSession.ts` (adapted from FPS game)
- Add lobby screen to MenuScreen (Create Room, Join Room, Room Code)
- Add player name input
- Connect client to server on Play
- Show player list in lobby
- Start match when host clicks Start
- Test: Two browser tabs can join same room

## Phase 13: Authoritative Server Game Loop
- Server-side game loop with delta time
- Server manages: storm, loot spawns, bot AI, building validation
- Client prediction for player movement
- Server reconciliation (correct client if drifted)
- Snapshot interpolation for remote players
- Test: Player movement syncs between clients

## Phase 14: Combat Sync & Hit Validation
- Server-authoritative shooting (client sends intent, server validates)
- Projectile simulation on server
- Hit registration server-side with latency compensation
- Sync building placement (server validates material cost + position)
- Sync loot pickups
- Test: Shooting and building sync correctly between players

## Phase 15: Vehicles & Mobility
- Glider/parachute deployment (drop from sky at match start)
- Launch pads (bounce player across map)
- Speed boost pads
- Ziplines between POIs
- Test in browser

## Phase 16: Advanced Weapons & Items
- Grenades (explosive area damage, destructible buildings)
- Traps (damage enemies who walk near)
- Bandages (heal over time)
- Shield potions (small/large)
- Supply drops (airdrops with legendary loot)
- Test in browser

## Phase 17: Progression, XP & Season Pass
- XP system (placement, kills, damage, building)
- Account levels with unlocks
- Daily/weekly challenges
- Season pass tiers (free + premium rewards)
- Cosmetic unlocks (skins, emotes, wraps)
- LocalStorage persistence for progression
- Test in browser

## Phase 18: Replay System & Spectator Mode
- Record match events to array
- Replay playback (rewind, fast-forward, pause)
- Spectator mode after death (follow remaining players)
- Kill cam (replay last 3 seconds before death)
- Test in browser

## Phase 19: Advanced AI & Boss Encounters
- Supply drop guardians (powerful bot guarding airdrops)
- Boss battle events (giant bot with special attacks)
- AI director (adjusts bot difficulty based on player performance)
- Bot squads (teams of 2-4 bots working together)
- Test in browser

## Phase 20: Final Polish, PWA & Deployment
- Service worker for offline play
- PWA manifest (icon, theme, standalone mode)
- Build optimization (tree shake, code split)
- Loading screen with progress bar
- Final bug fixes and balance pass
- Final browser testing with agent-browser
- Deployment-ready build
