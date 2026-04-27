export interface EmoteState {
  active: boolean;
  type: string | null;
  startTime: number;
  duration: number;
  showWheel: boolean;
  wheelSelection: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
}

export class EmoteSystem {
  private state: EmoteState;
  private availableEmotes: string[];
  private particles: Particle[];
  private emoteDuration: number;
  private bounceOffset: number;

  constructor() {
    this.state = {
      active: false,
      type: null,
      startTime: 0,
      duration: 2000,
      showWheel: false,
      wheelSelection: 0,
    };
    this.availableEmotes = [
      'wave',
      'dance',
      'salute',
      'laugh',
      'flex',
      'cry',
      'thumbsup',
      'point',
    ];
    this.particles = [];
    this.emoteDuration = 2000;
    this.bounceOffset = 0;
  }

  playEmote(type: string): boolean {
    if (this.state.active) {
      return false;
    }
    if (!this.availableEmotes.includes(type)) {
      return false;
    }
    this.state.active = true;
    this.state.type = type;
    this.state.startTime = performance.now();
    this.state.duration = this.emoteDuration;
    this.particles = [];
    return true;
  }

  cancelEmote(): void {
    this.state.active = false;
    this.state.type = null;
    this.particles = [];
    this.bounceOffset = 0;
  }

  toggleWheel(): void {
    this.state.showWheel = !this.state.showWheel;
  }

  setWheelSelection(index: number): void {
    if (index >= 0 && index < this.availableEmotes.length) {
      this.state.wheelSelection = index;
    }
  }

  confirmWheelSelection(): void {
    if (this.state.showWheel && this.state.wheelSelection >= 0 && this.state.wheelSelection < this.availableEmotes.length) {
      const emote = this.availableEmotes[this.state.wheelSelection];
      this.state.showWheel = false;
      this.playEmote(emote);
    }
    this.state.showWheel = false;
  }

  update(dt: number): boolean {
    if (!this.state.active || !this.state.type) {
      this.bounceOffset = 0;
      return false;
    }

    const elapsed = performance.now() - this.state.startTime;

    if (this.state.type === 'dance') {
      this.bounceOffset = Math.sin(elapsed * 0.012) * 6;
    }

    this.spawnParticles(elapsed);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    if (elapsed >= this.state.duration) {
      this.cancelEmote();
      return false;
    }

    return true;
  }

  private spawnParticles(elapsed: number): void {
    const type = this.state.type!;
    const interval = 150;

    switch (type) {
      case 'wave':
        if (elapsed % interval < 16) {
          this.particles.push(this.createParticle(
            (Math.random() - 0.5) * 2, -1 - Math.random(),
            600, 14, '#FFD700'
          ));
        }
        break;

      case 'dance':
        if (elapsed % 200 < 16) {
          const side = Math.random() > 0.5 ? 1 : -1;
          this.particles.push(this.createParticle(
            side * (1 + Math.random()), -0.5 - Math.random(),
            800, 10, '#FF69B4', '♪'
          ));
          this.particles.push(this.createParticle(
            -side * (1 + Math.random()), -1 - Math.random(),
            700, 8, '#87CEEB', '♫'
          ));
        }
        break;

      case 'salute':
        if (elapsed % 300 < 16) {
          const angle = Math.random() * Math.PI * 2;
          this.particles.push(this.createParticle(
            Math.cos(angle) * 1.5, Math.sin(angle) * 1.5,
            500, 6, '#FFFFFF'
          ));
        }
        break;

      case 'laugh':
        if (elapsed % 400 < 16) {
          this.particles.push(this.createParticle(
            (Math.random() - 0.5) * 1.5, -1.2,
            900, 16, '#FFFF00', 'HA'
          ));
        }
        break;

      case 'flex':
        if (elapsed % 200 < 16) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 1 + Math.random();
          this.particles.push(this.createParticle(
            Math.cos(ang) * dist, Math.sin(ang) * dist,
            600, 8, '#FF4500'
          ));
        }
        break;

      case 'cry':
        if (elapsed % 120 < 16) {
          this.particles.push(this.createParticle(
            (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.5,
            800, 5, '#4FC3F7'
          ));
        }
        break;

      case 'thumbsup':
        if (elapsed % 350 < 16) {
          this.particles.push(this.createParticle(
            (Math.random() - 0.5) * 2, -1 - Math.random(),
            700, 10, '#4CAF50'
          ));
        }
        break;

      case 'point':
        if (elapsed % 250 < 16) {
          this.particles.push(this.createParticle(
            2 + Math.random(), (Math.random() - 0.5) * 0.5,
            500, 6, '#FF9800'
          ));
        }
        break;
    }
  }

  private createParticle(
    vx: number, vy: number,
    life: number, size: number,
    color: string, text?: string
  ): Particle {
    return { x: 0, y: 0, vx, vy, life, maxLife: life, size, color, text };
  }

  renderPlayerEmote(
    ctx: CanvasRenderingContext2D,
    playerX: number, playerY: number,
    playerRadius: number, time: number
  ): void {
    if (!this.state.active || !this.state.type) return;

    const elapsed = performance.now() - this.state.startTime;
    const progress = elapsed / this.state.duration;
    const type = this.state.type;

    const headY = playerY - playerRadius + this.bounceOffset;

    ctx.save();

    switch (type) {
      case 'wave': {
        const bobY = Math.sin(elapsed * 0.008) * 4;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👋', playerX, headY - playerRadius - 12 + bobY);
        break;
      }

      case 'dance': {
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💃', playerX, headY - playerRadius - 8);
        const bounce = Math.abs(Math.sin(elapsed * 0.012)) * 4;
        ctx.fillStyle = 'rgba(255, 105, 180, 0.3)';
        ctx.beginPath();
        ctx.arc(playerX, playerY + playerRadius + 3 + bounce, playerRadius + 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'salute': {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🫡', playerX, headY - playerRadius - 12);
        break;
      }

      case 'laugh': {
        const bobY = Math.sin(elapsed * 0.01) * 3;
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('😂', playerX, headY - playerRadius - 10 + bobY);
        break;
      }

      case 'flex': {
        const pulse = 1 + Math.sin(elapsed * 0.01) * 0.15;
        ctx.font = `${20 * pulse}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('💪', playerX, headY - playerRadius - 14);
        break;
      }

      case 'cry': {
        const bobY = Math.sin(elapsed * 0.006) * 2;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('😢', playerX, headY - playerRadius - 12 + bobY);
        break;
      }

      case 'thumbsup': {
        const bobY = Math.sin(elapsed * 0.007) * 3;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👍', playerX, headY - playerRadius - 12 + bobY);
        break;
      }

      case 'point': {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👉', playerX + 14, headY - playerRadius - 8);
        const arrowLen = 30;
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerX + playerRadius + 4, playerY);
        ctx.lineTo(playerX + playerRadius + arrowLen, playerY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(playerX + playerRadius + arrowLen, playerY);
        ctx.lineTo(playerX + playerRadius + arrowLen - 6, playerY - 5);
        ctx.moveTo(playerX + playerRadius + arrowLen, playerY);
        ctx.lineTo(playerX + playerRadius + arrowLen - 6, playerY + 5);
        ctx.stroke();
        break;
      }
    }

    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const px = playerX + p.x;
      const py = headY - playerRadius - 20 + p.y;

      if (p.text) {
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${p.size}px Arial`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, px, py);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (progress < 0.1) {
      const fadeIn = progress / 0.1;
      ctx.globalAlpha = fadeIn;
    } else if (progress > 0.85) {
      const fadeOut = (1 - progress) / 0.15;
      ctx.globalAlpha = fadeOut;
    } else {
      ctx.globalAlpha = 1;
    }

    const labelY = headY - playerRadius - 38;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const emoteLabel = type.toUpperCase();
    const tw = ctx.measureText(emoteLabel).width;
    ctx.fillRect(playerX - tw / 2 - 6, labelY - 10, tw + 12, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(emoteLabel, playerX, labelY + 2);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  renderEmoteWheel(
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    mouseX: number, mouseY: number
  ): void {
    if (!this.state.showWheel) return;

    const radius = 100;
    const innerRadius = 30;
    const sliceAngle = (Math.PI * 2) / this.availableEmotes.length;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    let mouseAngle = Math.atan2(dy, dx);
    if (mouseAngle < 0) mouseAngle += Math.PI * 2;
    const mouseDist = Math.sqrt(dx * dx + dy * dy);

    let hoveredIndex = -1;
    if (mouseDist > innerRadius) {
      hoveredIndex = Math.floor(mouseAngle / sliceAngle) % this.availableEmotes.length;
      this.state.wheelSelection = hoveredIndex;
    }

    ctx.save();
    ctx.globalAlpha = 0.85;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < this.availableEmotes.length; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = (i + 1) * sliceAngle;

      const isHovered = i === hoveredIndex;
      ctx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(50, 50, 70, 0.8)';

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const midAngle = startAngle + sliceAngle / 2;
      const labelDist = (radius + innerRadius) / 2 + 8;
      const lx = centerX + Math.cos(midAngle) * labelDist;
      const ly = centerY + Math.sin(midAngle) * labelDist;

      const emoteName = this.availableEmotes[i];
      const emoteEmoji = this.getEmoteEmoji(emoteName);

      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(emoteEmoji, lx, ly - 8);

      ctx.font = `${isHovered ? 'bold ' : ''}10px Arial`;
      ctx.fillStyle = isHovered ? '#FFD700' : '#CCCCCC';
      ctx.fillText(emoteName.toUpperCase(), lx, ly + 10);

      if (i < 4) {
        ctx.font = '8px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`[${i + 6}]`, lx, ly + 20);
      }
    }

    ctx.fillStyle = 'rgba(20, 20, 35, 0.9)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#AAAAAA';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EMOTE', centerX, centerY);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private getEmoteEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      wave: '👋',
      dance: '💃',
      salute: '🫡',
      laugh: '😂',
      flex: '💪',
      cry: '😢',
      thumbsup: '👍',
      point: '👉',
    };
    return emojiMap[type] || '?';
  }

  getState(): EmoteState {
    return { ...this.state };
  }

  getEmotes(): string[] {
    return [...this.availableEmotes];
  }
}
