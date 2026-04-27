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

interface RoadSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class MapGenerator {
  private elevationNoise: PerlinNoise;
  private moistureNoise: PerlinNoise;
  private treeNoise: PerlinNoise;
  private detailNoise: PerlinNoise;
  private decorationNoise: PerlinNoise;
  tiles: Tile[][] = [];
  buildings: BuildingDef[] = [];
  seed: number;
  private roads: RoadSegment[] = [];
  private roadTiles: Set<string> = new Set();

  constructor(seed?: number) {
    this.seed = seed || Math.random();
    this.elevationNoise = new PerlinNoise(this.seed);
    this.moistureNoise = new PerlinNoise(this.seed + 1);
    this.treeNoise = new PerlinNoise(this.seed + 2);
    this.detailNoise = new PerlinNoise(this.seed + 3);
    this.decorationNoise = new PerlinNoise(this.seed + 4);
  }

  generate(): { tiles: Tile[][]; buildings: BuildingDef[] } {
    const size = CONFIG.MAP_SIZE / CONFIG.TILE_SIZE;
    this.tiles = [];
    this.buildings = [];
    this.roads = [];
    this.roadTiles = new Set();

    for (let tx = 0; tx < size; tx++) {
      this.tiles[tx] = [];
      for (let ty = 0; ty < size; ty++) {
        const nx = (tx / size) * 4;
        const ny = (ty / size) * 4;
        const distFromCenter = Math.sqrt((tx - size / 2) ** 2 + (ty - size / 2) ** 2) / (size / 2);

        let elevation = this.elevationNoise.fbm(nx, ny, 6);
        elevation = (elevation + 1) / 2;
        elevation -= distFromCenter * 0.4;
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
    this.generateRoads(size);
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

  private generateRoads(size: number) {
    for (let i = 0; i < this.buildings.length; i++) {
      for (let j = i + 1; j < this.buildings.length; j++) {
        const a = this.buildings[i];
        const b = this.buildings[j];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist < size * CONFIG.TILE_SIZE * 0.4) {
          this.roads.push({
            x0: a.x + a.width / 2,
            y0: a.y + a.height / 2,
            x1: b.x + b.width / 2,
            y1: b.y + b.height / 2,
          });
        }
      }
    }

    for (const road of this.roads) {
      const steps = Math.ceil(Math.hypot(road.x1 - road.x0, road.y1 - road.y0) / CONFIG.TILE_SIZE);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = road.x0 + (road.x1 - road.x0) * t;
        const py = road.y0 + (road.y1 - road.y0) * t;
        const tx = Math.floor(px / CONFIG.TILE_SIZE);
        const ty = Math.floor(py / CONFIG.TILE_SIZE);
        if (tx >= 0 && ty >= 0 && tx < size && ty < size) {
          const tile = this.tiles[tx][ty];
          if (tile.biome !== 'water' && !tile.building) {
            this.roadTiles.add(`${tx},${ty}`);
            tile.obstacle = 'none';
          }
        }
      }
    }
  }

  private hashTile(tx: number, ty: number): number {
    let h = tx * 374761393 + ty * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  private lerpColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, t: number): string {
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }

  private getBiomeBaseColor(biome: Biome, elevation: number, tx: number, ty: number): string {
    const detail = this.detailNoise.noise2D(tx * 0.8, ty * 0.8) * 0.5 + 0.5;
    switch (biome) {
      case 'water': {
        const depthT = Math.min(1, elevation / 0.25);
        return this.lerpColor(26, 82, 118, 93, 173, 226, depthT);
      }
      case 'beach': {
        return this.lerpColor(240, 217, 181, 232, 201, 155, detail);
      }
      case 'grass': {
        const greens = [
          [74, 140, 63],
          [88, 214, 141],
          [69, 179, 95],
        ];
        const idx = Math.floor(detail * greens.length) % greens.length;
        const c = greens[idx];
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      }
      case 'forest': {
        const forestColors = [
          [30, 122, 30],
          [45, 80, 22],
          [39, 174, 96],
        ];
        const idx = Math.floor(detail * forestColors.length) % forestColors.length;
        const c = forestColors[idx];
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      }
      case 'mountain': {
        const snowLine = 0.85;
        if (elevation > snowLine) {
          const snowT = (elevation - snowLine) / (1 - snowLine);
          return this.lerpColor(189, 195, 199, 245, 248, 250, snowT);
        }
        return this.lerpColor(127, 140, 141, 149, 165, 166, detail);
      }
      default:
        return '#58d68d';
    }
  }

  private drawWaterDetail(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number, time: number) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    const waveOffset = time * 0.002;
    for (let i = 0; i < 3; i++) {
      const yOff = py + s * (0.25 + i * 0.25);
      ctx.beginPath();
      ctx.moveTo(px, yOff + Math.sin(waveOffset + tx + i) * 2);
      ctx.bezierCurveTo(
        px + s * 0.33, yOff + Math.sin(waveOffset + tx + i + 1) * 3,
        px + s * 0.66, yOff + Math.sin(waveOffset + tx + i + 2) * 3,
        px + s, yOff + Math.sin(waveOffset + tx + i + 3) * 2,
      );
      ctx.stroke();
    }

    if (this.hashTile(tx, ty) > 0.9) {
      ctx.fillStyle = 'rgba(46,134,193,0.4)';
      const sx = px + this.hashTile(tx + 7, ty + 3) * s * 0.6 + s * 0.2;
      const sy = py + this.hashTile(tx + 2, ty + 9) * s * 0.6 + s * 0.2;
      ctx.fillRect(sx, sy, 2 + this.hashTile(tx, ty + 5) * 4, 2);
    }
  }

  private drawBeachDetail(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number) {
    ctx.fillStyle = 'rgba(210,180,140,0.5)';
    const count = 4 + Math.floor(this.hashTile(tx, ty) * 6);
    for (let i = 0; i < count; i++) {
      const dx = this.hashTile(tx + i * 3, ty + i * 7) * s;
      const dy = this.hashTile(tx + i * 11, ty + i * 5) * s;
      ctx.beginPath();
      ctx.arc(px + dx, py + dy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.hashTile(tx + 20, ty + 20) > 0.92) {
      ctx.strokeStyle = 'rgba(139,119,101,0.6)';
      ctx.lineWidth = 2;
      const dx = px + this.hashTile(tx + 30, ty) * s * 0.5 + s * 0.25;
      const dy = py + this.hashTile(tx, ty + 30) * s * 0.5 + s * 0.25;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx + 8, dy + 3);
      ctx.lineTo(dx + 12, dy - 2);
      ctx.stroke();
    }
  }

  private drawGrassDetail(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number) {
    const grassCount = 5 + Math.floor(this.hashTile(tx, ty) * 8);
    for (let i = 0; i < grassCount; i++) {
      const dx = this.hashTile(tx + i * 3, ty + i * 5) * s;
      const dy = this.hashTile(tx + i * 7, ty + i * 3) * s;
      const h = 3 + this.hashTile(tx + i, ty + i) * 5;
      const shade = Math.floor(50 + this.hashTile(tx + i * 2, ty + i * 2) * 60);
      ctx.strokeStyle = `rgb(${shade - 10},${shade + 60},${shade - 10})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + dx, py + dy);
      ctx.lineTo(px + dx - 1, py + dy - h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + dx + 2, py + dy);
      ctx.lineTo(px + dx + 3, py + dy - h * 0.8);
      ctx.stroke();
    }

    if (this.hashTile(tx + 50, ty + 50) > 0.88) {
      const fx = px + this.hashTile(tx + 60, ty) * s * 0.6 + s * 0.2;
      const fy = py + this.hashTile(tx, ty + 60) * s * 0.6 + s * 0.2;
      const flowerColors = ['#e74c3c', '#f39c12', '#9b59b6', '#e91e63', '#ff6b81'];
      ctx.fillStyle = flowerColors[Math.floor(this.hashTile(tx + 40, ty + 40) * flowerColors.length)];
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(fx, fy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawForestDetail(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number) {
    const underCount = 3 + Math.floor(this.hashTile(tx, ty) * 4);
    for (let i = 0; i < underCount; i++) {
      const dx = this.hashTile(tx + i * 5, ty + i * 3) * s * 0.8 + s * 0.1;
      const dy = this.hashTile(tx + i * 2, ty + i * 9) * s * 0.8 + s * 0.1;
      ctx.fillStyle = `rgba(20,${60 + Math.floor(this.hashTile(tx + i, ty) * 40)},15,0.6)`;
      ctx.beginPath();
      ctx.arc(px + dx, py + dy, 2 + this.hashTile(tx + i + 1, ty + i) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMountainDetail(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number, elevation: number) {
    const rockCount = 3 + Math.floor(this.hashTile(tx, ty) * 5);
    for (let i = 0; i < rockCount; i++) {
      const dx = this.hashTile(tx + i * 4, ty + i * 6) * s * 0.8 + s * 0.1;
      const dy = this.hashTile(tx + i * 8, ty + i * 2) * s * 0.8 + s * 0.1;
      const size = 1 + this.hashTile(tx + i, ty + i) * 2;
      ctx.fillStyle = `rgba(${100 + Math.floor(this.hashTile(tx + i * 3, ty) * 40)},${100 + Math.floor(this.hashTile(ty, tx + i * 3) * 40)},${105 + Math.floor(this.hashTile(tx + i, ty + i) * 30)},0.5)`;
      ctx.beginPath();
      ctx.moveTo(px + dx, py + dy - size);
      ctx.lineTo(px + dx + size, py + dy + size * 0.5);
      ctx.lineTo(px + dx - size, py + dy + size * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    if (elevation > 0.82) {
      const snowPatchCount = Math.floor((elevation - 0.82) / 0.05);
      for (let i = 0; i < snowPatchCount; i++) {
        const dx = this.hashTile(tx + i * 15, ty + i * 13) * s * 0.7 + s * 0.15;
        const dy = this.hashTile(tx + i * 9, ty + i * 17) * s * 0.7 + s * 0.15;
        ctx.fillStyle = 'rgba(240,248,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(px + dx, py + dy, 3 + this.hashTile(tx + i, ty) * 4, 2 + this.hashTile(ty + i, tx) * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number) {
    const cx = px + s / 2;
    const cy = py + s / 2;
    const variant = this.hashTile(tx + 100, ty + 100);
    const scale = 0.7 + variant * 0.3;

    ctx.fillStyle = '#5d4037';
    ctx.fillRect(cx - 2 * scale, cy + 2, 4 * scale, 10 * scale);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx + 3 * scale, cy + 12 * scale, 8 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (variant < 0.5) {
      const layers = 3;
      for (let l = layers - 1; l >= 0; l--) {
        const ly = cy - l * 6 * scale;
        const lw = (8 + l * 3) * scale;
        const lh = (8 + l * 1) * scale;
        const shade = Math.floor(30 + variant * 40 + l * 15);
        ctx.fillStyle = `rgb(${shade - 20},${shade + 40},${shade - 20})`;
        ctx.beginPath();
        ctx.moveTo(cx, ly - lh);
        ctx.lineTo(cx + lw, ly);
        ctx.lineTo(cx - lw, ly);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const radius = (10 + variant * 4) * scale;
      const shade = Math.floor(40 + variant * 50);
      ctx.fillStyle = `rgb(${shade - 20},${shade + 50},${shade - 15})`;
      ctx.beginPath();
      ctx.arc(cx, cy - 6 * scale, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${shade - 10},${shade + 65},${shade - 10})`;
      ctx.beginPath();
      ctx.arc(cx - radius * 0.25, cy - 8 * scale, radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRock(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number) {
    const cx = px + s / 2;
    const cy = py + s / 2;
    const variant = this.hashTile(tx + 200, ty + 200);
    const scale = 0.6 + variant * 0.4;

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 5 * scale, 12 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const points = 5 + Math.floor(variant * 3);
    const baseAngle = variant * Math.PI;
    ctx.fillStyle = `rgb(${110 + Math.floor(variant * 40)},${115 + Math.floor(variant * 35)},${120 + Math.floor(variant * 30)})`;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const angle = baseAngle + (i / points) * Math.PI * 2;
      const r = (8 + this.hashTile(tx + i, ty + i) * 5) * scale;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(cx - 3 * scale, cy - 3 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 4 * scale, cy - 1 * scale);
    ctx.lineTo(cx + 2 * scale, cy + 3 * scale);
    ctx.stroke();
  }

  private drawBush(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, tx: number, ty: number) {
    const cx = px + s / 2;
    const cy = py + s / 2;
    const variant = this.hashTile(tx + 300, ty + 300);
    const scale = 0.8 + variant * 0.2;

    const clusters = [
      { ox: -5, oy: -2, r: 7 },
      { ox: 4, oy: -3, r: 6 },
      { ox: 0, oy: 3, r: 8 },
      { ox: -3, oy: -5, r: 5 },
    ];

    for (const c of clusters) {
      const shade = Math.floor(35 + this.hashTile(tx + c.ox, ty + c.oy) * 40);
      ctx.fillStyle = `rgb(${shade},${shade + 80},${shade + 10})`;
      ctx.beginPath();
      ctx.arc(cx + c.ox * scale, cy + c.oy * scale, c.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 6 * scale, 10 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const berryCount = 2 + Math.floor(variant * 4);
    for (let i = 0; i < berryCount; i++) {
      const bx = cx + (this.hashTile(tx + i * 6, ty + i * 4) - 0.5) * 14 * scale;
      const by = cy + (this.hashTile(tx + i * 3, ty + i * 8) - 0.5) * 10 * scale;
      ctx.fillStyle = this.hashTile(tx + i, ty) > 0.5 ? '#c0392b' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRoad(ctx: CanvasRenderingContext2D, px: number, py: number, s: number) {
    ctx.fillStyle = '#a0855b';
    ctx.fillRect(px, py, s, s);

    ctx.fillStyle = 'rgba(160,133,91,0.7)';
    for (let i = 0; i < 3; i++) {
      const dx = (i * 17 + 5) % s;
      const dy = (i * 23 + 7) % s;
      ctx.beginPath();
      ctx.arc(px + dx, py + dy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(120,100,70,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, py + s / 2);
    ctx.lineTo(px + s, py + s / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  renderChunk(ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, tileSize: number, time: number): void {
    const s = tileSize;

    for (let tx = startX; tx < endX; tx++) {
      for (let ty = startY; ty < endY; ty++) {
        if (tx < 0 || ty < 0 || tx >= this.tiles.length || ty >= (this.tiles[0]?.length ?? 0)) continue;
        const tile = this.tiles[tx][ty];
        const px = tile.x;
        const py = tile.y;

        if (this.roadTiles.has(`${tx},${ty}`) && !tile.building) {
          this.drawRoad(ctx, px, py, s);
          continue;
        }

        ctx.fillStyle = this.getBiomeBaseColor(tile.biome, tile.elevation, tx, ty);
        ctx.fillRect(px, py, s, s);

        switch (tile.biome) {
          case 'water':
            this.drawWaterDetail(ctx, px, py, s, tx, ty, time);
            break;
          case 'beach':
            this.drawBeachDetail(ctx, px, py, s, tx, ty);
            break;
          case 'grass':
            this.drawGrassDetail(ctx, px, py, s, tx, ty);
            break;
          case 'forest':
            this.drawForestDetail(ctx, px, py, s, tx, ty);
            break;
          case 'mountain':
            this.drawMountainDetail(ctx, px, py, s, tx, ty, tile.elevation);
            break;
        }

        switch (tile.obstacle) {
          case 'tree':
            this.drawTree(ctx, px, py, s, tx, ty);
            break;
          case 'rock':
            this.drawRock(ctx, px, py, s, tx, ty);
            break;
          case 'bush':
            this.drawBush(ctx, px, py, s, tx, ty);
            break;
        }
      }
    }
  }
}
