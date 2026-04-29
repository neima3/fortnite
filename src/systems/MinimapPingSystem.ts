import { dist } from '../utils/math.js';

export interface Ping {
  id: number;
  pos: { x: number; y: number };
  type: 'default' | 'danger' | 'loot' | 'go';
  time: number;
  maxTime: number;
}

const PING_COLORS: Record<string, string> = {
  default: '#ffffff',
  danger: '#ff4444',
  loot: '#44ff44',
  go: '#4488ff',
};

const PING_LABELS: Record<string, string> = {
  default: 'PINGED',
  danger: 'DANGER',
  loot: 'LOOT',
  go: 'GO',
};

const PING_ICONS: Record<string, string> = {
  default: '!',
  danger: '⚠',
  loot: '★',
  go: '→',
};

export class MinimapPingSystem {
  private pings: Ping[] = [];
  private pingIdCounter: number = 0;

  constructor() {}

  addPing(worldPos: { x: number; y: number }, type: string = 'default'): void {
    const validType = (['default', 'danger', 'loot', 'go'].includes(type)
      ? type
      : 'default') as Ping['type'];

    const ping: Ping = {
      id: this.pingIdCounter++,
      pos: { x: worldPos.x, y: worldPos.y },
      type: validType,
      time: 0,
      maxTime: 5000,
    };

    this.pings.push(ping);

    if (this.pings.length > 3) {
      this.pings.shift();
    }
  }

  update(dt: number): void {
    for (let i = this.pings.length - 1; i >= 0; i--) {
      this.pings[i].time += dt;
      if (this.pings[i].time >= this.pings[i].maxTime) {
        this.pings.splice(i, 1);
      }
    }
  }

  renderWorld(ctx: CanvasRenderingContext2D, time: number): void {
    for (const ping of this.pings) {
      this.renderPing(ctx, ping, 1.0);
    }
  }

  renderMinimap(
    ctx: CanvasRenderingContext2D,
    minimapX: number,
    minimapY: number,
    minimapSize: number,
    mapSize: number
  ): void {
    const scale = minimapSize / mapSize;

    for (const ping of this.pings) {
      const mx = minimapX + ping.pos.x * scale;
      const my = minimapY + ping.pos.y * scale;

      if (
        mx < minimapX - 10 ||
        mx > minimapX + minimapSize + 10 ||
        my < minimapY - 10 ||
        my > minimapY + minimapSize + 10
      ) {
        continue;
      }

      this.renderPingAt(ctx, ping, mx, my, 0.4);
    }
  }

  renderDangerIndicators(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    playerPos: { x: number; y: number },
    enemies: Array<{ x: number; y: number; alive: boolean }>
  ): void {
    const NEAR_RANGE = 800;
    const CLOSE_RANGE = 300;
    const INDICATOR_SIZE = 16;
    const EDGE_MARGIN = 40;
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      const d = dist(playerPos, enemy);
      if (d > NEAR_RANGE || d < 1) continue;

      const angle = Math.atan2(enemy.y - playerPos.y, enemy.x - playerPos.x);
      const closeness = 1 - d / NEAR_RANGE;
      const isClose = d <= CLOSE_RANGE;
      const pulse = isClose ? 0.5 + 0.5 * Math.sin(performance.now() * 0.008) : 1;
      const alpha = Math.min(1, closeness * 1.5) * pulse;

      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);

      let edgeX: number;
      let edgeY: number;

      const tRight = (canvasWidth - EDGE_MARGIN - cx) / (dirX || 0.001);
      const tLeft = (EDGE_MARGIN - cx) / (dirX || 0.001);
      const tBottom = (canvasHeight - EDGE_MARGIN - cy) / (dirY || 0.001);
      const tTop = (EDGE_MARGIN - cy) / (dirY || 0.001);

      let tMin = Infinity;
      if (dirX > 0 && tRight > 0) tMin = Math.min(tMin, tRight);
      if (dirX < 0 && tLeft > 0) tMin = Math.min(tMin, tLeft);
      if (dirY > 0 && tBottom > 0) tMin = Math.min(tMin, tBottom);
      if (dirY < 0 && tTop > 0) tMin = Math.min(tMin, tTop);

      edgeX = cx + dirX * tMin;
      edgeY = cy + dirY * tMin;

      ctx.save();
      ctx.translate(edgeX, edgeY);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha;

      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.moveTo(INDICATOR_SIZE, 0);
      ctx.lineTo(-INDICATOR_SIZE * 0.6, -INDICATOR_SIZE * 0.5);
      ctx.lineTo(-INDICATOR_SIZE * 0.6, INDICATOR_SIZE * 0.5);
      ctx.closePath();
      ctx.fill();

      if (isClose) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        const ringSize = INDICATOR_SIZE * (1.2 + 0.3 * Math.sin(performance.now() * 0.01));
        ctx.beginPath();
        ctx.arc(0, 0, ringSize, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  getPings(): Ping[] {
    return this.pings;
  }

  private renderPing(ctx: CanvasRenderingContext2D, ping: Ping, scaleFactor: number): void {
    this.renderPingAt(ctx, ping, ping.pos.x, ping.pos.y, scaleFactor);
  }

  private renderPingAt(
    ctx: CanvasRenderingContext2D,
    ping: Ping,
    x: number,
    y: number,
    scaleFactor: number
  ): void {
    const progress = ping.time / ping.maxTime;
    const alpha = 1 - progress;
    const color = PING_COLORS[ping.type];
    const label = PING_LABELS[ping.type];
    const icon = PING_ICONS[ping.type];

    ctx.save();
    ctx.globalAlpha = alpha;

    const ringRadius = (20 + progress * 30) * scaleFactor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * scaleFactor;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    const ringRadius2 = (10 + progress * 50) * scaleFactor;
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4 * scaleFactor, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `bold ${14 * scaleFactor}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(icon, x, y - 20 * scaleFactor);

    if (progress < 0.3) {
      const textAlpha = 1 - progress / 0.3;
      ctx.globalAlpha = textAlpha * alpha;
      ctx.font = `bold ${10 * scaleFactor}px monospace`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = color;
      ctx.fillText(label, x, y + ringRadius + 4 * scaleFactor);
    }

    ctx.restore();
  }
}
