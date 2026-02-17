/**
 * Remote player renderer for multiplayer mode.
 * Receives position data from the server and interpolates
 * for smooth rendering. Rendered as a green-tinted ghost.
 */

import { renderSprite } from './sprites.js';

class RemotePlayer {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 16;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.alive = true;
    this.score = 0;
    this.finished = false;

    // Interpolation targets
    this._targetX = x;
    this._targetY = y;
    this._lerpSpeed = 0.3;

    this.animFrame = 0;
    this.animTimer = 0;
  }

  applyUpdate(data) {
    this._targetX = data.x;
    this._targetY = data.y;
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    this.facing = data.facing || 1;
    this.onGround = data.onGround || false;
    this.alive = data.alive !== false;
    this.score = data.score || 0;
    this.finished = data.finished || false;
  }

  update() {
    // Lerp toward target position for smooth movement
    this.x += (this._targetX - this.x) * this._lerpSpeed;
    this.y += (this._targetY - this.y) * this._lerpSpeed;

    // Animation
    if (Math.abs(this.vx) > 0.5) {
      this.animTimer++;
      if (this.animTimer > 6) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 2;
      }
    } else {
      this.animFrame = 0;
      this.animTimer = 0;
    }
  }

  getSpriteName() {
    if (!this.onGround) return 'hero_jump';
    if (Math.abs(this.vx) > 0.5) return 'hero_run1';
    return 'hero_stand';
  }

  render(ctx, camera) {
    if (!this.alive) return;

    const sprite = renderSprite(this.getSpriteName(), 1);
    if (!sprite) return;

    const drawX = Math.round(this.x - camera.x);
    const drawY = Math.round(this.y - camera.y);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.filter = 'hue-rotate(90deg)';
    if (this.facing === -1) {
      ctx.translate(drawX + this.w, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0);
    } else {
      ctx.drawImage(sprite, drawX, drawY);
    }
    ctx.restore();

    // P2 label
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('P2', drawX + this.w / 2, drawY - 4);
    ctx.restore();
  }
}

export { RemotePlayer };
