/**
 * Physics and collision engine for the platformer game.
 * Handles gravity, AABB collision detection, tile-based collision response,
 * and camera tracking.
 */

const TILE_SIZE = 16;
const GRAVITY = 0.6;
const MAX_FALL_SPEED = 10;
const FRICTION = 0.85;

const SOLID_TILES = new Set(['#', 'B', '?', 'P', 'p', 'T', 't', '=']);

class Camera {
  constructor(width, height, worldWidth, worldHeight) {
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  follow(target) {
    this.x = target.x - this.width / 3;
    this.y = target.y - this.height / 2;
    this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.width));
    this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.height));
  }
}

class AABB {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  intersects(other) {
    return (
      this.x < other.x + other.w &&
      this.x + this.w > other.x &&
      this.y < other.y + other.h &&
      this.y + this.h > other.y
    );
  }
}

class PhysicsEngine {
  constructor(levelData, tileSize) {
    this.levelData = levelData;
    this.tileSize = tileSize || TILE_SIZE;
  }

  setLevel(levelData) {
    this.levelData = levelData;
  }

  getTile(col, row) {
    if (!this.levelData || row < 0 || row >= this.levelData.length) return '.';
    if (col < 0 || col >= this.levelData[0].length) return '.';
    return this.levelData[row][col];
  }

  isSolid(col, row) {
    return SOLID_TILES.has(this.getTile(col, row));
  }

  applyGravity(entity) {
    entity.vy += GRAVITY;
    if (entity.vy > MAX_FALL_SPEED) {
      entity.vy = MAX_FALL_SPEED;
    }
  }

  resolveCollisions(entity) {
    entity.onGround = false;

    this._resolveAxis(entity, 'x');
    this._resolveAxis(entity, 'y');
  }

  _resolveAxis(entity, axis) {
    const isX = axis === 'x';
    const pos = isX ? 'x' : 'y';
    const vel = isX ? 'vx' : 'vy';
    const size = isX ? 'w' : 'h';
    const otherPos = isX ? 'y' : 'x';
    const otherSize = isX ? 'h' : 'w';

    entity[pos] += entity[vel];

    const startCol = Math.floor(entity.x / this.tileSize);
    const endCol = Math.floor((entity.x + entity.w - 1) / this.tileSize);
    const startRow = Math.floor(entity.y / this.tileSize);
    const endRow = Math.floor((entity.y + entity.h - 1) / this.tileSize);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (!this.isSolid(col, row)) continue;

        const tileBox = new AABB(
          col * this.tileSize,
          row * this.tileSize,
          this.tileSize,
          this.tileSize
        );
        const entityBox = new AABB(entity.x, entity.y, entity.w, entity.h);

        if (!entityBox.intersects(tileBox)) continue;

        if (isX) {
          if (entity.vx > 0) {
            entity.x = tileBox.x - entity.w;
          } else if (entity.vx < 0) {
            entity.x = tileBox.x + this.tileSize;
          }
          entity.vx = 0;
        } else {
          if (entity.vy > 0) {
            entity.y = tileBox.y - entity.h;
            entity.onGround = true;
          } else if (entity.vy < 0) {
            entity.y = tileBox.y + this.tileSize;
            entity.onGround = false;
            if (entity.onHeadHit) {
              entity.onHeadHit(col, row);
            }
          }
          entity.vy = 0;
        }
      }
    }
  }

  checkEntityCollision(a, b) {
    const boxA = new AABB(a.x, a.y, a.w, a.h);
    const boxB = new AABB(b.x, b.y, b.w, b.h);
    return boxA.intersects(boxB);
  }
}

export { Camera, AABB, PhysicsEngine, TILE_SIZE, GRAVITY, MAX_FALL_SPEED, FRICTION, SOLID_TILES };
