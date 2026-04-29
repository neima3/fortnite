export class StormTimerBar {
  private flashTimer: number = 0;
  private lastTimestamp: number = 0;

  render(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    stormTimer: number,
    stormPhase: number,
    stormMoving: boolean,
    stormDamage: number,
    playersInStorm: number
  ): void {
    const now = performance.now();
    const dt = this.lastTimestamp ? (now - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = now;
    this.flashTimer += dt;

    const barWidth = canvasWidth * 0.6;
    const barHeight = 30;
    const barX = (canvasWidth - barWidth) / 2;
    const barY = 60;

    const infoPanelWidth = 220;
    const infoPanelHeight = 120;
    const infoPanelX = barX + barWidth + 10;
    const infoPanelY = barY - 5;

    this.drawBarBackground(ctx, barX, barY, barWidth, barHeight);
    this.drawBarFill(ctx, barX, barY, barWidth, barHeight, stormTimer);
    this.drawBarBorder(ctx, barX, barY, barWidth, barHeight);
    this.drawBarText(ctx, barX, barY, barWidth, barHeight, stormTimer, stormPhase, stormMoving);
    this.drawWarningFlash(ctx, barX, barY, barWidth, barHeight, stormTimer);
    this.drawInfoPanel(ctx, infoPanelX, infoPanelY, infoPanelWidth, infoPanelHeight, stormPhase, stormDamage, playersInStorm, stormMoving);
  }

  private drawBarBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x, y, w, h);
  }

  private drawBarFill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    stormTimer: number
  ): void {
    const maxTime = Math.max(stormTimer, 1);
    const fillRatio = Math.min(Math.max(stormTimer / maxTime, 0), 1);
    const fillWidth = w * fillRatio;

    const gradient = ctx.createLinearGradient(x, y, x + fillWidth, y);
    gradient.addColorStop(0, "#2D004F");
    gradient.addColorStop(0.5, "#6A0DAD");
    gradient.addColorStop(1, "#9B30FF");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, fillWidth, h);
  }

  private drawBarBorder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  private drawBarText(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    stormTimer: number,
    stormPhase: number,
    stormMoving: boolean
  ): void {
    const minutes = Math.floor(stormTimer / 60);
    const seconds = Math.floor(stormTimer % 60);
    const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = x + w / 2;
    const centerY = y + h / 2;

    ctx.fillStyle = stormMoving ? "#FF4444" : "#FFFFFF";
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(stormMoving ? "STORM MOVING" : "STORM WAITING", centerX, centerY - 7);

    ctx.fillStyle = stormTimer < 10 ? "#FF0000" : "#FFFFFF";
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(timeStr, centerX, centerY + 7);

    ctx.fillStyle = "#CCCCCC";
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = "left";
    ctx.fillText(`Phase ${stormPhase}`, x + 8, centerY);

    const phaseLabel = `Phase ${stormPhase}`;
    const phaseLabelWidth = ctx.measureText(phaseLabel).width;
    const nextPhaseLabel = `Next: Phase ${stormPhase + 1}`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#AAAAAA";
    ctx.fillText(nextPhaseLabel, x + w - 8, centerY);
  }

  private drawWarningFlash(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    stormTimer: number
  ): void {
    if (stormTimer >= 10) return;

    const flashIntensity = Math.sin(this.flashTimer * 8) * 0.5 + 0.5;
    const alpha = flashIntensity * 0.6;

    ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
    ctx.fillRect(x, y, w, h);

    if (flashIntensity > 0.5) {
      ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }
  }

  private drawInfoPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    stormPhase: number,
    stormDamage: number,
    playersInStorm: number,
    stormMoving: boolean
  ): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    ctx.strokeStyle = "rgba(155, 48, 255, 0.6)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();

    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    let textY = y + 8;
    const textX = x + 10;
    const lineHeight = 20;

    ctx.fillStyle = "#9B30FF";
    ctx.fillText("STORM INFO", textX, textY);
    textY += lineHeight + 2;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`Phase: ${stormPhase}`, textX, textY);
    textY += lineHeight;

    ctx.fillStyle = "#FF6666";
    ctx.fillText(`Dmg/Tick: ${stormDamage.toFixed(1)}`, textX, textY);
    textY += lineHeight;

    ctx.fillStyle = playersInStorm > 0 ? "#FF4444" : "#66FF66";
    ctx.fillText(`In Storm: ${playersInStorm}`, textX, textY);
    textY += lineHeight;

    ctx.fillStyle = stormMoving ? "#FF8800" : "#AAAAAA";
    ctx.fillText(stormMoving ? "Status: SHRINKING" : "Status: STABLE", textX, textY);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
