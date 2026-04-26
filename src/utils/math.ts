export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
export const angleTo = (from: Vec2, to: Vec2): number => Math.atan2(to.y - from.y, to.x - from.x);
export const randomRange = (min: number, max: number): number => Math.random() * (max - min) + min;

export interface Vec2 { x: number; y: number; }
export const vec2 = (x: number, y: number): Vec2 => ({ x, y });
export const vec2Add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const vec2Sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const vec2Mul = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s });
export const vec2Len = (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y);
export const vec2Norm = (v: Vec2): Vec2 => {
  const len = vec2Len(v);
  return len > 0 ? vec2Mul(v, 1 / len) : vec2(0, 0);
};
