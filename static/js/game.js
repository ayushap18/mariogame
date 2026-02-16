/**
 * Main game controller. Manages the game loop, state transitions,
 * entity interactions, level progression, rendering, AI commentary,
 * voice helper integration, power-ups, and CRT retro effects.
 */

import { Camera, PhysicsEngine, TILE_SIZE } from './engine.js';
import { renderSprite } from './sprites.js';
import { InputManager } from './input.js';
import { parseLevel, getLevelCount } from './levels.js';
import { Player } from './player.js';
import { AIPlayer } from './ai-player.js';
import { Enemy, Coin, Flag, FloatingText, Particle, Mushroom, StarPowerup, createBrickParticles, createPowerupParticles } from './entities.js';
import { audioManager } from './audio.js';
import { voiceHelper } from './voice.js';
import { trackGameStart, trackLevelComplete, trackGameOver, submitScore, getUser } from './services.js';
import { isGeminiAvailable, buildContext, getCommentary, getStrategyAnalysis, getLiveCoach } from './gemini.js';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 224;
const STATES = { READY: 0, PLAYING: 1, PAUSED: 2, LEVEL_COMPLETE: 3, GAME_OVER: 4, WIN: 5 };

class Game {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options || {};
    this.aiMode = this.options.aiMode || false;
    this.timeAttack = this.options.timeAttack || false;

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
    this.mushrooms = [];
    this.stars = [];
    this.floatingTexts = [];
    this.particles = [];
    this.timer = 0;
    this.frameCount = 0;
    this.readyTimer = 90;
    this.deathCount = 0;
    this.stompCount = 0;
    this.blockHitCount = 0;

    // AI commentary overlay
    this._commentaryText = '';
    this._commentaryTimer = 0;
    this._commentaryAlpha = 0;
    this._commentaryCooldown = 0;
    this._geminiReady = false;

    // Star power state
    this._starTimer = 0;

    // Combo system
    this._comboCount = 0;
    this._comboTimer = 0;
    this._comboMultiplier = 1;

    // Screen shake
    this._shakeTimer = 0;
    this._shakeIntensity = 0;

    // AI Live Coach
    this._coachTimer = 0;
    this._coachText = '';
    this._coachDisplayTimer = 0;

    // Retro background decorations (parallax clouds, hills, bushes)
    this._bgDecorations = this._generateBackgroundDecorations();

    this._rafId = null;
    this._lastTime = 0;
    this._accumulator = 0;
    this._step = 1000 / 60;

    this._announcer = null;

    this.input.bind(document);

    // Check Gemini availability
    isGeminiAvailable().then(ok => { this._geminiReady = ok; });
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
    this.mushrooms = [];
    this.stars = [];
    this.floatingTexts = [];
    this.particles = [];
    this.timer = this.timeAttack ? 90 * 60 : data.time * 60;

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

    if (this._commentaryTimer > 0) {
      this._commentaryTimer--;
      this._commentaryAlpha = Math.min(1, this._commentaryTimer / 20);
      if (this._commentaryTimer > 160) this._commentaryAlpha = Math.min(1, (180 - this._commentaryTimer) / 20);
    }
    if (this._commentaryCooldown > 0) this._commentaryCooldown--;

    if (this._starTimer > 0) {
      this._starTimer--;
      if (this._starTimer <= 0 && this.player) {
        this.player.starPower = false;
      }
    }

    // Combo timer decay
    if (this._comboTimer > 0) {
      this._comboTimer--;
      if (this._comboTimer <= 0) {
        this._comboCount = 0;
        this._comboMultiplier = 1;
      }
    }

    // Screen shake decay
    if (this._shakeTimer > 0) {
      this._shakeTimer--;
      this._shakeIntensity *= 0.85;
    }

    // AI Live Coach auto-trigger
    if (this._coachDisplayTimer > 0) this._coachDisplayTimer--;
    if (this._coachTimer > 0) {
      this._coachTimer--;
    } else if (this._geminiReady && this.state === STATES.PLAYING) {
      this._coachTimer = 900; // 15 seconds
      this._triggerCoach();
    }

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
    if (this.timer <= 0 && this.player.alive) {
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
        this._triggerCommentary('death');
      }
    }

    if (this.aiPlayer && this.aiPlayer.alive) {
      this.aiPlayer.update(this.level.tiles, [...this.enemies, ...this.coins]);
      this.physics.applyGravity(this.aiPlayer);
      this.physics.resolveCollisions(this.aiPlayer);
      if (this.aiPlayer.y > this.level.height + 32) {
        this.aiPlayer.die();
      }
    } else if (this.aiPlayer && !this.aiPlayer.alive) {
      // AI auto-respawn after death
      this.aiPlayer.update(this.level.tiles, []);
      if (this.aiPlayer.deathTimer > 60) {
        this.aiPlayer.respawn(this.level.aiStart.x, this.level.aiStart.y);
      }
    }

    for (const enemy of this.enemies) {
      enemy.update();
      this.physics.applyGravity(enemy);
      this.physics.resolveCollisions(enemy);
    }

    // Update power-ups
    for (const m of this.mushrooms) {
      m.update();
      if (m.spawnTimer >= 16 && m.active) {
        this.physics.applyGravity(m);
        this.physics.resolveCollisions(m);
      }
    }
    for (const s of this.stars) {
      s.update();
      if (s.spawnTimer >= 16 && s.active) {
        this.physics.applyGravity(s);
        this.physics.resolveCollisions(s);
      }
    }

    this._checkCollisions();

    this.camera.follow(this.player);

    for (const coin of this.coins) coin.update();
    this.floatingTexts = this.floatingTexts.filter((ft) => { ft.update(); return !ft.expired; });
    this.particles = this.particles.filter((p) => { p.update(); return !p.expired; });

    if (!this.player.alive && this.player.deathTimer > 90) {
      if (this.player.lives > 0) {
        this.player.respawn(this.level.playerStart.x, this.level.playerStart.y);
        this._starTimer = 0;
        if (this.aiPlayer) {
          this.aiPlayer.respawn(this.level.aiStart.x, this.level.aiStart.y);
        }
        this._announce(`Lives remaining: ${this.player.lives}`);
      } else {
        this.state = STATES.GAME_OVER;
        audioManager.gameOver();
        trackGameOver(this.player.score, this.currentLevel + 1, this.player.coins);
        this._announce('Game over! Press Enter to restart.');
        this._triggerCommentary('game_over');
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

      if (this.player.starPower) {
        enemy.stomp();
        this._addComboStomp(enemy);
        audioManager.stomp();
        this._triggerShake(3);
        continue;
      }

      if (this.player.vy > 0 && this.player.y + this.player.h - enemy.y < 14) {
        enemy.stomp();
        this.player.vy = -7;
        this._addComboStomp(enemy);
        audioManager.stomp();
        this._triggerShake(4);
        this._announce('Enemy stomped!');
        if (this.stompCount % 3 === 0) this._triggerCommentary('enemy_stomped');
      } else {
        if (this.player.die()) {
          this.deathCount++;
          this._comboCount = 0;
          this._comboTimer = 0;
          this._comboMultiplier = 1;
          audioManager.death();
          this._announce('Hit by enemy!');
          this._triggerCommentary('death');
        }
      }
    }

    if (this.aiPlayer && this.aiPlayer.alive) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (!this.physics.checkEntityCollision(this.aiPlayer, enemy)) continue;
        if (this.aiPlayer.vy > 0 && this.aiPlayer.y + this.aiPlayer.h - enemy.y < 14) {
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
        if (this.player.coins % 10 === 0) this._triggerCommentary('coin_streak');
      }
      if (this.aiPlayer && this.aiPlayer.alive && !coin.collected) {
        if (this.physics.checkEntityCollision(this.aiPlayer, coin)) {
          coin.collect();
          this.aiPlayer.addCoin();
        }
      }
    }

    // Mushroom collisions
    for (const m of this.mushrooms) {
      if (!m.active || m.collected) continue;
      if (m.spawnTimer < 16) continue;
      if (this.physics.checkEntityCollision(this.player, m)) {
        m.collect();
        this.player.lives++;
        this.player.addScore(1000);
        audioManager.powerup();
        this.floatingTexts.push(new FloatingText(m.x, m.y, '+1UP', '#00FF00'));
        this.particles.push(...createPowerupParticles(m.x, m.y, 'mushroom'));
        this._announce('Mushroom! Extra life!');
        this._triggerCommentary('powerup_mushroom');
        voiceHelper.speakCommentary('Power up! Extra life!');
      }
    }

    // Star power-up collisions
    for (const s of this.stars) {
      if (!s.active || s.collected) continue;
      if (s.spawnTimer < 16) continue;
      if (this.physics.checkEntityCollision(this.player, s)) {
        s.collect();
        this.player.starPower = true;
        this._starTimer = 600; // 10 seconds
        this.player.addScore(2000);
        audioManager.star();
        this.floatingTexts.push(new FloatingText(s.x, s.y, 'STAR!', '#FFD700'));
        this.particles.push(...createPowerupParticles(s.x, s.y, 'star'));
        this._announce('Star power! Invincible for 10 seconds!');
        this._triggerCommentary('powerup_star');
        voiceHelper.speakCommentary('Star power activated! You are invincible!');
      }
    }

    for (const flag of this.flags) {
      if (flag.reached) continue;
      if (this.physics.checkEntityCollision(this.player, flag)) {
        flag.reached = true;
        this.player.finished = true;
        const timeBonus = Math.floor(this.timer / 60) * (this.timeAttack ? 100 : 50);
        this.player.addScore(1000 + timeBonus);
        audioManager.levelComplete();
        this.floatingTexts.push(new FloatingText(flag.x, flag.y - 20, `+${1000 + timeBonus}`, '#00FF00'));
        if (this.timeAttack) {
          this.floatingTexts.push(new FloatingText(flag.x, flag.y - 35, 'SPEED BONUS!', '#FF4444'));
        }

        trackLevelComplete(this.currentLevel + 1, this.player.score, Math.floor(this.timer / 60));

        this._triggerCommentary('level_complete');

        setTimeout(() => {
          if (this.currentLevel + 1 < getLevelCount()) {
            this.state = STATES.LEVEL_COMPLETE;
            this._announce(`Level complete! Score: ${this.player.score}. Press Enter to continue.`);
          } else {
            this.state = STATES.WIN;
            this._announce(`You win! Final score: ${this.player.score}. Press Enter to play again.`);
            this._triggerCommentary('game_win');
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
      this.blockHitCount++;

      // Every 4th block gives mushroom, every 7th gives star
      if (hitter === this.player && this.blockHitCount % 7 === 0) {
        this.stars.push(new StarPowerup(col * TILE_SIZE, row * TILE_SIZE));
        audioManager.blockHit();
        this.floatingTexts.push(new FloatingText(col * TILE_SIZE, row * TILE_SIZE - 10, 'STAR', '#FFD700'));
      } else if (hitter === this.player && this.blockHitCount % 4 === 0) {
        this.mushrooms.push(new Mushroom(col * TILE_SIZE, row * TILE_SIZE));
        audioManager.blockHit();
        this.floatingTexts.push(new FloatingText(col * TILE_SIZE, row * TILE_SIZE - 10, '1-UP', '#00FF00'));
      } else {
        hitter.addScore(50);
        hitter.addCoin();
        audioManager.coin();
        this.floatingTexts.push(new FloatingText(col * TILE_SIZE, row * TILE_SIZE - 10, '50', '#FBD000'));
      }

      if (hitter === this.player) {
        this._announce('Question block hit!');
      }
    } else if (tile === 'B') {
      this.level.tiles[row][col] = '.';
      audioManager.blockHit();
      this.particles.push(...createBrickParticles(col * TILE_SIZE, row * TILE_SIZE));
      this._triggerShake(3);
    }
  }

  // Combo scoring system
  _addComboStomp(enemy) {
    this._comboCount++;
    this._comboTimer = 120; // 2 second window to continue combo
    this._comboMultiplier = Math.min(this._comboCount, 8);
    const baseScore = 200;
    const comboScore = baseScore * this._comboMultiplier;
    this.player.addScore(comboScore);
    this.stompCount++;

    const color = this._comboMultiplier >= 4 ? '#FFD700' : this._comboMultiplier >= 2 ? '#FFA500' : '#FFFFFF';
    const label = this._comboMultiplier > 1 ? `${comboScore} x${this._comboMultiplier}` : `${comboScore}`;
    this.floatingTexts.push(new FloatingText(enemy.x, enemy.y - 8, label, color));

    if (this._comboMultiplier >= 3) {
      this._announce(`${this._comboMultiplier}x Combo! ${comboScore} points!`);
    }
  }

  // Screen shake
  _triggerShake(intensity) {
    this._shakeTimer = 12;
    this._shakeIntensity = intensity;
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
    this._starTimer = 0;
    this._announce(`${this.level.name}. Get ready!`);
  }

  _restart() {
    this.loadLevel(0);
    this.state = STATES.READY;
    this.readyTimer = 90;
    this.blockHitCount = 0;
    this._starTimer = 0;
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

  // AI commentary system
  async _triggerCommentary(event) {
    if (!this._geminiReady) return;
    if (this._commentaryCooldown > 0) return;
    this._commentaryCooldown = 300; // 5 second cooldown

    const context = buildContext(
      this.player,
      this.currentLevel + 1,
      Math.floor((this.timer || 0) / 60),
      this.aiMode ? 'ai' : 'solo',
      this.deathCount,
      this.stompCount
    );

    const text = await getCommentary(event, context);
    if (text) {
      this._commentaryText = text;
      this._commentaryTimer = 180; // 3 seconds display
      voiceHelper.speakCommentary(text);
    }
  }

  async requestStrategy() {
    if (!this._geminiReady) return null;
    const context = buildContext(
      this.player,
      this.currentLevel + 1,
      Math.floor((this.timer || 0) / 60),
      this.aiMode ? 'ai' : 'solo',
      this.deathCount,
      this.stompCount
    );
    const analysis = await getStrategyAnalysis(context);
    if (analysis) {
      voiceHelper.speakStrategy(analysis);
    }
    return analysis;
  }

  // AI Live Coach - reads game state and gives direct guidance
  async _triggerCoach() {
    if (!this._geminiReady || !this.player) return;

    const situation = this._readGameSituation();
    const context = buildContext(
      this.player,
      this.currentLevel + 1,
      Math.floor((this.timer || 0) / 60),
      this.timeAttack ? 'time_attack' : this.aiMode ? 'ai' : 'solo',
      this.deathCount,
      this.stompCount
    );

    const advice = await getLiveCoach(context, situation);
    if (advice) {
      this._coachText = advice;
      this._coachDisplayTimer = 180; // 3 seconds
      voiceHelper.speakTip(advice);
    }
  }

  _readGameSituation() {
    if (!this.player || !this.level) return '';
    const parts = [];
    const col = Math.floor(this.player.x / TILE_SIZE);
    const totalCols = this.level.cols;
    const progress = Math.floor((col / totalCols) * 100);
    parts.push(`${progress}% through level`);

    const aliveEnemies = this.enemies.filter(e => e.alive).length;
    if (aliveEnemies > 0) parts.push(`${aliveEnemies} enemies remaining`);

    const uncollectedCoins = this.coins.filter(c => !c.collected).length;
    if (uncollectedCoins > 0) parts.push(`${uncollectedCoins} coins left`);

    if (this.player.lives <= 1) parts.push('low on lives');
    if (this._starTimer > 0) parts.push('star power active');
    if (this._comboMultiplier > 1) parts.push(`${this._comboMultiplier}x combo active`);
    if (this.timeAttack) parts.push('time attack mode');

    return parts.join(', ');
  }

  _render() {
    const ctx = this.ctx;

    ctx.fillStyle = this.level ? this.level.sky : '#5C94FC';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (!this.level) return;

    // Apply screen shake
    if (this._shakeTimer > 0) {
      ctx.save();
      const dx = (Math.random() - 0.5) * this._shakeIntensity * 2;
      const dy = (Math.random() - 0.5) * this._shakeIntensity * 2;
      ctx.translate(dx, dy);
    }

    this._renderBackground(ctx);
    this._renderTiles(ctx);

    for (const coin of this.coins) coin.render(ctx, this.camera);
    for (const flag of this.flags) flag.render(ctx, this.camera);
    for (const enemy of this.enemies) enemy.render(ctx, this.camera);
    for (const m of this.mushrooms) m.render(ctx, this.camera);
    for (const s of this.stars) s.render(ctx, this.camera);

    if (this.aiPlayer) this.aiPlayer.render(ctx, this.camera);
    if (this.player) this._renderPlayer(ctx);

    for (const ft of this.floatingTexts) ft.render(ctx, this.camera);
    for (const p of this.particles) p.render(ctx, this.camera);

    this._renderHUD(ctx);
    this._renderCommentary(ctx);
    this._renderCoach(ctx);
    this._renderCRT(ctx);

    // Restore screen shake transform
    if (this._shakeTimer > 0) {
      ctx.restore();
    }

    // Combo HUD overlay
    if (this._comboMultiplier > 1 && this._comboTimer > 0) {
      ctx.save();
      const hue = (this.frameCount * 8) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this._comboTimer / 30);
      ctx.fillText(`COMBO x${this._comboMultiplier}`, CANVAS_WIDTH / 2, 42);
      ctx.restore();
    }

    if (this.state === STATES.READY) this._renderOverlay(ctx, this.level.name, 'Get Ready!');
    if (this.state === STATES.PAUSED) this._renderOverlay(ctx, 'PAUSED', 'Press ESC to resume');
    if (this.state === STATES.LEVEL_COMPLETE) this._renderOverlay(ctx, 'LEVEL CLEAR!', 'Press ENTER to continue');
    if (this.state === STATES.GAME_OVER) this._renderOverlay(ctx, 'GAME OVER', `Score: ${this.player.score} | Press ENTER`);
    if (this.state === STATES.WIN) this._renderOverlay(ctx, 'YOU WIN!', `Final Score: ${this.player.score} | Press ENTER`);
  }

  _renderPlayer(ctx) {
    if (!this.player) return;
    // Rainbow flash effect during star power
    if (this.player.starPower && this._starTimer > 0) {
      this.player.render(ctx, this.camera);
      ctx.save();
      const hue = (this.frameCount * 15) % 360;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      const drawX = Math.round(this.player.x - this.camera.x);
      const drawY = Math.round(this.player.y - this.camera.y);
      ctx.fillRect(drawX, drawY, this.player.w, this.player.h);
      ctx.restore();
    } else {
      this.player.render(ctx, this.camera);
    }
  }

  _generateBackgroundDecorations() {
    const decorations = { clouds: [], hills: [], bushes: [] };
    // Generate clouds at varying heights and positions
    for (let i = 0; i < 8; i++) {
      decorations.clouds.push({
        x: i * 180 + Math.random() * 60,
        y: 20 + Math.random() * 40,
        w: 40 + Math.random() * 30,
        h: 16 + Math.random() * 10,
        speed: 0.15 + Math.random() * 0.1,
      });
    }
    // Generate hills
    for (let i = 0; i < 6; i++) {
      decorations.hills.push({
        x: i * 250 + Math.random() * 80,
        w: 80 + Math.random() * 60,
        h: 30 + Math.random() * 25,
        color: i % 2 === 0 ? '#3CB371' : '#2E8B57',
      });
    }
    // Generate small bushes
    for (let i = 0; i < 10; i++) {
      decorations.bushes.push({
        x: i * 130 + Math.random() * 50,
        w: 20 + Math.random() * 16,
        h: 8 + Math.random() * 6,
      });
    }
    return decorations;
  }

  _renderBackground(ctx) {
    if (!this._bgDecorations) return;
    const camX = this.camera.x;
    const groundY = CANVAS_HEIGHT - 32;

    // Hills (parallax 0.3x)
    for (const hill of this._bgDecorations.hills) {
      const hx = hill.x - camX * 0.3;
      const hy = groundY - hill.h;
      // Wrap around
      const wrappedX = ((hx % (CANVAS_WIDTH + 300)) + CANVAS_WIDTH + 300) % (CANVAS_WIDTH + 300) - 150;
      ctx.fillStyle = hill.color;
      ctx.beginPath();
      ctx.moveTo(wrappedX - hill.w / 2, groundY);
      ctx.quadraticCurveTo(wrappedX - hill.w / 4, hy, wrappedX, hy - 5);
      ctx.quadraticCurveTo(wrappedX + hill.w / 4, hy, wrappedX + hill.w / 2, groundY);
      ctx.fill();
    }

    // Bushes (parallax 0.4x)
    ctx.fillStyle = '#228B22';
    for (const bush of this._bgDecorations.bushes) {
      const bx = bush.x - camX * 0.4;
      const wrappedX = ((bx % (CANVAS_WIDTH + 200)) + CANVAS_WIDTH + 200) % (CANVAS_WIDTH + 200) - 100;
      const by = groundY - bush.h / 2;
      ctx.beginPath();
      ctx.ellipse(wrappedX, by, bush.w / 2, bush.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clouds (parallax 0.2x, slightly animated)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (const cloud of this._bgDecorations.clouds) {
      const cx = cloud.x - camX * 0.2 + this.frameCount * cloud.speed * 0.02;
      const wrappedX = ((cx % (CANVAS_WIDTH + 300)) + CANVAS_WIDTH + 300) % (CANVAS_WIDTH + 300) - 150;
      // Draw cloud as overlapping ellipses
      ctx.beginPath();
      ctx.ellipse(wrappedX, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(wrappedX - cloud.w * 0.25, cloud.y + 3, cloud.w * 0.3, cloud.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(wrappedX + cloud.w * 0.25, cloud.y + 2, cloud.w * 0.35, cloud.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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
    if (this.timeAttack) {
      const timeLeft = Math.max(0, Math.floor(this.timer / 60));
      const urgent = timeLeft <= 30;
      ctx.fillStyle = urgent ? '#FF4444' : '#FFD700';
      ctx.fillText('TIME ATTACK', CANVAS_WIDTH / 2, 10);
      ctx.fillText(`${timeLeft}s`, CANVAS_WIDTH / 2, 20);
    } else {
      ctx.fillText(this.level.name, CANVAS_WIDTH / 2, 10);
      ctx.fillText(`TIME: ${Math.max(0, Math.floor(this.timer / 60))}`, CANVAS_WIDTH / 2, 20);
    }

    ctx.textAlign = 'right';
    ctx.fillText(`LIVES`, CANVAS_WIDTH - 8, 10);
    ctx.fillText(`x${this.player.lives}`, CANVAS_WIDTH - 8, 20);

    if (this.aiMode && this.aiPlayer) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#88CCFF';
      ctx.fillText(`AI: ${this.aiPlayer.score.toString().padStart(6, '0')}`, 8, 32);
    }

    // Star power indicator
    if (this._starTimer > 0) {
      ctx.textAlign = 'center';
      const hue = (this.frameCount * 10) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.fillText(`STAR ${Math.ceil(this._starTimer / 60)}s`, CANVAS_WIDTH / 2, 32);
    }
  }

  _renderCommentary(ctx) {
    if (this._commentaryTimer <= 0 || !this._commentaryText) return;

    ctx.save();
    ctx.globalAlpha = this._commentaryAlpha * 0.9;

    // Background bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, CANVAS_HEIGHT - 28, CANVAS_WIDTH, 28);

    // AI label
    ctx.fillStyle = '#88CCFF';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('GEMINI AI:', 6, CANVAS_HEIGHT - 16);

    // Commentary text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '6px monospace';
    ctx.fillText(this._commentaryText.substring(0, 60), 60, CANVAS_HEIGHT - 16);
    if (this._commentaryText.length > 60) {
      ctx.fillText(this._commentaryText.substring(60, 120), 6, CANVAS_HEIGHT - 6);
    }

    ctx.restore();
  }

  _renderCoach(ctx) {
    if (this._coachDisplayTimer <= 0 || !this._coachText) return;

    ctx.save();
    const alpha = Math.min(1, this._coachDisplayTimer / 20);
    ctx.globalAlpha = alpha * 0.95;

    // Coach bar at top
    ctx.fillStyle = 'rgba(0, 100, 0, 0.85)';
    ctx.fillRect(0, 28, CANVAS_WIDTH, 16);

    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('COACH:', 6, 39);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '6px monospace';
    ctx.fillText(this._coachText.substring(0, 55), 42, 39);

    ctx.restore();
  }

  _renderCRT(ctx) {
    // Subtle CRT scanline effect
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000000';
    for (let y = 0; y < CANVAS_HEIGHT; y += 3) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1);
    }
    // Slight vignette
    const gradient = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.35,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.7
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
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

  getShareData() {
    const mode = this.timeAttack ? 'Time Attack' : this.aiMode ? 'VS AI' : 'Solo';
    const score = this.player ? this.player.score : 0;
    const level = this.currentLevel + 1;
    const text = `I scored ${score.toLocaleString()} points in MARIO.AI ${mode} mode (Level ${level})! Can you beat my score?`;
    return { text, score, mode, level };
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.input.destroy();
    voiceHelper.stop();
  }
}

export { Game, STATES, CANVAS_WIDTH, CANVAS_HEIGHT };
