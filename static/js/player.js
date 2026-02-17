/**
 * Player entity with movement, jumping, animation states, and head-hit callback.
 */

import { FRICTION, TILE_SIZE } from './engine.js';
import { renderSprite } from './sprites.js';

const MOVE_SPEED = 3;
const JUMP_FORCE = -10;
const SPRITE_SCALE = 1;

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 16;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.alive = true;
    this.animFrame = 0;
    this.animTimer = 0;
    this.score = 0;
    this.coins = 0;
    this.lives = 5;
    this.invincibleTimer = 0;
    this.deathTimer = 0;
    this.finished = false;
    this.starPower = false;
    this.hasFirePower = false;
    this.speedMultiplier = 1;
    this._headHitCallbacks = [];
  }

  onHeadHitBlock(callback) {
    this._headHitCallbacks.push(callback);
  }

  onHeadHit(col, row) {
    for (const cb of this._headHitCallbacks) {
      cb(col, row);
    }
  }

  update(input) {
    if (!this.alive) {
      this.deathTimer++;
      this.vy += 0.4;
      this.y += this.vy;
      return;
    }
    if (this.finished) return;

    if (this.invincibleTimer > 0) this.invincibleTimer--;

    if (input.left) {
      this.vx = -MOVE_SPEED * this.speedMultiplier;
      this.facing = -1;
    } else if (input.right) {
      this.vx = MOVE_SPEED * this.speedMultiplier;
      this.facing = 1;
    } else {
      this.vx *= FRICTION;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    if (input.jump && this.onGround) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
      return 'jump';
    }

    this.animTimer++;
    if (this.animTimer > 6) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    return null;
  }

  die() {
    if (this.invincibleTimer > 0 || this.starPower) return false;
    this.alive = false;
    this.vy = -8;
    this.vx = 0;
    this.lives--;
    return true;
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.invincibleTimer = 120;
    this.finished = false;
    this.starPower = false;
  }

  addScore(points) {
    this.score += points;
  }

  addCoin() {
    this.coins++;
    this.score += 100;
  }

  getSpriteName() {
    if (!this.onGround) return 'hero_jump';
    if (Math.abs(this.vx) > 0.5) return this.animFrame === 0 ? 'hero_run1' : 'hero_stand';
    return 'hero_stand';
  }

  render(ctx, camera) {
    if (!this.alive && this.deathTimer > 60) return;
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0) return;

    const sprite = renderSprite(this.getSpriteName(), SPRITE_SCALE);
    if (!sprite) return;

    const drawX = Math.round(this.x - camera.x);
    const drawY = Math.round(this.y - camera.y);

    ctx.save();
    if (this.facing === -1) {
      ctx.translate(drawX + this.w, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0);
    } else {
      ctx.drawImage(sprite, drawX, drawY);
    }
    ctx.restore();
  }
}

export { Player, MOVE_SPEED, JUMP_FORCE };
