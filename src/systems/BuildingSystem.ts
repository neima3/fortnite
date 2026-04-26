import { GameState, Building, Player, Vec2 } from '../types.js';
import { CONFIG } from '../config.js';
import { vec2, dist } from '../utils/math.js';

export class BuildingSystem {
  private buildingMode: 'wall' | 'floor' | 'stair' | 'roof' | null = null;
  private selectedMaterial: 'wood' | 'brick' | 'metal' = 'wood';
  private ghostPos: Vec2 | null = null;

  get isBuilding(): boolean { return this.buildingMode !== null; }
  setBuildMode(mode: 'wall' | 'floor' | 'stair' | 'roof' | null) { this.buildingMode = mode; }

  toggleMaterial() {
    const mats: ('wood' | 'brick' | 'metal')[] = ['wood', 'brick', 'metal'];
    const idx = mats.indexOf(this.selectedMaterial);
    this.selectedMaterial = mats[(idx + 1) % mats.length];
  }

  getMaterialColor(mat: string): string {
    switch (mat) { case 'wood': return '#d4a373'; case 'brick': return '#c0392b'; case 'metal': return '#7f8c8d'; default: return '#d4a373'; }
  }

  updateGhost(playerPos: Vec2, mouseWorldPos: Vec2) {
    if (!this.buildingMode) { this.ghostPos = null; return; }
    const grid = CONFIG.BUILDING_GRID_SIZE;
    const gx = Math.floor(mouseWorldPos.x / grid) * grid + grid / 2;
    const gy = Math.floor(mouseWorldPos.y / grid) * grid + grid / 2;
    if (dist(playerPos, vec2(gx, gy)) > 300) { this.ghostPos = null; return; }
    this.ghostPos = vec2(gx, gy);
  }

  canPlace(state: GameState): boolean {
    if (!this.ghostPos || !this.buildingMode) return false;
    const mat = this.selectedMaterial;
    if (state.player.materials[mat] < 10) return false;
    for (const b of state.buildings) {
      if (b.alive && dist(b.pos, this.ghostPos) < 5) return false;
    }
    return true;
  }

  placeBuilding(state: GameState): Building | null {
    if (!this.canPlace(state)) return null;
    const matConfig = CONFIG.MATERIALS[this.selectedMaterial];
    const building: Building = {
      id: `bld_${Date.now()}_${Math.random()}`,
      pos: vec2(this.ghostPos!.x, this.ghostPos!.y),
      vel: vec2(0, 0), radius: CONFIG.BUILDING_GRID_SIZE / 2, rotation: 0, alive: true,
      type: this.buildingMode!, material: this.selectedMaterial,
      health: 50, maxHealth: matConfig.maxHealth, building: true,
      buildProgress: 0, buildTime: matConfig.buildTime, builtAt: performance.now() / 1000,
    };
    state.player.materials[this.selectedMaterial] -= 10;
    state.buildings.push(building);
    return building;
  }

  updateBuildings(state: GameState, dt: number) {
    const now = performance.now() / 1000;
    for (const b of state.buildings) {
      if (!b.alive) continue;
      if (b.building) {
        const elapsed = now - b.builtAt;
        b.buildProgress = Math.min(1, elapsed / b.buildTime);
        b.health = 50 + (b.maxHealth - 50) * b.buildProgress;
        if (b.buildProgress >= 1) { b.building = false; b.health = b.maxHealth; }
      }
    }
  }

  getGhostPos(): Vec2 | null { return this.ghostPos; }
  getBuildMode(): string | null { return this.buildingMode; }
  getMaterial(): string { return this.selectedMaterial; }
}
