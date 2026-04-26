export class ServerBuildingSystem {
  constructor() {
    this.buildings = [];
  }

  validatePlacement(player, data) {
    if (!player || !player.alive) return false;
    const grid = 50;
    const gx = Math.floor(data.x / grid) * grid + grid / 2;
    const gy = Math.floor(data.y / grid) * grid + grid / 2;
    const dx = gx - player.x;
    const dy = gy - player.y;
    if (Math.sqrt(dx * dx + dy * dy) > 300) return false;
    for (const b of this.buildings) {
      if (Math.abs(b.x - gx) < 5 && Math.abs(b.y - gy) < 5) return false;
    }
    return { x: gx, y: gy };
  }

  placeBuilding(data) {
    const b = {
      id: `bld_${Date.now()}_${Math.random()}`,
      x: data.x,
      y: data.y,
      type: data.type || 'wall',
      material: data.material || 'wood',
      health: 200,
      maxHealth: 200,
      ownerId: data.ownerId,
    };
    this.buildings.push(b);
    return b;
  }
}
