import { SERVER_CONFIG } from '../config.js';

export class ServerCombatSystem {
  validateHit(attacker, target, data) {
    if (!attacker || !target || !attacker.alive || !target.alive) return false;
    if (attacker.sessionId === target.sessionId) return false;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 800) return false;
    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = Math.abs(angleToTarget - (attacker.rotation || 0));
    angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
    if (angleDiff > Math.PI / 2) return false;
    return true;
  }

  applyDamage(target, damage) {
    if (!target || !target.alive) return;
    if (target.shield > 0) {
      const sd = Math.min(target.shield, damage);
      target.shield -= sd;
      damage -= sd;
    }
    target.health -= damage;
    if (target.health <= 0) {
      target.health = 0;
      target.alive = false;
    }
  }
}
