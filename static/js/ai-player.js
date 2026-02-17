/**
 * AI Ghost player that autonomously navigates levels.
 * Uses rule-based decision making: moves forward, jumps over gaps
 * and obstacles, stomps enemies, and collects coins.
 * Rendered as a semi-transparent ghost overlay.
 * Difficulty scales with level: speed, look-ahead, and reaction improve.
 */

import { FRICTION, TILE_SIZE, SOLID_TILES } from './engine.js';
import { renderSprite } from './sprites.js';

const AI_BASE_SPEED = 2.5;
const AI_JUMP_FORCE = -10;
const AI_BASE_LOOK_AHEAD = 6;
const AI_BASE_REACTION_DELAY = 8;

class AIPlayer {
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
    this.score = 0;
    this.coins = 0;
    this.finished = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.frameCount = 0;
    this.deathTimer = 0;
    this._headHitCallbacks = [];
    this._approachSpeed = 0;
    // Difficulty-scaled stats (defaults = level 1)
    this._moveSpeed = AI_BASE_SPEED;
    this._lookAhead = AI_BASE_LOOK_AHEAD;
    this._reactionDelay = AI_BASE_REACTION_DELAY;
    this._difficultyLevel = 0;
  }

  /**
   * Scale AI difficulty based on current level index.
   * Higher levels = faster, better look-ahead, quicker reactions.
   */
  setDifficulty(levelIndex) {
    this._difficultyLevel = levelIndex;
    // Speed: 2.5 → caps at 4.5
    this._moveSpeed = Math.min(4.5, AI_BASE_SPEED + levelIndex * 0.15);
    // Look-ahead: 6 → caps at 10
    this._lookAhead = Math.min(10, AI_BASE_LOOK_AHEAD + Math.floor(levelIndex * 0.4));
    // Reaction delay: 8 → min 3 (lower = faster reactions)
    this._reactionDelay = Math.max(3, AI_BASE_REACTION_DELAY - Math.floor(levelIndex * 0.5));
  }

  onHeadHitBlock(callback) {
    this._headHitCallbacks.push(callback);
  }

  onHeadHit(col, row) {
    for (const cb of this._headHitCallbacks) {
      cb(col, row);
    }
  }

  update(levelData, entities) {
    if (!this.alive) {
      this.deathTimer++;
      this.vy += 0.4;
      this.y += this.vy;
      return null;
    }
    if (this.finished) return null;

    this.frameCount++;
    const input = this._decide(levelData, entities);

    if (input.left) {
      this.vx = -this._moveSpeed;
      this.facing = -1;
    } else if (input.right) {
      this.vx = this._moveSpeed;
      this.facing = 1;
    } else if (this._approachSpeed > 0) {
      // Controlled approach towards enemy
      this.vx = this._approachSpeed;
      this.facing = 1;
    } else {
      this.vx *= FRICTION;
    }

    let sfx = null;
    if (input.jump && this.onGround) {
      this.vy = AI_JUMP_FORCE;
      this.onGround = false;
      sfx = 'jump';
    }

    this.animTimer++;
    if (this.animTimer > 6) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    return sfx;
  }

  _decide(levelData, entities) {
    const input = { left: false, right: false, jump: false };

    input.right = true;

    const col = Math.floor((this.x + this.w / 2) / TILE_SIZE);
    const row = Math.floor((this.y + this.h) / TILE_SIZE);

    // Always check for gaps and edges - critical for survival
    if (this._isGapAhead(levelData, col, row)) {
      input.jump = true;
    }

    // Check ground directly below current position
    if (this.onGround && this._isEdgeBelow(levelData, col, row)) {
      input.jump = true;
    }

    if (this._isWallAhead(levelData, col, row)) {
      input.jump = true;
    }

    // Only do advanced decisions (enemies, coins) outside reaction delay
    if (this.frameCount % this._reactionDelay >= 2) {
      const nearestEnemy = this._findNearestEnemy(entities);
      if (nearestEnemy) {
        const dx = nearestEnemy.x - this.x;
        if (dx > 0 && dx < 80) {
          // Slow down when approaching enemy to line up stomp
          input.right = false;
          input.left = false;
          this._approachSpeed = Math.max(0.8, dx / 40);
        }
        // Jump when close enough to land on the enemy (~20-35px)
        if (dx > 0 && dx < 35 && this.onGround) {
          input.jump = true;
          input.right = true;
        }
        // Enemy behind - jump to avoid
        if (dx < 0 && dx > -25) {
          input.jump = true;
          input.right = true;
        }
      } else {
        this._approachSpeed = 0;
      }

      const nearestCoin = this._findNearestCoin(entities);
      if (nearestCoin) {
        const dx = nearestCoin.x - this.x;
        const dy = nearestCoin.y - this.y;
        if (dy < -20 && Math.abs(dx) < 40 && this.onGround) {
          input.jump = true;
        }
        if (dx < -10 && Math.abs(dy) < 30) {
          input.left = true;
          input.right = false;
          this.facing = -1;
        }
      }

      if (Math.random() < 0.01 && this.onGround) {
        input.jump = true;
      }
    }

    return input;
  }

  _isEdgeBelow(levelData, col, row) {
    // Check if the next 1-2 tiles ahead have no ground immediately below
    const checkCol = col + 1;
    if (checkCol < 0 || row >= levelData.length || checkCol >= levelData[0].length) return false;
    if (row < levelData.length && !SOLID_TILES.has(levelData[row][checkCol])) {
      // No ground at feet level for next tile
      if (row + 1 >= levelData.length || !SOLID_TILES.has(levelData[row + 1][checkCol])) {
        return true;
      }
    }
    return false;
  }

  _isGapAhead(levelData, col, row) {
    for (let i = 1; i <= this._lookAhead; i++) {
      const checkCol = col + i;
      if (checkCol >= 0 && row < levelData.length && checkCol < levelData[0].length) {
        let hasGround = false;
        for (let r = row; r < Math.min(row + 3, levelData.length); r++) {
          if (SOLID_TILES.has(levelData[r][checkCol])) {
            hasGround = true;
            break;
          }
        }
        if (!hasGround) return true;
      }
    }
    return false;
  }

  _isWallAhead(levelData, col, row) {
    const checkCol = col + this.facing;
    const checkRow = row - 1;
    if (checkRow >= 0 && checkCol >= 0 && checkRow < levelData.length &&
        checkCol < levelData[0].length) {
      return SOLID_TILES.has(levelData[checkRow][checkCol]);
    }
    return false;
  }

  _findNearestEnemy(entities) {
    let nearest = null;
    let minDist = 100;
    for (const e of entities) {
      if (e.type !== 'enemy' || !e.alive) continue;
      const dist = Math.abs(e.x - this.x);
      if (dist < minDist) {
        minDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }

  _findNearestCoin(entities) {
    let nearest = null;
    let minDist = 80;
    for (const e of entities) {
      if (e.type !== 'coin' || e.collected) continue;
      const dist = Math.abs(e.x - this.x) + Math.abs(e.y - this.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }

  die() {
    this.alive = false;
    this.vy = -8;
    this.vx = 0;
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.finished = false;
  }

  addScore(points) { this.score += points; }
  addCoin() { this.coins++; this.score += 100; }

  getSpriteName() {
    if (!this.onGround) return 'hero_jump';
    if (Math.abs(this.vx) > 0.5) return this.animFrame === 0 ? 'hero_run1' : 'hero_stand';
    return 'hero_stand';
  }

  render(ctx, camera) {
    if (!this.alive) return;

    const sprite = renderSprite(this.getSpriteName(), 1);
    if (!sprite) return;

    const drawX = Math.round(this.x - camera.x);
    const drawY = Math.round(this.y - camera.y);

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.filter = 'hue-rotate(180deg)';
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

export { AIPlayer };
