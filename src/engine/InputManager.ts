import { Vec2 } from '../types.js';

export class InputManager {
  keys: Set<string> = new Set();
  mousePos: Vec2 = { x: 0, y: 0 };
  mouseWorld: Vec2 = { x: 0, y: 0 };
  mouseDown: boolean = false;
  mouseClicked: boolean = false;
  scrollDelta: number = 0;
  public touchJoystick: { active: boolean; startX: number; startY: number; dx: number; dy: number } = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
  public touchAim: { active: boolean; x: number; y: number } = { active: false, x: 0, y: 0 };

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) || key === ' ') {
      e.preventDefault();
    }
    this.keys.add(key);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = e.clientX - rect.left;
    this.mousePos.y = e.clientY - rect.top;
  };

  private onMouseDown = (e: MouseEvent) => {
    this.mouseDown = true;
    this.mouseClicked = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    this.mouseDown = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.scrollDelta += e.deltaY;
  };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (x < rect.width / 2 && !this.touchJoystick.active) {
        this.touchJoystick.active = true;
        this.touchJoystick.startX = x;
        this.touchJoystick.startY = y;
        this.touchJoystick.dx = 0;
        this.touchJoystick.dy = 0;
      } else if (x >= rect.width / 2 && !this.touchAim.active) {
        this.touchAim.active = true;
        this.touchAim.x = x;
        this.touchAim.y = y;
        this.mousePos.x = x;
        this.mousePos.y = y;
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (this.touchJoystick.active && x < rect.width / 2) {
        this.touchJoystick.dx = x - this.touchJoystick.startX;
        this.touchJoystick.dy = y - this.touchJoystick.startY;
      } else if (this.touchAim.active && x >= rect.width / 2) {
        this.touchAim.x = x;
        this.touchAim.y = y;
        this.mousePos.x = x;
        this.mousePos.y = y;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const rect = this.canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      if (this.touchJoystick.active && x < rect.width / 2) {
        this.touchJoystick.active = false;
        this.touchJoystick.dx = 0;
        this.touchJoystick.dy = 0;
      } else if (this.touchAim.active && x >= rect.width / 2) {
        this.touchAim.active = false;
        this.mouseDown = false;
      }
    }
  };

  isKeyDown(key: string): boolean {
    const k = key.toLowerCase();
    const keyPressed = this.keys.has(k);
    if (this.touchJoystick.active) {
      const threshold = 10;
      if ((k === 'w' || k === 'arrowup') && this.touchJoystick.dy < -threshold) return true;
      if ((k === 's' || k === 'arrowdown') && this.touchJoystick.dy > threshold) return true;
      if ((k === 'a' || k === 'arrowleft') && this.touchJoystick.dx < -threshold) return true;
      if ((k === 'd' || k === 'arrowright') && this.touchJoystick.dx > threshold) return true;
    }
    return keyPressed;
  }

  setMouseWorld(pos: Vec2): void {
    this.mouseWorld = pos;
  }

  resetFrame(): void {
    this.mouseClicked = false;
    this.scrollDelta = 0;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
  }
}
