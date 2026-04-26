import { PerlinNoise } from '../utils/perlin.js';
import { CONFIG } from '../config.js';

export type Biome = 'water' | 'beach' | 'grass' | 'forest' | 'mountain';

export interface Tile {
  x: number;
  y: number;
  biome: Biome;
  elevation: number;
  moisture: number;
  obstacle: 'none' | 'tree' | 'rock' | 'bush';
  building: boolean;
}

export interface BuildingDef {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export class MapGenerator {
  private elevationNoise: PerlinNoise;
  private moistureNoise: PerlinNoise;
  private treeNoise: PerlinNoise;
  tiles: Tile[][] = [];
  buildings: BuildingDef[] = [];
  seed: number;

  constructor(seed?: number) {
    this.seed = seed || Math.random();
    this.elevationNoise = new PerlinNoise(this.seed);
    this.moistureNoise = new PerlinNoise(this.seed + 1);
    this.treeNoise = new PerlinNoise(this.seed + 2);
  }

  generate(): { tiles: Tile[][]; buildings: BuildingDef[] } {
    const size = CONFIG.MAP_SIZE / CONFIG.TILE_SIZE; // 80 tiles
    this.tiles = [];
    this.buildings = [];

    for (let tx = 0; tx < size; tx++) {
      this.tiles[tx] = [];
      for (let ty = 0; ty < size; ty++) {
        const nx = (tx / size) * 4;
        const ny = (ty / size) * 4;
        const distFromCenter = Math.sqrt((tx - size / 2) ** 2 + (ty - size / 2) ** 2) / (size / 2);

        let elevation = this.elevationNoise.fbm(nx, ny, 6);
        elevation = (elevation + 1) / 2;
        elevation -= distFromCenter * 0.4; // Island shape
        elevation = Math.max(0, Math.min(1, elevation));

        const moisture = (this.moistureNoise.fbm(nx * 1.5, ny * 1.5, 4) + 1) / 2;

        let biome: Biome;
        if (elevation < 0.25) biome = 'water';
        else if (elevation < 0.32) biome = 'beach';
        else if (elevation > 0.75) biome = 'mountain';
        else if (moisture > 0.55) biome = 'forest';
        else biome = 'grass';

        let obstacle: Tile['obstacle'] = 'none';
        if (biome === 'forest' && this.treeNoise.noise2D(tx * 0.3, ty * 0.3) > 0.2) obstacle = 'tree';
        else if (biome === 'mountain' && Math.random() > 0.6) obstacle = 'rock';
        else if (biome === 'grass' && Math.random() > 0.92) obstacle = 'bush';

        this.tiles[tx][ty] = {
          x: tx * CONFIG.TILE_SIZE,
          y: ty * CONFIG.TILE_SIZE,
          biome,
          elevation,
          moisture,
          obstacle,
          building: false,
        };
      }
    }

    this.placeBuildings(size);
    return { tiles: this.tiles, buildings: this.buildings };
  }

  private placeBuildings(size: number) {
    const poiNames = ['Tilted Towers', 'Pleasant Park', 'Retail Row', 'Greasy Grove', 'Fatal Fields', 'Dusty Depot', 'Salty Springs', 'Tomato Town'];
    for (let i = 0; i < 8; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const tx = Math.floor(Math.random() * (size - 20)) + 10;
        const ty = Math.floor(Math.random() * (size - 20)) + 10;
        if (this.isValidBuildingArea(tx, ty, 6, 6)) {
          const w = 4 + Math.floor(Math.random() * 4);
          const h = 4 + Math.floor(Math.random() * 4);
          if (this.isValidBuildingArea(tx, ty, w, h)) {
            this.buildings.push({
              x: tx * CONFIG.TILE_SIZE,
              y: ty * CONFIG.TILE_SIZE,
              width: w * CONFIG.TILE_SIZE,
              height: h * CONFIG.TILE_SIZE,
              name: poiNames[i],
            });
            this.markBuildingArea(tx, ty, w, h);
            break;
          }
        }
        attempts++;
      }
    }
  }

  private isValidBuildingArea(tx: number, ty: number, w: number, h: number): boolean {
    for (let x = tx - 1; x <= tx + w; x++) {
      for (let y = ty - 1; y <= ty + h; y++) {
        if (x < 0 || y < 0 || x >= this.tiles.length || y >= this.tiles[0].length) return false;
        const tile = this.tiles[x][y];
        if (tile.biome === 'water' || tile.building || tile.obstacle !== 'none') return false;
      }
    }
    return true;
  }

  private markBuildingArea(tx: number, ty: number, w: number, h: number) {
    for (let x = tx; x < tx + w; x++) {
      for (let y = ty; y < ty + h; y++) {
        this.tiles[x][y].building = true;
        this.tiles[x][y].obstacle = 'none';
      }
    }
  }
}
