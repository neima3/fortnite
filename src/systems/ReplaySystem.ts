export interface ReplayFrame {
  time: number;
  playerPos: { x: number; y: number };
  playerHealth: number;
  playerShield: number;
  playerRotation: number;
  playerAlive: boolean;
  bots: Array<{ id: string; x: number; y: number; health: number; alive: boolean; rotation: number }>;
  projectiles: Array<{ x: number; y: number }>;
  stormCenter: { x: number; y: number };
  stormRadius: number;
  events: string[];
}

export class ReplaySystem {
  private frames: ReplayFrame[] = [];
  private recording: boolean = false;
  private maxFrames: number = 60 * 60 * 5;
  private lastFrameTime: number = 0;
  private frameInterval: number = 1 / 15;

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
      playerShield: state.player.shield,
      playerRotation: state.player.rotation,
      playerAlive: state.player.alive,
      bots: state.bots.map((b: any) => ({ id: b.id, x: b.pos.x, y: b.pos.y, health: b.health, alive: b.alive, rotation: b.rotation })),
      projectiles: state.projectiles.filter((p: any) => p.alive).map((p: any) => ({ x: p.pos.x, y: p.pos.y })),
      stormCenter: { x: state.stormCenter.x, y: state.stormCenter.y },
      stormRadius: state.stormRadius,
      events: [...(state.killFeed || []).slice(0, 3)],
    };
    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) this.frames.shift();
  }

  getReplay(): ReplayFrame[] { return this.frames; }

  getKillCamFrames(deathTime: number, secondsBefore: number = 3): ReplayFrame[] {
    return this.frames.filter(f => f.time >= deathTime - secondsBefore && f.time <= deathTime);
  }

  getFullReplay(): ReplayFrame[] { return this.frames; }

  clear() { this.frames = []; }
}
