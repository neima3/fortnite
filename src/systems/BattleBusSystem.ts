export interface BusState {
  phase: 'bus' | 'drop' | 'gliding' | 'landed';
  busX: number;
  busY: number;
  busAngle: number;
  busSpeed: number;
  playerAltitude: number;
  maxAltitude: number;
  dropX: number;
  dropY: number;
  landX: number;
  landY: number;
  cameraZoom: number;
  targetCameraZoom: number;
}

const BUS_SPEED = 300;
const MAX_ALTITUDE = 1500;
const GLIDER_DEPLOY_ALTITUDE = 200;
const FREEFALL_SPEED_INITIAL = 800;
const FREEFALL_SPEED_MAX = 1200;
const FREEFALL_ACCEL = 400;
const GLIDER_HORIZONTAL_SPEED = 400;
const GLIDER_VERTICAL_SPEED = 200;
const GLIDER_STEER_SPEED = 300;
const BUS_WIDTH = 120;
const BUS_HEIGHT = 50;
const BUS_ZOOM = 3.0;
const GROUND_ZOOM = 1.0;
const DROP_ZOOM = 2.0;
const ZOOM_LERP_SPEED = 2.0;
const MAP_PADDING = 200;
const BOT_COUNT = 50;

interface BotDropState {
  dropProgress: number;
  hasDropped: boolean;
  altitude: number;
  phase: 'bus' | 'drop' | 'gliding' | 'landed';
  x: number;
  y: number;
  velX: number;
  velY: number;
}

export class BattleBusSystem {
  private mapSize: number = 4000;
  private pathStartX: number = 0;
  private pathStartY: number = 0;
  private pathEndX: number = 0;
  private pathEndY: number = 0;
  private pathLength: number = 0;
  private busProgress: number = 0;
  private fallSpeed: number = FREEFALL_SPEED_INITIAL;
  private playerVelX: number = 0;
  private playerVelY: number = 0;
  private botDrops: BotDropState[] = [];
  private playerDropped: boolean = false;

  init(mapSize: number): BusState {
    this.mapSize = mapSize;
    this.busProgress = 0;
    this.fallSpeed = FREEFALL_SPEED_INITIAL;
    this.playerVelX = 0;
    this.playerVelY = 0;
    this.playerDropped = false;
    this.botDrops = [];

    this.generatePath();

    for (let i = 0; i < BOT_COUNT; i++) {
      this.botDrops.push({
        dropProgress: 0.2 + Math.random() * 0.6,
        hasDropped: false,
        altitude: MAX_ALTITUDE,
        phase: 'bus',
        x: 0,
        y: 0,
        velX: 0,
        velY: 0,
      });
    }

    const startPos = this.getPositionAtProgress(0);

    return {
      phase: 'bus',
      busX: startPos.x,
      busY: startPos.y,
      busAngle: this.busAngle(),
      busSpeed: BUS_SPEED,
      playerAltitude: MAX_ALTITUDE,
      maxAltitude: MAX_ALTITUDE,
      dropX: 0,
      dropY: 0,
      landX: 0,
      landY: 0,
      cameraZoom: BUS_ZOOM,
      targetCameraZoom: BUS_ZOOM,
    };
  }

  private generatePath(): void {
    const edge = Math.floor(Math.random() * 4);
    const map = this.mapSize;

    switch (edge) {
      case 0:
        this.pathStartX = Math.random() * map;
        this.pathStartY = -MAP_PADDING;
        break;
      case 1:
        this.pathStartX = map + MAP_PADDING;
        this.pathStartY = Math.random() * map;
        break;
      case 2:
        this.pathStartX = Math.random() * map;
        this.pathStartY = map + MAP_PADDING;
        break;
      case 3:
        this.pathStartX = -MAP_PADDING;
        this.pathStartY = Math.random() * map;
        break;
    }

    const oppositeEdge = (edge + 2) % 4;
    switch (oppositeEdge) {
      case 0:
        this.pathEndX = Math.random() * map;
        this.pathEndY = -MAP_PADDING;
        break;
      case 1:
        this.pathEndX = map + MAP_PADDING;
        this.pathEndY = Math.random() * map;
        break;
      case 2:
        this.pathEndX = Math.random() * map;
        this.pathEndY = map + MAP_PADDING;
        break;
      case 3:
        this.pathEndX = -MAP_PADDING;
        this.pathEndY = Math.random() * map;
        break;
    }

    const dx = this.pathEndX - this.pathStartX;
    const dy = this.pathEndY - this.pathStartY;
    this.pathLength = Math.sqrt(dx * dx + dy * dy);
  }

  private busAngle(): number {
    return Math.atan2(this.pathEndY - this.pathStartY, this.pathEndX - this.pathStartX);
  }

  private getPositionAtProgress(progress: number): { x: number; y: number } {
    return {
      x: this.pathStartX + (this.pathEndX - this.pathStartX) * progress,
      y: this.pathStartY + (this.pathEndY - this.pathStartY) * progress,
    };
  }

  update(
    state: BusState,
    dt: number,
    playerPos: { x: number; y: number },
    inputForward: boolean,
    inputLeft: boolean,
    inputRight: boolean,
    inputBack: boolean,
    dropRequested: boolean,
  ): BusState {
    if (this.pathLength <= 0) return state;

    const busDelta = (BUS_SPEED * dt) / this.pathLength;
    this.busProgress = Math.min(1, this.busProgress + busDelta);

    const busPos = this.getPositionAtProgress(this.busProgress);
    state.busX = busPos.x;
    state.busY = busPos.y;
    state.busAngle = this.busAngle();

    this.updateBotDrops(dt);

    if (state.phase === 'bus') {
      state.cameraZoom = BUS_ZOOM;
      state.targetCameraZoom = BUS_ZOOM;

      if (dropRequested && !this.playerDropped) {
        this.playerDropped = true;
        state.phase = 'drop';
        state.dropX = state.busX;
        state.dropY = state.busY;
        state.playerAltitude = MAX_ALTITUDE;
        this.fallSpeed = FREEFALL_SPEED_INITIAL;
        this.playerVelX = 0;
        this.playerVelY = 0;
        state.targetCameraZoom = DROP_ZOOM;
      }
    }

    if (state.phase === 'drop') {
      this.fallSpeed = Math.min(FREEFALL_SPEED_MAX, this.fallSpeed + FREEFALL_ACCEL * dt);
      state.playerAltitude = Math.max(0, state.playerAltitude - this.fallSpeed * dt);

      const steerStrength = 200;
      let moveX = 0;
      let moveY = 0;
      if (inputForward) moveY -= 1;
      if (inputBack) moveY += 1;
      if (inputLeft) moveX -= 1;
      if (inputRight) moveX += 1;
      const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
      if (moveLen > 0) {
        moveX = (moveX / moveLen) * steerStrength * dt;
        moveY = (moveY / moveLen) * steerStrength * dt;
      }
      playerPos.x += moveX;
      playerPos.y += moveY;

      this.playerVelX = moveX / dt;
      this.playerVelY = moveY / dt;

      const zoomRange = BUS_ZOOM - GROUND_ZOOM;
      const altRatio = state.playerAltitude / MAX_ALTITUDE;
      state.targetCameraZoom = GROUND_ZOOM + zoomRange * altRatio;
      state.cameraZoom += (state.targetCameraZoom - state.cameraZoom) * Math.min(1, ZOOM_LERP_SPEED * dt);

      state.landX = playerPos.x + (this.playerVelX * state.playerAltitude) / Math.max(1, this.fallSpeed) * 0.3;
      state.landY = playerPos.y + (this.playerVelY * state.playerAltitude) / Math.max(1, this.fallSpeed) * 0.3;

      if (state.playerAltitude <= GLIDER_DEPLOY_ALTITUDE) {
        state.phase = 'gliding';
        this.playerVelX = 0;
        this.playerVelY = 0;
        state.targetCameraZoom = GROUND_ZOOM;
      }
    }

    if (state.phase === 'gliding') {
      state.playerAltitude = Math.max(0, state.playerAltitude - GLIDER_VERTICAL_SPEED * dt);

      let moveX = 0;
      let moveY = 0;
      if (inputForward) moveY -= 1;
      if (inputBack) moveY += 1;
      if (inputLeft) moveX -= 1;
      if (inputRight) moveX += 1;
      const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
      if (moveLen > 0) {
        moveX = (moveX / moveLen) * GLIDER_STEER_SPEED * dt;
        moveY = (moveY / moveLen) * GLIDER_STEER_SPEED * dt;
      }

      const angle = this.busAngle();
      const driftX = Math.cos(angle) * GLIDER_HORIZONTAL_SPEED * dt * 0.3;
      const driftY = Math.sin(angle) * GLIDER_HORIZONTAL_SPEED * dt * 0.3;

      playerPos.x += moveX + driftX;
      playerPos.y += moveY + driftY;

      this.playerVelX = moveX / dt;
      this.playerVelY = moveY / dt;

      state.landX = playerPos.x;
      state.landY = playerPos.y;

      state.targetCameraZoom = GROUND_ZOOM;
      state.cameraZoom += (state.targetCameraZoom - state.cameraZoom) * Math.min(1, ZOOM_LERP_SPEED * dt);

      if (state.playerAltitude <= 0) {
        state.playerAltitude = 0;
        state.phase = 'landed';
        state.landX = playerPos.x;
        state.landY = playerPos.y;
      }
    }

    return state;
  }

  private updateBotDrops(dt: number): void {
    for (const bot of this.botDrops) {
      if (!bot.hasDropped && this.busProgress >= bot.dropProgress) {
        bot.hasDropped = true;
        bot.phase = 'drop';
        const pos = this.getPositionAtProgress(bot.dropProgress);
        bot.x = pos.x;
        bot.y = pos.y;
        bot.altitude = MAX_ALTITUDE;
        const angle = Math.random() * Math.PI * 2;
        bot.velX = Math.cos(angle) * 50;
        bot.velY = Math.sin(angle) * 50;
      }

      if (bot.phase === 'drop') {
        bot.altitude -= (FREEFALL_SPEED_INITIAL + (FREEFALL_SPEED_MAX - FREEFALL_SPEED_INITIAL) * 0.5) * dt;
        bot.x += bot.velX * dt;
        bot.y += bot.velY * dt;

        if (bot.altitude <= GLIDER_DEPLOY_ALTITUDE) {
          bot.phase = 'gliding';
          bot.velX = (Math.random() - 0.5) * GLIDER_HORIZONTAL_SPEED;
          bot.velY = (Math.random() - 0.5) * GLIDER_HORIZONTAL_SPEED;
        }
      }

      if (bot.phase === 'gliding') {
        bot.altitude = Math.max(0, bot.altitude - GLIDER_VERTICAL_SPEED * dt);
        bot.x += bot.velX * dt;
        bot.y += bot.velY * dt;
        bot.x = Math.max(0, Math.min(this.mapSize, bot.x));
        bot.y = Math.max(0, Math.min(this.mapSize, bot.y));

        if (bot.altitude <= 0) {
          bot.phase = 'landed';
        }
      }
    }
  }

  getBotPositions(): { x: number; y: number; phase: string }[] {
    return this.botDrops
      .filter((b) => b.hasDropped && b.phase !== 'landed')
      .map((b) => ({ x: b.x, y: b.y, phase: b.phase }));
  }

  shouldTransitionToPlaying(state: BusState): boolean {
    return state.phase === 'landed';
  }

  renderBus(ctx: CanvasRenderingContext2D, state: BusState, camera: any): void {
    ctx.save();

    if (state.phase === 'bus') {
      this.renderBusPath(ctx, camera);
    }

    if (this.busProgress < 1) {
      this.renderBusVehicle(ctx, state, camera);
    }

    if (state.phase === 'bus' && !this.playerDropped && this.busProgress < 1) {
      this.renderDropPrompt(ctx, state, camera);
    }

    if (state.phase === 'drop' || state.phase === 'gliding') {
      this.renderPlayerDropShadow(ctx, state, camera);
    }

    if (state.phase === 'gliding') {
      this.renderGliderVisual(ctx, state, camera);
    }

    this.renderDroppingBots(ctx, camera);

    ctx.restore();
  }

  private renderBusPath(ctx: CanvasRenderingContext2D, camera: any): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 10]);
    ctx.beginPath();
    ctx.moveTo(
      (this.pathStartX - camera.x) + ctx.canvas.width / 2,
      (this.pathStartY - camera.y) + ctx.canvas.height / 2,
    );
    ctx.lineTo(
      (this.pathEndX - camera.x) + ctx.canvas.width / 2,
      (this.pathEndY - camera.y) + ctx.canvas.height / 2,
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderBusVehicle(ctx: CanvasRenderingContext2D, state: BusState, camera: any): void {
    ctx.save();
    const screenX = (state.busX - camera.x) + ctx.canvas.width / 2;
    const screenY = (state.busY - camera.y) + ctx.canvas.height / 2;

    ctx.translate(screenX, screenY);
    ctx.rotate(state.busAngle);

    ctx.fillStyle = '#1a5fb4';
    ctx.fillRect(-BUS_WIDTH / 2, -BUS_HEIGHT / 2, BUS_WIDTH, BUS_HEIGHT);

    ctx.fillStyle = '#62a0ea';
    ctx.fillRect(-BUS_WIDTH / 2 + 4, -BUS_HEIGHT / 2 + 4, BUS_WIDTH * 0.6, BUS_HEIGHT - 8);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-BUS_WIDTH / 2 + 8, -BUS_HEIGHT / 2 + 6, 25, BUS_HEIGHT - 12);

    ctx.fillStyle = '#0d3b66';
    ctx.fillRect(BUS_WIDTH / 2 - 20, -BUS_HEIGHT / 2 - 5, 22, BUS_HEIGHT + 10);

    ctx.fillStyle = '#f5c211';
    ctx.beginPath();
    ctx.arc(BUS_WIDTH / 2 + 2, -BUS_HEIGHT / 2 + 5, 5, 0, Math.PI * 2);
    ctx.arc(BUS_WIDTH / 2 + 2, BUS_HEIGHT / 2 - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderDropPrompt(ctx: CanvasRenderingContext2D, state: BusState, camera: any): void {
    ctx.save();
    const screenX = (state.busX - camera.x) + ctx.canvas.width / 2;
    const screenY = (state.busY - camera.y) + ctx.canvas.height / 2 - BUS_HEIGHT - 20;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(screenX - 80, screenY - 14, 160, 28, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPACE to deploy', screenX, screenY);
    ctx.restore();
  }

  private renderPlayerDropShadow(ctx: CanvasRenderingContext2D, state: BusState, camera: any): void {
    ctx.save();
    const screenX = (state.landX - camera.x) + ctx.canvas.width / 2;
    const screenY = (state.landY - camera.y) + ctx.canvas.height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenX - 15, screenY);
    ctx.lineTo(screenX + 15, screenY);
    ctx.moveTo(screenX, screenY - 15);
    ctx.lineTo(screenX, screenY + 15);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderGliderVisual(ctx: CanvasRenderingContext2D, state: BusState, camera: any): void {
    ctx.save();
    const screenX = (state.landX - camera.x) + ctx.canvas.width / 2;
    const screenY = (state.landY - camera.y) + ctx.canvas.height / 2;

    const gliderWidth = 30 + (state.playerAltitude / MAX_ALTITUDE) * 20;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX - gliderWidth, screenY - 15);
    ctx.quadraticCurveTo(screenX, screenY - 25, screenX + gliderWidth, screenY - 15);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenX - gliderWidth, screenY - 15);
    ctx.lineTo(screenX, screenY);
    ctx.lineTo(screenX + gliderWidth, screenY - 15);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.stroke();

    ctx.restore();
  }

  private renderDroppingBots(ctx: CanvasRenderingContext2D, camera: any): void {
    ctx.save();
    for (const bot of this.botDrops) {
      if (!bot.hasDropped || bot.phase === 'landed') continue;

      const screenX = (bot.x - camera.x) + ctx.canvas.width / 2;
      const screenY = (bot.y - camera.y) + ctx.canvas.height / 2;

      if (bot.phase === 'drop') {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.7)';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (bot.phase === 'gliding') {
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX - 10, screenY - 8);
        ctx.quadraticCurveTo(screenX, screenY - 12, screenX + 10, screenY - 8);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 200, 100, 0.7)';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderDropUI(ctx: CanvasRenderingContext2D, state: BusState, canvasWidth: number, canvasHeight: number): void {
    if (state.phase === 'bus') {
      this.renderBusPhaseUI(ctx, state, canvasWidth, canvasHeight);
    }

    if (state.phase === 'drop' || state.phase === 'gliding') {
      this.renderAltitudeMeter(ctx, state, canvasWidth, canvasHeight);
      this.renderPhaseLabel(ctx, state, canvasWidth, canvasHeight);
    }
  }

  private renderBusPhaseUI(ctx: CanvasRenderingContext2D, state: BusState, canvasWidth: number, canvasHeight: number): void {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvasWidth / 2 - 120, 20, 240, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BATTLE BUS', canvasWidth / 2, 32);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#62a0ea';
    ctx.fillText(`Press SPACE to drop`, canvasWidth / 2, 50);

    ctx.restore();
  }

  private renderAltitudeMeter(ctx: CanvasRenderingContext2D, state: BusState, canvasWidth: number, canvasHeight: number): void {
    ctx.save();

    const meterX = 30;
    const meterY = 100;
    const meterWidth = 20;
    const meterHeight = canvasHeight - 200;
    const fillRatio = state.playerAltitude / state.maxAltitude;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(meterX - 5, meterY - 5, meterWidth + 10, meterHeight + 10);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

    const fillColor = state.phase === 'drop'
      ? `rgb(${Math.floor(255 * (1 - fillRatio))}, ${Math.floor(100 + 155 * fillRatio)}, ${Math.floor(255 * fillRatio)})`
      : '#62a0ea';
    ctx.fillStyle = fillColor;
    ctx.fillRect(meterX, meterY + meterHeight * (1 - fillRatio), meterWidth, meterHeight * fillRatio);

    const gliderLineY = meterY + meterHeight * (1 - GLIDER_DEPLOY_ALTITUDE / state.maxAltitude);
    ctx.strokeStyle = '#f5c211';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meterX - 3, gliderLineY);
    ctx.lineTo(meterX + meterWidth + 3, gliderLineY);
    ctx.stroke();

    ctx.fillStyle = '#f5c211';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('GLIDER', meterX - 6, gliderLineY + 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(state.playerAltitude) + 'm', meterX + meterWidth / 2, meterY + meterHeight + 20);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '10px monospace';
    ctx.fillText('ALT', meterX + meterWidth / 2, meterY - 12);

    ctx.restore();
  }

  private renderPhaseLabel(ctx: CanvasRenderingContext2D, state: BusState, canvasWidth: number, canvasHeight: number): void {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvasWidth / 2 - 80, 20, 160, 30);

    ctx.fillStyle = state.phase === 'drop' ? '#ff6b6b' : '#62a0ea';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = state.phase === 'drop' ? 'FREEFALL' : 'GLIDING';
    ctx.fillText(label, canvasWidth / 2, 35);

    ctx.restore();
  }
}
