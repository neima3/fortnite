import { Vec2 } from '../types.js';
import { lerp } from '../utils/math.js';

export class Camera {
  pos: Vec2 = { x: 0, y: 0 };
  width: number = 0;
  height: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.width = canvas.width;
    this.height = canvas.height;
    window.addEventListener('resize', () => this.handleResize(canvas));
    this.handleResize(canvas);
  }

  handleResize(canvas: HTMLCanvasElement): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  follow(target: Vec2, dt: number, smooth: number = 0.1): void {
    const targetX = target.x - this.width / 2;
    const targetY = target.y - this.height / 2;
    this.pos.x = lerp(this.pos.x, targetX, smooth);
    this.pos.y = lerp(this.pos.y, targetY, smooth);
  }

  worldToScreen(worldPos: Vec2): Vec2 {
    return {
      x: worldPos.x - this.pos.x,
      y: worldPos.y - this.pos.y,
    };
  }

  screenToWorld(screenPos: Vec2): Vec2 {
    return {
      x: screenPos.x + this.pos.x,
      y: screenPos.y + this.pos.y,
    };
  }
}
