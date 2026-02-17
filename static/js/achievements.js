/**
 * Achievement system with toast notifications.
 * Checks game stats against achievement conditions and shows
 * gold-bordered popups on unlock.
 */

import { progressStorage } from './storage.js';

const ACHIEVEMENTS = [
  { id: 'first_stomp', name: 'First Stomp', desc: 'Stomp your first enemy', check: (s) => s.totalStomps >= 1 },
  { id: 'stomp_master', name: 'Stomp Master', desc: 'Stomp 10 enemies total', check: (s) => s.totalStomps >= 10 },
  { id: 'stomp_legend', name: 'Stomp Legend', desc: 'Stomp 50 enemies total', check: (s) => s.totalStomps >= 50 },
  { id: 'coin_10', name: 'Coin Collector', desc: 'Collect 10 coins total', check: (s) => s.totalCoins >= 10 },
  { id: 'coin_100', name: 'Coin Hoarder', desc: 'Collect 100 coins total', check: (s) => s.totalCoins >= 100 },
  { id: 'coin_1000', name: 'Coin King', desc: 'Collect 1000 coins total', check: (s) => s.totalCoins >= 1000 },
  { id: 'level_3', name: 'World Traveler', desc: 'Complete 3 levels', check: (s) => s.highestLevel >= 3 },
  { id: 'level_5', name: 'Adventurer', desc: 'Complete 5 levels', check: (s) => s.highestLevel >= 5 },
  { id: 'level_10', name: 'Marathon Runner', desc: 'Complete 10 levels', check: (s) => s.highestLevel >= 10 },
  { id: 'untouchable', name: 'Untouchable', desc: 'Complete a level without dying', check: (s) => s.noDeathLevel },
  { id: 'speed_demon', name: 'Speed Demon', desc: 'Finish a level with 200+ seconds left', check: (s) => s.timeRemaining >= 200 },
];

class AchievementManager {
  constructor() {
    this._toastQueue = [];
    this._currentToast = null;
    this._toastTimer = 0;
  }

  checkAll(stats) {
    const newUnlocks = [];
    for (const ach of ACHIEVEMENTS) {
      if (progressStorage.hasAchievement(ach.id)) continue;
      if (ach.check(stats)) {
        if (progressStorage.unlockAchievement(ach.id)) {
          newUnlocks.push(ach);
          this._toastQueue.push(ach);
        }
      }
    }
    return newUnlocks;
  }

  update() {
    if (this._currentToast) {
      this._toastTimer--;
      if (this._toastTimer <= 0) {
        this._currentToast = null;
      }
    }
    if (!this._currentToast && this._toastQueue.length > 0) {
      this._currentToast = this._toastQueue.shift();
      this._toastTimer = 180; // 3 seconds
    }
  }

  render(ctx, canvasWidth) {
    if (!this._currentToast) return;

    const alpha = Math.min(1, this._toastTimer / 20, (180 - (180 - this._toastTimer)) / 20);
    const toastW = 180;
    const toastH = 36;
    const toastX = canvasWidth - toastW - 8;
    const toastY = 50;

    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);

    // Gold border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(toastX, toastY, toastW, toastH, 4);
    ctx.fill();
    ctx.stroke();

    // Trophy icon
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('UNLOCKED', toastX + 6, toastY + 12);

    // Achievement name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(this._currentToast.name, toastX + 6, toastY + 24);

    // Description
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '6px monospace';
    ctx.fillText(this._currentToast.desc, toastX + 6, toastY + 33);

    ctx.restore();
  }

  getAll() {
    return ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: progressStorage.hasAchievement(ach.id),
    }));
  }
}

const achievementManager = new AchievementManager();

export { AchievementManager, achievementManager, ACHIEVEMENTS };
