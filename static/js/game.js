/**
 * Main game controller. Manages the game loop, state transitions,
 * entity interactions, level progression, and rendering.
 */

import { Camera, PhysicsEngine, TILE_SIZE } from './engine.js';
import { renderSprite } from './sprites.js';
import { InputManager } from './input.js';
import { parseLevel, getLevelCount } from './levels.js';
import { Player } from './player.js';
import { AIPlayer } from './ai-player.js';
import { Enemy, Coin, Flag, FloatingText, Particle, createBrickParticles } from './entities.js';
import { audioManager } from './audio.js';
import { trackGameStart, trackLevelComplete, trackGameOver, submitScore, getUser } from './services.js';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 224;
const STATES = { READY: 0, PLAYING: 1, PAUSED: 2, LEVEL_COMPLETE: 3, GAME_OVER: 4, WIN: 5 };

class Game {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options || {};
    this.aiMode = this.options.aiMode || false;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    this.ctx.imageSmoothingEnabled = false;

    this.input = new InputManager();
    this.physics = new PhysicsEngine([], TILE_SIZE);
    this.camera = new Camera(CANVAS_WIDTH, CANVAS_HEIGHT, 0, 0);

    this.state = STATES.READY;
    this.currentLevel = 0;
    this.level = null;
    this.player = null;
    this.aiPlayer = null;
    this.enemies = [];
    this.coins = [];
    this.flags = [];
    this.floatingTexts = [];
    this.particles = [];
    this.timer = 0;
    this.frameCount = 0;
    this.readyTimer = 90;
    this.deathCount = 0;
    this.stompCount = 0;

    this._rafId = null;
    this._lastTime = 0;
    this._accumulator = 0;
    this._step = 1000 / 60;

    this._announcer = null;

    this.input.bind(document);
  }

  setAnnouncer(el) {
    this._announcer = el;
  }

  _announce(msg) {
    if (this._announcer) {
      this._announcer.textContent = msg;
    }
  }

  start() {
    audioManager.init();
    this.loadLevel(0);
    this.state = STATES.READY;
    this.readyTimer = 90;
    this._announce(`${this.level.name}. Get ready!`);
    this._loop(performance.now());
  }

  loadLevel(index) {
    this.currentLevel = index;
    const data = parseLevel(index);
    if (!data) return;

    this.level = data;
    this.physics.setLevel(data.tiles);
    this.camera = new Camera(CANVAS_WIDTH, CANVAS_HEIGHT, data.width, data.height);

    this.player = new Player(data.playerStart.x, data.playerStart.y);
    this.player.onHeadHitBlock((col, row) => this._onBlockHit(col, row, this.player));

    if (this.aiMode) {
      this.aiPlayer = new AIPlayer(data.aiStart.x, data.aiStart.y);
      this.aiPlayer.onHeadHitBlock((col, row) => this._onBlockHit(col, row, this.aiPlayer));
    } else {
      this.aiPlayer = null;
    }

    this.enemies = [];
    this.coins = [];
    this.flags = [];
    this.floatingTexts = [];
    this.particles = [];
    this.timer = data.time * 60;

    for (const e of data.entities) {
      switch (e.type) {
        case 'enemy':
          this.enemies.push(new Enemy(e.x, e.y, e.subtype));
          break;
        case 'coin':
          this.coins.push(new Coin(e.x, e.y));
          break;
        case 'flag':
          this.flags.push(new Flag(e.x, e.y));
          break;
      }
    }

    trackGameStart(this.aiMode ? 'ai' : 'solo', index + 1);
  }

  _loop(timestamp) {
    this._rafId = requestAnimationFrame((t) => this._loop(t));

    const delta = timestamp - this._lastTime;
    this._lastTime = timestamp;
    this._accumulator += Math.min(delta, 100);

    while (this._accumulator >= this._step) {
      this._update();
      this._accumulator -= this._step;
    }

    this._render();
  }

  _update() {
    this.frameCount++;

    if (this.state === STATES.READY) {
      this.readyTimer--;
      if (this.readyTimer <= 0) {
        this.state = STATES.PLAYING;
        this._announce('Go!');
      }
      this.input.clearJustPressed();
      return;
    }

    if (this.state === STATES.PAUSED) {
      if (this.input.pause) {
        this.state = STATES.PLAYING;
        this._announce('Game resumed');
      }
      this.input.clearJustPressed();
      return;
    }

    if (this.state === STATES.LEVEL_COMPLETE || this.state === STATES.GAME_OVER || this.state === STATES.WIN) {
      if (this.input.isJustPressed('Enter') || this.input.isJustPressed(' ')) {
        if (this.state === STATES.LEVEL_COMPLETE) {
          this._nextLevel();
        } else if (this.state === STATES.GAME_OVER || this.state === STATES.WIN) {
          this._restart();
        }
      }
      this.input.clearJustPressed();
      return;
    }

    if (this.input.pause) {
      this.state = STATES.PAUSED;
      this._announce('Game paused');
      this.input.clearJustPressed();
      return;
    }

    this.timer--;
    if (this.timer <= 0) {
      this.player.die();
      audioManager.death();
      this._announce('Time up!');
    }

    const sfx = this.player.update(this.input);
    if (sfx === 'jump') audioManager.jump();

    this.physics.applyGravity(this.player);
    this.physics.resolveCollisions(this.player);

    if (this.player.x < 0) this.player.x = 0;
    if (this.player.y > this.level.height + 32) {
      if (this.player.alive) {
        this.player.die();
        audioManager.death();
        this._announce('You fell!');
      }
    }

    if (this.aiPlayer && this.aiPlayer.alive) {
      this.aiPlayer.update(this.level.tiles, [...this.enemies, ...this.coins]);
      this.physics.applyGravity(this.aiPlayer);
      this.physics.resolveCollisions(this.aiPlayer);
      if (this.aiPlayer.y > this.level.height + 32) {
        this.aiPlayer.die();
      }
    }

    for (const enemy of this.enemies) {
      enemy.update();
      this.physics.applyGravity(enemy);
      this.physics.resolveCollisions(enemy);
    }

    this._checkCollisions();

    this.camera.follow(this.player);

    for (const coin of this.coins) coin.update();
    this.floatingTexts = this.floatingTexts.filter((ft) => { ft.update(); return !ft.expired; });
    this.particles = this.particles.filter((p) => { p.update(); return !p.expired; });

    if (!this.player.alive && this.player.deathTimer > 90) {
      if (this.player.lives > 0) {
        this.player.respawn(this.level.playerStart.x, this.level.playerStart.y);
        if (this.aiPlayer) {
          this.aiPlayer.respawn(this.level.aiStart.x, this.level.aiStart.y);
        }
        this._announce(`Lives remaining: ${this.player.lives}`);
      } else {
        this.state = STATES.GAME_OVER;
        audioManager.gameOver();
        trackGameOver(this.player.score, this.currentLevel + 1, this.player.coins);
        this._announce('Game over! Press Enter to restart.');
        this._submitHighScore();
      }
    }

    this.input.clearJustPressed();
  }

  _checkCollisions() {
    if (!this.player.alive) return;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (!this.physics.checkEntityCollision(this.player, enemy)) continue;

      if (this.player.vy > 0 && this.player.y + this.player.h - enemy.y < 14) {
        enemy.stomp();
        this.player.vy = -7;
        this.player.addScore(200);
        this.stompCount++;
        audioManager.stomp();
        this.floatingTexts.push(new FloatingText(enemy.x, enemy.y, '200', '#FFFFFF'));
        this._announce('Enemy stomped! 200 points');
      } else {
        if (this.player.die()) {
          this.deathCount++;
          audioManager.death();
          this._announce('Hit by enemy!');
        }
      }
    }

    if (this.aiPlayer && this.aiPlayer.alive) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (!this.physics.checkEntityCollision(this.aiPlayer, enemy)) continue;
        if (this.aiPlayer.vy > 0 && this.aiPlayer.y + this.aiPlayer.h - enemy.y < 10) {
          enemy.stomp();
          this.aiPlayer.vy = -7;
          this.aiPlayer.addScore(200);
        } else {
          this.aiPlayer.die();
        }
      }
    }

    for (const coin of this.coins) {
      if (coin.collected) continue;
      if (this.physics.checkEntityCollision(this.player, coin)) {
        coin.collect();
        this.player.addCoin();
        audioManager.coin();
        this.floatingTexts.push(new FloatingText(coin.x, coin.y, '100', '#FBD000'));
        this._announce(`Coin collected! Total: ${this.player.coins}`);
      }
      if (this.aiPlayer && this.aiPlayer.alive && !coin.collected) {
        if (this.physics.checkEntityCollision(this.aiPlayer, coin)) {
          coin.collect();
          this.aiPlayer.addCoin();
        }
      }
    }

    for (const flag of this.flags) {
      if (flag.reached) continue;
      if (this.physics.checkEntityCollision(this.player, flag)) {
        flag.reached = true;
        this.player.finished = true;
        const timeBonus = Math.floor(this.timer / 60) * 50;
        this.player.addScore(1000 + timeBonus);
        audioManager.levelComplete();
        this.floatingTexts.push(new FloatingText(flag.x, flag.y - 20, `+${1000 + timeBonus}`, '#00FF00'));

        trackLevelComplete(this.currentLevel + 1, this.player.score, Math.floor(this.timer / 60));

        setTimeout(() => {
          if (this.currentLevel + 1 < getLevelCount()) {
            this.state = STATES.LEVEL_COMPLETE;
            this._announce(`Level complete! Score: ${this.player.score}. Press Enter to continue.`);
          } else {
            this.state = STATES.WIN;
            this._announce(`You win! Final score: ${this.player.score}. Press Enter to play again.`);
            this._submitHighScore();
          }
        }, 1500);
      }

      if (this.aiPlayer && this.aiPlayer.alive && !flag.reached) {
        if (this.physics.checkEntityCollision(this.aiPlayer, flag)) {
          this.aiPlayer.finished = true;
          this.aiPlayer.addScore(1000);
        }
      }
    }
  }

  _onBlockHit(col, row, hitter) {
    const tile = this.level.tiles[row][col];

    if (tile === '?') {
      this.level.tiles[row][col] = '=';
      hitter.addScore(50);
      hitter.addCoin();
      audioManager.coin();
      this.floatingTexts.push(new FloatingText(col * TILE_SIZE, row * TILE_SIZE - 10, '50', '#FBD000'));
      if (hitter === this.player) {
        this._announce('Question block! 50 points and a coin');
      }
    } else if (tile === 'B') {
      this.level.tiles[row][col] = '.';
      audioManager.blockHit();
      this.particles.push(...createBrickParticles(col * TILE_SIZE, row * TILE_SIZE));
    }
  }

  _nextLevel() {
    const savedScore = this.player.score;
    const savedCoins = this.player.coins;
    const savedLives = this.player.lives;
    this.loadLevel(this.currentLevel + 1);
    this.player.score = savedScore;
    this.player.coins = savedCoins;
    this.player.lives = savedLives;
    this.state = STATES.READY;
    this.readyTimer = 90;
    this._announce(`${this.level.name}. Get ready!`);
  }

  _restart() {
    this.loadLevel(0);
    this.state = STATES.READY;
    this.readyTimer = 90;
    this._announce('Game restarted. Get ready!');
  }

  async _submitHighScore() {
    const user = getUser();
    if (user && this.player.score > 0) {
      await submitScore(
        this.player.score,
        this.currentLevel + 1,
        this.player.coins,
        this.aiMode ? 'ai' : 'solo'
      );
    }
  }

  _render() {
    const ctx = this.ctx;

    ctx.fillStyle = this.level ? this.level.sky : '#5C94FC';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (!this.level) return;

    this._renderTiles(ctx);

    for (const coin of this.coins) coin.render(ctx, this.camera);
    for (const flag of this.flags) flag.render(ctx, this.camera);
    for (const enemy of this.enemies) enemy.render(ctx, this.camera);

    if (this.aiPlayer) this.aiPlayer.render(ctx, this.camera);
    if (this.player) this.player.render(ctx, this.camera);

    for (const ft of this.floatingTexts) ft.render(ctx, this.camera);
    for (const p of this.particles) p.render(ctx, this.camera);

    this._renderHUD(ctx);

    if (this.state === STATES.READY) this._renderOverlay(ctx, this.level.name, 'Get Ready!');
    if (this.state === STATES.PAUSED) this._renderOverlay(ctx, 'PAUSED', 'Press ESC to resume');
    if (this.state === STATES.LEVEL_COMPLETE) this._renderOverlay(ctx, 'LEVEL CLEAR!', 'Press ENTER to continue');
    if (this.state === STATES.GAME_OVER) this._renderOverlay(ctx, 'GAME OVER', `Score: ${this.player.score} | Press ENTER`);
    if (this.state === STATES.WIN) this._renderOverlay(ctx, 'YOU WIN!', `Final Score: ${this.player.score} | Press ENTER`);
  }

  _renderTiles(ctx) {
    const startCol = Math.floor(this.camera.x / TILE_SIZE);
    const endCol = Math.ceil((this.camera.x + CANVAS_WIDTH) / TILE_SIZE);
    const startRow = Math.floor(this.camera.y / TILE_SIZE);
    const endRow = Math.ceil((this.camera.y + CANVAS_HEIGHT) / TILE_SIZE);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r < 0 || r >= this.level.rows || c < 0 || c >= this.level.cols) continue;
        const tile = this.level.tiles[r][c];
        const drawX = c * TILE_SIZE - Math.round(this.camera.x);
        const drawY = r * TILE_SIZE - Math.round(this.camera.y);

        let spriteName = null;
        switch (tile) {
          case '#': spriteName = 'ground'; break;
          case 'B': spriteName = 'brick'; break;
          case '?': spriteName = 'question_block'; break;
          case '=': spriteName = 'used_block'; break;
          case 'P': spriteName = 'pipe_top_l'; break;
          case 'p': spriteName = 'pipe_top_l'; break;
        }

        if (spriteName) {
          const sprite = renderSprite(spriteName, 1);
          if (sprite) ctx.drawImage(sprite, drawX, drawY, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  _renderHUD(ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px monospace';

    ctx.textAlign = 'left';
    ctx.fillText(`SCORE`, 8, 10);
    ctx.fillText(`${this.player.score.toString().padStart(6, '0')}`, 8, 20);

    ctx.fillText(`COINS`, 80, 10);
    ctx.fillText(`x${this.player.coins.toString().padStart(2, '0')}`, 80, 20);

    ctx.textAlign = 'center';
    ctx.fillText(this.level.name, CANVAS_WIDTH / 2, 10);
    ctx.fillText(`TIME: ${Math.max(0, Math.floor(this.timer / 60))}`, CANVAS_WIDTH / 2, 20);

    ctx.textAlign = 'right';
    ctx.fillText(`LIVES`, CANVAS_WIDTH - 8, 10);
    ctx.fillText(`x${this.player.lives}`, CANVAS_WIDTH - 8, 20);

    if (this.aiMode && this.aiPlayer) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#88CCFF';
      ctx.fillText(`AI: ${this.aiPlayer.score.toString().padStart(6, '0')}`, 8, 32);
    }
  }

  _renderOverlay(ctx, title, subtitle) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);

    ctx.font = '8px monospace';
    ctx.fillText(subtitle, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 12);
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.input.destroy();
  }
}

export { Game, STATES, CANVAS_WIDTH, CANVAS_HEIGHT };
