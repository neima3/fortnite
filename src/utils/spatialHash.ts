import { Vec2 } from '../types.js';

export class SpatialHash {
  private cells: Map<string, string[]> = new Map();
  private cellSize: number;

  constructor(cellSize: number = 100) { this.cellSize = cellSize; }
  clear() { this.cells.clear(); }

  insert(id: string, pos: Vec2, radius: number) {
    const keys = this.getKeysForCircle(pos, radius);
    for (const key of keys) {
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key)!.push(id);
    }
  }

  query(pos: Vec2, radius: number): string[] {
    const keys = this.getKeysForCircle(pos, radius);
    const results = new Set<string>();
    for (const key of keys) {
      const ids = this.cells.get(key);
      if (ids) ids.forEach(id => results.add(id));
    }
    return Array.from(results);
  }

  private getKeysForCircle(pos: Vec2, radius: number): string[] {
    const keys: string[] = [];
    const minX = Math.floor((pos.x - radius) / this.cellSize);
    const maxX = Math.floor((pos.x + radius) / this.cellSize);
    const minY = Math.floor((pos.y - radius) / this.cellSize);
    const maxY = Math.floor((pos.y + radius) / this.cellSize);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  }
}
