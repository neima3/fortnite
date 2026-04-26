# StormSurge Implementation Plan - 10 Phases

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Build a complete 2D top-down battle royale web game inspired by Fortnite, playable in the browser against AI bots.

**Architecture:** Entity-Component game engine with GameEngine class, GameState object, modular systems (Input, Physics, Combat, Building, Storm, AI). HTML5 Canvas 2D.

**Tech Stack:** TypeScript, Vite, HTML5 Canvas 2D, Web Audio API.

---

## Phase 1: Project Setup & Core Engine
- Initialize Vite + TypeScript project
- Create core types, config, math utilities
- Implement InputManager (keyboard + mouse)
- Implement Camera (follow, viewport)
- Create GameEngine with game loop
- Player movement (WASD), aiming (mouse), sprint (Shift)
- Basic HUD (health bar, weapon info)
- Test in browser

## Phase 2: World Generation & Terrain
- Simple Perlin noise utility
- Procedural island map with biomes (water, beach, grass, forest, mountain)
- Obstacles (trees, rocks, bushes)
- Buildings/POIs placement
- Terrain rendering with viewport culling
- Obstacle collision
- Test in browser

## Phase 3: Weapons & Combat System
- Projectile system with physics
- CombatSystem with damage application
- Weapon firing (pistol, AR, shotgun, sniper, SMG, pickaxe)
- Ammo and reload
- Hit detection against players and buildings
- Test in browser

## Phase 4: Building System
- Grid-based building (wall, floor, stair, roof)
- Material system (wood, brick, metal)
- Building placement with ghost preview
- Build progress and health
- Building collision
- Test in browser

## Phase 5: Loot, Inventory & UI
- Loot spawning (weapons, materials, consumables)
- Pickup system (F key)
- Inventory management (5 slots)
- Improved HUD with weapon slots, materials, minimap
- Test in browser

## Phase 6: Storm Circle & Match Game Loop
- StormSystem with shrinking circles
- Storm damage
- Match phases and timers
- Win/loss conditions (Victory Royale / Eliminated)
- Restart functionality
- Test in browser

## Phase 7: AI Bot System
- Bot spawning (20 bots)
- AI states (patrol, attack, flee, move to zone)
- Bot combat with accuracy and weapon selection
- Bot storm avoidance
- Bot rendering with health bars
- Test in browser

## Phase 8: HUD, Menus & UX Polish
- Main menu screen
- Pause menu
- Minimap with player/bot/storm positions
- Enhanced HUD (shield bar, kill feed, storm info)
- Settings placeholder
- Test in browser

## Phase 9: Audio, Visual Effects & Feedback
- AudioManager with synthesized SFX
- Particle system (muzzle flash, explosions, hit markers)
- Screen shake
- Building sounds, hit sounds
- Storm warning audio
- Test in browser

## Phase 10: Performance Optimization, Bug Fixes & Final Testing
- Spatial hash for collision
- Viewport culling for all entities
- Object pooling for projectiles/particles
- Mobile touch controls
- Bug fixes (restart, key conflicts, rendering)
- Final browser testing with agent-browser
- Polish and commit
