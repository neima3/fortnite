import { GameEngine } from './GameEngine.js';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

const engine = new GameEngine(canvas);
engine.start();
