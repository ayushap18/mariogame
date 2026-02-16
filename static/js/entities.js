/**
 * Game entities: enemies, coins, floating score text, and particles.
 */

import { renderSprite } from './sprites.js';

class Enemy {
  constructor(x, y, subtype) {
    this.type = 'enemy';
    this.subtype = subtype || 'goomba';
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 14;
    this.vx = -1;
    this.vy = 0;
    this.startX = x;
    this.alive = true;
    this.onGround = false;
    this.squishTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.patrolRange = 80;
  }

  update() {
    if (!this.alive) {
      this.squishTimer++;
      return;
    }

    this.x += this.vx;

    if (Math.abs(this.x - this.startX) > this.patrolRange) {
      this.vx *= -1;
    }

    this.animTimer++;
    if (this.animTimer > 10) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }
  }

  stomp() {
    this.alive = false;
    this.squishTimer = 0;
    this.h = 8;
  }

  render(ctx, camera) {
    if (this.squishTimer > 30) return;

    const drawX = Math.round(this.x - camera.x);
    const drawY = Math.round(this.y - camera.y);

    if (!this.alive) {
      const sprite = renderSprite('goomba', 1);
      if (sprite) {
        ctx.save();
        ctx.globalAlpha = 1 - (this.squishTimer / 30);
        ctx.drawImage(sprite, drawX, drawY + 8, 16, 8);
        ctx.restore();
      }
      return;
    }

    const sprite = renderSprite('goomba', 1);
    if (sprite) {
      ctx.save();
      if (this.vx > 0) {
        ctx.translate(drawX + this.w, drawY);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0);
      } else {
        ctx.drawImage(sprite, drawX, drawY);
      }
      ctx.restore();
    }
  }
}

class Coin {
  constructor(x, y) {
    this.type = 'coin';
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 14;
    this.collected = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.floatOffset = 0;
  }

  update() {
    if (this.collected) return;
    this.animTimer++;
    this.floatOffset = Math.sin(this.animTimer * 0.08) * 3;
  }

  collect() {
    this.collected = true;
  }

  render(ctx, camera) {
    if (this.collected) return;

    const drawX = Math.round(this.x - camera.x + 2);
    const drawY = Math.round(this.y - camera.y + this.floatOffset);

    const sprite = renderSprite('coin', 1);
    if (sprite) {
      ctx.drawImage(sprite, drawX, drawY);
    }
  }
}

class Flag {
  constructor(x, y) {
    this.type = 'flag';
    this.x = x;
    this.y = y;
    this.w = 16;
    this.h = 16;
    this.reached = false;
  }

  render(ctx, camera) {
    const drawX = Math.round(this.x - camera.x);
    const baseY = Math.round(this.y - camera.y);

    const sprite = renderSprite('flag_pole', 1);
    for (let i = 0; i < 8; i++) {
      if (sprite) {
        ctx.drawImage(sprite, drawX, baseY + i * 16);
      }
    }

    ctx.fillStyle = '#00FF00';
    ctx.fillRect(drawX + 2, baseY, 8, 10);
  }
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color || '#FFFFFF';
    this.life = 40;
    this.vy = -1.5;
  }

  update() {
    this.y += this.vy;
    this.life--;
  }

  get expired() {
    return this.life <= 0;
  }

  render(ctx, camera) {
    const drawX = Math.round(this.x - camera.x);
    const drawY = Math.round(this.y - camera.y);
    const alpha = Math.min(1, this.life / 15);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, drawX, drawY);
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life || 20;
    this.maxLife = this.life;
    this.size = 2 + Math.random() * 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15;
    this.life--;
  }

  get expired() {
    return this.life <= 0;
  }

  render(ctx, camera) {
    const drawX = this.x - camera.x;
    const drawY = this.y - camera.y;
    const alpha = this.life / this.maxLife;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(drawX, drawY, this.size, this.size);
    ctx.restore();
  }
}

function createBrickParticles(x, y) {
  const particles = [];
  const colors = ['#C88448', '#6B3300', '#D2B48C'];
  for (let i = 0; i < 8; i++) {
    particles.push(new Particle(
      x + Math.random() * 16,
      y + Math.random() * 8,
      (Math.random() - 0.5) * 4,
      -Math.random() * 5 - 2,
      colors[Math.floor(Math.random() * colors.length)],
      30
    ));
  }
  return particles;
}

class Mushroom {
  constructor(x, y) {
    this.type = 'mushroom';
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 14;
    this.vx = 1.5;
    this.vy = 0;
    this.onGround = false;
    this.active = true;
    this.collected = false;
    this.spawnTimer = 0;
    this.spawnY = y;
  }

  update() {
    if (!this.active || this.collected) return;
    this.spawnTimer++;
    if (this.spawnTimer < 16) {
      this.y = this.spawnY - this.spawnTimer;
      return;
    }
    this.x += this.vx;
  }

  collect() {
    this.collected = true;
    this.active = false;
  }

  render(ctx, camera) {
    if (!this.active || this.collected) return;
    const drawX = Math.round(this.x - camera.x);
    const drawY = Math.round(this.y - camera.y);
    const sprite = renderSprite('mushroom', 1);
    if (sprite) ctx.drawImage(sprite, drawX, drawY);
  }
}

class StarPowerup {
  constructor(x, y) {
    this.type = 'star';
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 14;
    this.vx = 2;
    this.vy = 0;
    this.onGround = false;
    this.active = true;
    this.collected = false;
    this.spawnTimer = 0;
    this.spawnY = y;
    this.animTimer = 0;
  }

  update() {
    if (!this.active || this.collected) return;
    this.spawnTimer++;
    if (this.spawnTimer < 16) {
      this.y = this.spawnY - this.spawnTimer;
      return;
    }
    this.x += this.vx;
    this.animTimer++;
  }

  collect() {
    this.collected = true;
    this.active = false;
  }

  render(ctx, camera) {
    if (!this.active || this.collected) return;
    const drawX = Math.round(this.x - camera.x);
    const drawY = Math.round(this.y - camera.y);
    const twinkle = Math.floor(this.animTimer / 4) % 2 === 0;
    const sprite = renderSprite('star_powerup', 1);
    if (sprite) {
      ctx.save();
      if (twinkle) ctx.globalAlpha = 0.7;
      ctx.drawImage(sprite, drawX, drawY);
      ctx.restore();
    }
  }
}

function createPowerupParticles(x, y, color) {
  const particles = [];
  const colors = color === 'star'
    ? ['#FFD700', '#FFFF00', '#FFA500', '#FFFFFF']
    : ['#E52521', '#FFFFFF', '#FDB294'];
  for (let i = 0; i < 12; i++) {
    particles.push(new Particle(
      x + Math.random() * 16,
      y + Math.random() * 8,
      (Math.random() - 0.5) * 5,
      -Math.random() * 4 - 2,
      colors[Math.floor(Math.random() * colors.length)],
      35
    ));
  }
  return particles;
}

export { Enemy, Coin, Flag, FloatingText, Particle, Mushroom, StarPowerup, createBrickParticles, createPowerupParticles };
