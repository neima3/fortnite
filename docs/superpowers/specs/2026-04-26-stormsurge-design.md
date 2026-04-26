# StormSurge Battle Royale - Game Design Spec

## Overview
**StormSurge** is a browser-based 2D top-down battle royale game inspired by Fortnite. Players drop from a battle bus onto a procedurally generated island, loot weapons and materials, build structures for defense/positioning, and fight to be the last one standing as a deadly storm circle shrinks.

## Core Loop
1. **Bus Drop** - Players spawn on a flying bus and choose when to parachute down
2. **Looting** - Search chests, floor loot, and ammo boxes for weapons, healing, and materials
3. **Combat** - Engage enemies with a variety of weapons; build structures for cover and high ground
4. **Survive the Storm** - Stay inside the safe zone as the storm circle shrinks over time
5. **Victory Royale** - Be the last player (or team) alive

## Architecture
- **Frontend:** TypeScript + HTML5 Canvas 2D rendering
- **Build Tool:** Vite (fast dev server, HMR, simple TypeScript support)
- **Game Structure:** Entity-Component pattern with a centralized GameEngine
- **State Management:** Single GameState object updated each tick
- **Rendering:** Camera-relative 2D canvas rendering with z-index layering

## Tech Stack
- TypeScript (strict mode)
- Vite
- HTML5 Canvas 2D API
- Web Audio API for sound
- No external game engines (raw Canvas for maximum control)

## Game World

### Map
- Size: 4000x4000 pixels
- Procedural generation with Perlin-like noise for terrain
- Biomes: Grasslands, forests, water (lakes/rivers), urban areas (named POIs)
- 8-10 named Points of Interest (Tilted Towers, Pleasant Park, etc. style)
- Buildings with enterable rooms and loot spawns
- Terrain obstacles: trees, rocks, bushes (some destructible)

### Camera
- Top-down perspective, centered on player
- Smooth camera follow with slight lookahead in movement direction
- Zoom level: 1.0 default, adjustable in settings
- Minimap in corner showing full map, storm, and player positions

## Player

### Movement
- WASD or Arrow Keys for movement
- Mouse cursor for aiming direction
- Space to jump (visual only, no Z-axis in 2D)
- Shift to sprint (consumes no resource, just speed boost)
- Momentum-based movement with acceleration/deceleration

### Health System
- Health: 0-100
- Shield: 0-100 (absorbs damage first)
- Down-but-not-out: Not implemented (solo mode only for Phase 1-10)
- Damage numbers: Floating text showing damage dealt

### Combat
- Left Click: Fire weapon / swing pickaxe
- Right Click: ADS (Aim Down Sights) - reduces movement speed, increases accuracy
- 1-5: Weapon slots
- Pickaxe: Infinite use, harvests materials, deals 20 damage

## Weapons

### Rarities
Common (Gray) → Uncommon (Green) → Rare (Blue) → Epic (Purple) → Legendary (Gold)

### Weapon Types
| Weapon | Damage | Fire Rate | Magazine | Reload | Ammo Type |
|--------|--------|-----------|----------|--------|-----------|
| Pickaxe | 20 | 1.0s | ∞ | - | - |
| Pistol | 24-32 | 0.5s | 12 | 1.5s | Light |
| Assault Rifle | 30-38 | 0.15s | 30 | 2.2s | Medium |
| Shotgun | 80-100 | 1.2s | 5 | 4.5s | Shells |
| Sniper Rifle | 95-115 | 2.5s | 1 | 2.8s | Heavy |
| SMG | 17-21 | 0.08s | 30 | 2.0s | Light |
| Grenade | 100 | - | 6 | - | Explosive |
| Medkit | +100 HP | - | 1 | 10s | - |
| Shield Potion | +50 Shield | - | 1 | 5s | - |

### Shooting Mechanics
- Projectile-based (not hitscan) with travel time and bullet drop (minimal in 2D)
- Shotguns fire multiple pellets in a spread
- Sniper has scope overlay when ADS
- Recoil: visual bloom pattern

## Building System

### Controls
- Q: Wall, E: Floor, R: Stair, T: Roof, C: Trap
- Left Click: Place structure
- Right Click: Edit structure (remove sections)
- G: Repair, Scroll Wheel: Change material

### Materials
- Wood (max 999): Fastest build speed, lowest health
- Brick (max 999): Medium build speed and health
- Metal (max 999): Slowest build speed, highest health

### Structures
| Structure | Build Time | Initial Health | Max Health |
|-----------|-----------|----------------|------------|
| Wall | 0.1s | 90 | 200 (Wood) / 250 (Brick) / 300 (Metal) |
| Floor | 0.1s | 90 | 200 / 250 / 300 |
| Stair | 0.15s | 90 | 200 / 250 / 300 |
| Roof | 0.15s | 90 | 200 / 250 / 300 |

- Structures start at ~50% health and build up over time
- Enemies can shoot through partially built structures
- Building blocked in some areas (too close to terrain)

## Loot System

### Loot Sources
- Floor Loot: Weapons/items lying on ground
- Chests: Guaranteed weapon + ammo/consumables, require interact to open
- Ammo Boxes: Ammunition only
- Supply Drops: Random air drops with high-tier loot

### Inventory
- 5 weapon/item slots
- Materials tracked separately (wood/brick/metal)
- Ammo tracked by type (light, medium, shells, heavy, rockets)
- Drop item: drag out of inventory or press X on selected slot

## Storm System

### Mechanics
- Match starts with a large safe zone covering ~80% of the map
- Every ~60 seconds, storm shrinks to a new random circle within the current one
- Storm damage increases with each phase (1, 2, 5, 8, 10 DPS)
- Players in storm take continuous damage
- Visual: purple storm effect on screen edges when inside, purple area on map
- Storm eye movement time: 30-45 seconds between phases

## AI Bots (Phase 7)

### Behaviors
- Drop from bus at random locations
- Loot buildings they land near
- Patrol and search for players
- Build basic walls when shot at
- Engage in combat within effective weapon range
- Move with the storm
- Difficulty: Easy/Medium/Hard (accuracy, reaction time, building speed)

### Bot States
- Dropping, Looting, Patrolling, Attacking, Fleeing, Healing, MovingToZone

## UI/HUD

### In-Game HUD
- Health & Shield bars (bottom center)
- Material counts (bottom right)
- Weapon slots with ammo counts (bottom center)
- Minimap (top right)
- Kill feed (top right, below minimap)
- Storm timer and phase indicator (top center)
- Players remaining counter (top left)
- Crosshair (center)

### Menus
- Main Menu: Play, Settings, How to Play
- Settings: Audio, Graphics, Controls, Keybinds
- Victory/Defeat screen with stats
- Pause menu (Escape)

## Audio
- Weapon sounds (varied by type and rarity)
- Building sounds (placement, editing, breaking)
- Footsteps (varied by terrain)
- Storm ambient sound
- Chest opening sound
- UI sounds (hover, click, error)
- Background music (menu and lobby)

## Visual Effects
- Muzzle flashes
- Bullet tracers
- Damage numbers (floating text, color-coded by body/headshot)
- Building placement ghost (blue = valid, red = invalid)
- Destruction particles when structures break
- Hit markers (X when damaging enemy)
- Screen shake on damage and explosions
- Storm visual overlay

## Match Flow
1. **Pre-Game Lobby** (5s): Players spawn on Battle Bus
2. **Bus Flight** (15s): Bus flies across map, players can drop
3. **Parachute** (variable): Glide to chosen landing spot
4. **Early Game** (0-3 min): Looting phase, first storm circle revealed
5. **Mid Game** (3-8 min): Engagements, storm shrinks twice
6. **Late Game** (8-15 min): Small circles, intense build battles
7. **End Game** (15+ min): Final showdown, victory

## Development Phases
See implementation plan for detailed 10-phase breakdown.

## Performance Targets
- 60 FPS on modern browsers
- Support 100 entities (players + bots + projectiles + structures) simultaneously
- Efficient spatial hashing for collision detection
- Object pooling for bullets and particles
