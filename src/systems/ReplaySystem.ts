export interface ReplayFrame {
  time: number;
  playerPos: { x: number; y: number };
  playerHealth: number;
  playerRotation: number;
  bots: Array<{ id: string; x: number; y: number; health: number; alive: boolean }>;
  projectiles: Array<{ x: number; y: number }>;
  events: string[];
}

export class ReplaySystem {
  private frames: ReplayFrame[] = [];
  private recording: boolean = false;
  private maxFrames: number = 60 * 60 * 5; // 5 minutes at 60fps
  private lastFrameTime: number = 0;
  private frameInterval: number = 1 / 20; // Record at 20 fps

  startRecording() {
    this.frames = [];
    this.recording = true;
    this.lastFrameTime = 0;
  }

  stopRecording() { this.recording = false; }

  recordFrame(time: number, state: any) {
    if (!this.recording) return;
    if (time - this.lastFrameTime < this.frameInterval) return;
    this.lastFrameTime = time;
    const frame: ReplayFrame = {
      time,
      playerPos: { x: state.player.pos.x, y: state.player.pos.y },
      playerHealth: state.player.health,
      playerRotation: state.player.rotation,
      bots: state.bots.filter((b: any) => b.alive).map((b: any) => ({ id: b.id, x: b.pos.x, y: b.pos.y, health: b.health, alive: b.alive })),
      projectiles: state.projectiles.filter((p: any) => p.alive).map((p: any) => ({ x: p.pos.x, y: p.pos.y })),
      events: [],
    };
    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) this.frames.shift();
  }

  getReplay(): ReplayFrame[] { return this.frames; }

  getKillCamFrames(deathTime: number, secondsBefore: number = 3): ReplayFrame[] {
    return this.frames.filter(f => f.time >= deathTime - secondsBefore && f.time <= deathTime);
  }

  clear() { this.frames = []; }
}
