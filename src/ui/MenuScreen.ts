import { LEVEL_XP_REQUIREMENTS } from '../systems/ProgressionSystem.js';

export class MenuScreen {
  private container: HTMLElement;
  private visible: boolean = false;

  constructor() {
    this.container = document.getElementById('ui-layer')!;
  }

  showMainMenu(onPlay: () => void, onSettings: () => void, onCareer?: () => void) {
    this.container.innerHTML = `
      <div id="main-menu" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;font-family:monospace;">
        <h1 style="font-size:64px;margin-bottom:10px;text-shadow:0 0 20px #f1c40f;">STORM SURGE</h1>
        <p style="font-size:18px;margin-bottom:40px;color:#aaa;">Battle Royale - 2D Top-Down</p>
        <button id="btn-play" style="padding:15px 60px;font-size:24px;background:#f1c40f;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;font-weight:bold;">PLAY</button>
        <button id="btn-settings" style="padding:12px 40px;font-size:18px;background:transparent;color:#f1c40f;border:2px solid #f1c40f;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;">SETTINGS</button>
        <button id="btn-career" style="padding:12px 40px;font-size:18px;background:transparent;color:#f1c40f;border:2px solid #f1c40f;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;">CAREER</button>
        <div style="margin-top:40px;color:#666;font-size:12px;text-align:center;">
          WASD: Move | Mouse: Aim | Click: Shoot | 1-5: Weapons<br>
          Q/E/R/T: Build | G: Material | F: Pickup | X: Reload | N: Restart
        </div>
      </div>
    `;
    this.container.style.pointerEvents = 'auto';
    document.getElementById('btn-play')!.onclick = onPlay;
    document.getElementById('btn-settings')!.onclick = onSettings;
    const careerBtn = document.getElementById('btn-career');
    if (careerBtn && onCareer) careerBtn.onclick = onCareer;
    this.visible = true;
  }

  showModeSelect(onSinglePlayer: () => void, onMultiplayer: () => void) {
    this.container.innerHTML = `
      <div id="mode-select" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;font-family:monospace;">
        <h1 style="font-size:48px;margin-bottom:40px;text-shadow:0 0 20px #f1c40f;">SELECT MODE</h1>
        <button id="btn-single" style="padding:15px 60px;font-size:24px;background:#f1c40f;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;font-weight:bold;">SINGLE PLAYER</button>
        <button id="btn-multi" style="padding:15px 60px;font-size:24px;background:transparent;color:#f1c40f;border:2px solid #f1c40f;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;font-weight:bold;">MULTIPLAYER</button>
      </div>
    `;
    this.container.style.pointerEvents = 'auto';
    document.getElementById('btn-single')!.onclick = onSinglePlayer;
    document.getElementById('btn-multi')!.onclick = onMultiplayer;
    this.visible = true;
  }

  showLobby(snapshot: any, isHost: boolean, onReady: () => void, onStart: () => void, onLeave: () => void) {
    const players = snapshot.players || [];
    const readyCount = players.filter((p: any) => p.ready).length;
    const playerListHtml = players.map((p: any) => {
      const isLocal = p.sessionId === snapshot.localSessionId;
      const readyDot = p.ready ? '🟢' : '🔴';
      return `<div style="padding:8px 12px;margin:4px 0;background:rgba(255,255,255,0.1);border-radius:4px;display:flex;justify-content:space-between;align-items:center;">
        <span>${isLocal ? '<b>' : ''}${p.name || 'Player'}${isLocal ? '</b> (You)' : ''}</span>
        <span>${readyDot}</span>
      </div>`;
    }).join('');

    this.container.innerHTML = `
      <div id="lobby-menu" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;font-family:monospace;">
        <h1 style="font-size:48px;margin-bottom:10px;text-shadow:0 0 20px #f1c40f;">LOBBY</h1>
        <p style="font-size:14px;margin-bottom:20px;color:#aaa;">Room: ${snapshot.roomId || '...'} | Players: ${snapshot.playerCount || 0}</p>
        <div style="width:300px;max-height:300px;overflow-y:auto;margin-bottom:20px;">
          ${playerListHtml || '<p style="color:#666;">Waiting for players...</p>'}
        </div>
        <p style="font-size:14px;margin-bottom:10px;color:#aaa;">Ready: ${readyCount} / ${players.length}</p>
        <button id="btn-ready" style="padding:12px 50px;font-size:20px;background:#2ecc71;color:#fff;border:none;border-radius:8px;cursor:pointer;margin:8px;font-family:monospace;font-weight:bold;">READY</button>
        ${isHost ? `<button id="btn-start" style="padding:12px 50px;font-size:20px;background:${readyCount >= 1 ? '#f1c40f' : '#666'};color:#1a1a2e;border:none;border-radius:8px;cursor:${readyCount >= 1 ? 'pointer' : 'not-allowed'};margin:8px;font-family:monospace;font-weight:bold;" ${readyCount < 1 ? 'disabled' : ''}>START MATCH</button>` : ''}
        <button id="btn-leave" style="padding:10px 40px;font-size:18px;background:transparent;color:#e74c3c;border:2px solid #e74c3c;border-radius:8px;cursor:pointer;margin:8px;font-family:monospace;">LEAVE</button>
      </div>
    `;
    this.container.style.pointerEvents = 'auto';
    document.getElementById('btn-ready')!.onclick = onReady;
    if (isHost) {
      const startBtn = document.getElementById('btn-start');
      if (startBtn) startBtn.onclick = onStart;
    }
    document.getElementById('btn-leave')!.onclick = onLeave;
    this.visible = true;
  }

  showPauseMenu(onResume: () => void, onRestart: () => void, onMainMenu: () => void) {
    this.container.innerHTML = `
      <div id="pause-menu" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:rgba(0,0,0,0.8);color:#fff;font-family:monospace;">
        <h1 style="font-size:48px;margin-bottom:30px;">PAUSED</h1>
        <button id="btn-resume" style="padding:12px 50px;font-size:20px;background:#f1c40f;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;font-weight:bold;">RESUME</button>
        <button id="btn-restart" style="padding:10px 40px;font-size:18px;background:transparent;color:#f1c40f;border:2px solid #f1c40f;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;">RESTART</button>
        <button id="btn-menu" style="padding:10px 40px;font-size:18px;background:transparent;color:#aaa;border:2px solid #aaa;border-radius:8px;cursor:pointer;margin:10px;font-family:monospace;">MAIN MENU</button>
      </div>
    `;
    this.container.style.pointerEvents = 'auto';
    document.getElementById('btn-resume')!.onclick = onResume;
    document.getElementById('btn-restart')!.onclick = onRestart;
    document.getElementById('btn-menu')!.onclick = onMainMenu;
    this.visible = true;
  }

  showProgression(progress: any, onBack?: () => void) {
    this.container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;font-family:monospace;overflow-y:auto;">
        <h1 style="font-size:36px;margin-bottom:20px;">CAREER</h1>
        <div style="margin-bottom:20px;">
          <div style="font-size:24px;color:#f1c40f;">Level ${progress.level}</div>
          <div style="font-size:14px;color:#aaa;">XP: ${progress.xp} / ${LEVEL_XP_REQUIREMENTS[progress.level - 1] || 'MAX'}</div>
          <div style="width:300px;height:20px;background:#333;margin-top:5px;border-radius:4px;">
            <div style="width:${(progress.xp / (LEVEL_XP_REQUIREMENTS[progress.level - 1] || 1)) * 100}%;height:100%;background:#f1c40f;border-radius:4px;"></div>
          </div>
        </div>
        <div style="margin-bottom:20px;text-align:center;">
          <div>Matches: ${progress.matchesPlayed} | Wins: ${progress.wins} | Kills: ${progress.kills}</div>
          <div>Top 3: ${progress.top3} | Season Pass Tier: ${progress.seasonPassTier}</div>
        </div>
        <div style="max-width:500px;width:100%;">
          <h2 style="font-size:18px;color:#f1c40f;">CHALLENGES</h2>
          ${progress.challenges.map((c: any) => `
            <div style="padding:10px;margin:5px 0;background:${c.completed ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)'};border-radius:4px;">
              <div style="font-weight:bold;">${c.title} ${c.completed ? '✓' : ''}</div>
              <div style="font-size:12px;color:#aaa;">${c.description}</div>
              <div style="font-size:12px;">${c.progress} / ${c.target} (+${c.xpReward} XP)</div>
            </div>
          `).join('')}
        </div>
        <button id="btn-back" style="padding:10px 40px;font-size:16px;background:transparent;color:#f1c40f;border:2px solid #f1c40f;border-radius:8px;cursor:pointer;margin-top:20px;font-family:monospace;">BACK</button>
      </div>
    `;
    this.container.style.pointerEvents = 'auto';
    document.getElementById('btn-back')!.onclick = () => {
      if (onBack) onBack();
      else this.showMainMenu(() => {}, () => {});
    };
  }

  hide() {
    this.container.innerHTML = '';
    this.container.style.pointerEvents = 'none';
    this.visible = false;
  }

  isVisible(): boolean { return this.visible; }
}
