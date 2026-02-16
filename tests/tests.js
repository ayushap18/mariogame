/**
 * Unit tests for MARIO.AI game engine.
 * Simple test runner — no external dependencies.
 */

import { AABB, PhysicsEngine, Camera, TILE_SIZE, GRAVITY } from '../static/js/engine.js';
import { parseLevel, getLevelCount } from '../static/js/levels.js';
import { InputManager } from '../static/js/input.js';
import { Player, MOVE_SPEED, JUMP_FORCE } from '../static/js/player.js';
import { AIPlayer } from '../static/js/ai-player.js';
import { Enemy, Coin, Flag, FloatingText, Particle, Mushroom, StarPowerup } from '../static/js/entities.js';
import { sanitizeInput, sanitizeOutput } from '../static/js/services.js';
import { isGeminiAvailable, buildContext } from '../static/js/gemini.js';

let passed = 0;
let failed = 0;
let total = 0;
const output = [];

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    output.push({ status: 'pass', message });
  } else {
    failed++;
    output.push({ status: 'fail', message });
    console.error('FAIL:', message);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

function assertApprox(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message} (expected ~${expected}, got: ${actual})`);
}

function suite(name, fn) {
  output.push({ status: 'suite', message: name });
  fn();
}

async function runTests() {
  // ---- AABB Tests ----
  suite('AABB Collision Detection', () => {
    const a = new AABB(0, 0, 10, 10);
    const b = new AABB(5, 5, 10, 10);
    const c = new AABB(20, 20, 10, 10);

    assert(a.intersects(b), 'Overlapping boxes should intersect');
    assert(!a.intersects(c), 'Non-overlapping boxes should not intersect');
    assert(b.intersects(a), 'Intersection should be symmetric');

    const d = new AABB(10, 0, 10, 10);
    assert(!a.intersects(d), 'Edge-touching boxes should not intersect (exclusive)');

    const e = new AABB(0, 0, 0, 0);
    assert(!e.intersects(a), 'Zero-size AABB should not intersect');
  });

  // ---- Physics Engine Tests ----
  suite('Physics Engine', () => {
    const tiles = [
      ['.', '.', '.', '.'],
      ['.', '.', '.', '.'],
      ['#', '#', '#', '#'],
    ];
    const physics = new PhysicsEngine(tiles, 16);

    assert(physics.isSolid(0, 2), 'Ground tile should be solid');
    assert(!physics.isSolid(0, 0), 'Empty tile should not be solid');
    assert(!physics.isSolid(-1, 0), 'Out of bounds (negative) should not be solid');
    assert(!physics.isSolid(10, 10), 'Out of bounds (positive) should not be solid');

    assertEqual(physics.getTile(0, 0), '.', 'Empty tile returns "."');
    assertEqual(physics.getTile(0, 2), '#', 'Ground tile returns "#"');
    assertEqual(physics.getTile(99, 99), '.', 'Out of bounds returns "."');
  });

  // ---- Gravity Tests ----
  suite('Gravity System', () => {
    const tiles = [['.']];
    const physics = new PhysicsEngine(tiles, 16);

    const entity = { x: 0, y: 0, vx: 0, vy: 0, w: 14, h: 16, onGround: false };
    physics.applyGravity(entity);
    assertApprox(entity.vy, GRAVITY, 0.01, 'Gravity should increase vy');

    entity.vy = 100;
    physics.applyGravity(entity);
    assertEqual(entity.vy, 10, 'vy should be capped at MAX_FALL_SPEED');
  });

  // ---- Camera Tests ----
  suite('Camera System', () => {
    const cam = new Camera(400, 224, 1280, 224);

    cam.follow({ x: 0, y: 100 });
    assertEqual(cam.x, 0, 'Camera should not go past left boundary');

    cam.follow({ x: 1200, y: 100 });
    assertEqual(cam.x, 1280 - 400, 'Camera should not go past right boundary');

    cam.follow({ x: 500, y: 100 });
    assertApprox(cam.x, 500 - 400 / 3, 1, 'Camera should follow player with offset');
  });

  // ---- Level Parser Tests ----
  suite('Level Parser', () => {
    assert(getLevelCount() >= 3, 'Should have at least 3 levels');

    const level = parseLevel(0);
    assert(level !== null, 'Level 0 should parse successfully');
    assertEqual(level.name, 'World 1-1', 'Level 1 should be named World 1-1');
    assert(level.tiles.length > 0, 'Level should have tiles');
    assert(level.width > 0, 'Level should have positive width');
    assert(level.height > 0, 'Level should have positive height');
    assert(level.entities.length > 0, 'Level should have entities');
    assert(level.playerStart.x >= 0, 'Player start should have valid x');
    assert(level.time > 0, 'Level should have positive time');

    const invalid = parseLevel(999);
    assert(invalid === null, 'Invalid level index should return null');
  });

  // ---- Player Tests ----
  suite('Player Entity', () => {
    const player = new Player(100, 100);

    assertEqual(player.x, 100, 'Player should start at given x');
    assertEqual(player.y, 100, 'Player should start at given y');
    assertEqual(player.lives, 5, 'Player should start with 5 lives');
    assertEqual(player.score, 0, 'Player should start with 0 score');
    assert(player.alive, 'Player should start alive');

    player.addScore(500);
    assertEqual(player.score, 500, 'Score should increase by 500');

    player.addCoin();
    assertEqual(player.coins, 1, 'Coins should increase by 1');
    assertEqual(player.score, 600, 'Score should also increase by 100 per coin');

    const died = player.die();
    assert(died, 'die() should return true on first death');
    assert(!player.alive, 'Player should be dead after die()');
    assertEqual(player.lives, 4, 'Lives should decrease by 1');

    player.respawn(50, 50);
    assert(player.alive, 'Player should be alive after respawn');
    assertEqual(player.x, 50, 'Player should be at respawn x');
    assert(player.invincibleTimer > 0, 'Player should be invincible after respawn');

    const diedWhileInvincible = player.die();
    assert(!diedWhileInvincible, 'die() should return false while invincible');
    assert(player.alive, 'Player should still be alive while invincible');
  });

  // ---- Player Movement Tests ----
  suite('Player Movement', () => {
    const player = new Player(100, 100);

    const sfx = player.update({ left: false, right: true, jump: false });
    assertApprox(player.vx, MOVE_SPEED, 0.1, 'Moving right should set positive vx');
    assertEqual(sfx, null, 'No sfx when not jumping');

    const player2 = new Player(100, 100);
    player2.update({ left: true, right: false, jump: false });
    assertApprox(player2.vx, -MOVE_SPEED, 0.1, 'Moving left should set negative vx');

    player2.facing = 1;
    player2.update({ left: true, right: false, jump: false });
    assertEqual(player2.facing, -1, 'Facing should be -1 when moving left');

    const player3 = new Player(100, 100);
    player3.onGround = true;
    const jumpSfx = player3.update({ left: false, right: false, jump: true });
    assertEqual(jumpSfx, 'jump', 'Should return jump sfx when jumping');
    assertApprox(player3.vy, JUMP_FORCE, 0.1, 'Jump should set negative vy');
  });

  // ---- AI Player Tests ----
  suite('AI Player', () => {
    const ai = new AIPlayer(100, 100);

    assert(ai.alive, 'AI should start alive');
    assertEqual(ai.score, 0, 'AI should start with 0 score');

    const tiles = [
      ['.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.'],
      ['#', '#', '#', '#', '#'],
    ];

    ai.update(tiles, []);
    assert(true, 'AI update should not throw');

    ai.addScore(300);
    assertEqual(ai.score, 300, 'AI score should increase');

    ai.addCoin();
    assertEqual(ai.coins, 1, 'AI coins should increase');

    ai.die();
    assert(!ai.alive, 'AI should be dead after die()');

    ai.respawn(50, 50);
    assert(ai.alive, 'AI should be alive after respawn');
  });

  // ---- Enemy Tests ----
  suite('Enemy Entity', () => {
    const enemy = new Enemy(100, 100, 'goomba');

    assert(enemy.alive, 'Enemy should start alive');
    assertEqual(enemy.vx, -1, 'Enemy should move left initially');

    const startX = enemy.x;
    enemy.update();
    assertEqual(enemy.x, startX - 1, 'Enemy should move left on update');

    enemy.stomp();
    assert(!enemy.alive, 'Enemy should be dead after stomp');
    assertEqual(enemy.h, 8, 'Enemy height should shrink on stomp');
  });

  // ---- Coin Tests ----
  suite('Coin Entity', () => {
    const coin = new Coin(64, 32);

    assert(!coin.collected, 'Coin should start uncollected');
    coin.update();
    assert(true, 'Coin update should not throw');

    coin.collect();
    assert(coin.collected, 'Coin should be collected after collect()');
  });

  // ---- FloatingText Tests ----
  suite('FloatingText', () => {
    const ft = new FloatingText(100, 100, '200', '#FFF');

    assertEqual(ft.text, '200', 'Should store text');
    assert(!ft.expired, 'Should not be expired initially');

    for (let i = 0; i < 50; i++) ft.update();
    assert(ft.expired, 'Should be expired after enough updates');
  });

  // ---- Particle Tests ----
  suite('Particle System', () => {
    const p = new Particle(10, 10, 2, -3, '#FFF', 10);
    assert(!p.expired, 'Should not be expired initially');

    p.update();
    assertApprox(p.x, 12, 0.1, 'Particle should move on x axis');
    assert(p.life < 10, 'Life should decrease');

    for (let i = 0; i < 20; i++) p.update();
    assert(p.expired, 'Particle should expire');
  });

  // ---- Input Manager Tests ----
  suite('Input Manager', () => {
    const input = new InputManager();

    assert(!input.left, 'Left should be false initially');
    assert(!input.right, 'Right should be false initially');
    assert(!input.jump, 'Jump should be false initially');

    input.keys['ArrowLeft'] = true;
    assert(input.left, 'Left should be true when ArrowLeft is pressed');

    input.keys['ArrowRight'] = true;
    assert(input.right, 'Right should be true when ArrowRight is pressed');

    input.keys[' '] = true;
    assert(input.jump, 'Jump should be true when Space is pressed');

    input.keys = {};
    input.keys['a'] = true;
    assert(input.left, 'Left should work with "a" key');

    input.keys = {};
    input.keys['d'] = true;
    assert(input.right, 'Right should work with "d" key');

    input.keys = {};
    input.keys['w'] = true;
    assert(input.jump, 'Jump should work with "w" key');

    input.justPressed['Escape'] = true;
    assert(input.pause, 'Pause should detect Escape');

    input.clearJustPressed();
    assert(!input.pause, 'Pause should be false after clearJustPressed');
  });

  // ---- Security: Input Sanitization Tests ----
  suite('Input Sanitization (Security)', () => {
    assertEqual(sanitizeInput('<script>alert("xss")</script>'), 'scriptalert(xss)/script', 'Should strip HTML tags');
    assertEqual(sanitizeInput('normal name'), 'normal name', 'Should preserve normal text');
    assertEqual(sanitizeInput(''), '', 'Should handle empty string');
    assertEqual(sanitizeInput(null), '', 'Should handle null');
    assertEqual(sanitizeInput(123), '', 'Should handle non-string');

    const longInput = 'a'.repeat(100);
    assert(sanitizeInput(longInput).length <= 50, 'Should truncate long strings to 50 chars');

    assertEqual(sanitizeOutput('<b>bold</b>'), '&lt;b&gt;bold&lt;/b&gt;', 'Should escape HTML in output');
  });

  // ---- Entity Collision Integration ----
  suite('Entity Collision Integration', () => {
    const tiles = [
      ['.', '.', '.', '.'],
      ['.', '.', '.', '.'],
      ['#', '#', '#', '#'],
    ];
    const physics = new PhysicsEngine(tiles, 16);

    const player = { x: 10, y: 10, w: 14, h: 16 };
    const enemy = { x: 12, y: 12, w: 14, h: 14 };
    assert(physics.checkEntityCollision(player, enemy), 'Overlapping entities should collide');

    const farEnemy = { x: 200, y: 200, w: 14, h: 14 };
    assert(!physics.checkEntityCollision(player, farEnemy), 'Far entities should not collide');
  });

  // ---- Flag Tests ----
  suite('Flag Entity', () => {
    const flag = new Flag(500, 100);
    assertEqual(flag.type, 'flag', 'Flag should have type "flag"');
    assert(!flag.reached, 'Flag should start unreached');
    flag.reached = true;
    assert(flag.reached, 'Flag should be reachable');
  });

  // ---- Multiple Level Parsing ----
  suite('All Levels Parse Correctly', () => {
    for (let i = 0; i < getLevelCount(); i++) {
      const level = parseLevel(i);
      assert(level !== null, `Level ${i} should parse`);
      assert(level.tiles.length > 0, `Level ${i} should have tiles`);
      assert(level.entities.length > 0, `Level ${i} should have entities`);
      assert(level.playerStart, `Level ${i} should have player start`);
    }
  });

  // ---- Gemini Module Tests ----
  suite('Gemini AI Module', () => {
    assert(typeof isGeminiAvailable === 'function', 'isGeminiAvailable should be a function');
    assert(typeof buildContext === 'function', 'buildContext should be a function');

    const mockPlayer = { score: 500, lives: 3, coins: 5 };
    const context = buildContext(mockPlayer, 2, 120, 'solo', 1, 3);
    assertEqual(context.score, 500, 'buildContext should use player score');
    assertEqual(context.level, 2, 'buildContext should use provided level');
    assertEqual(context.lives, 3, 'buildContext should use player lives');
    assertEqual(context.coins, 5, 'buildContext should use player coins');
    assertEqual(context.deaths, 1, 'buildContext should include deaths');
    assertEqual(context.enemiesStomped, 3, 'buildContext should include stomps');
    assertEqual(context.timeRemaining, 120, 'buildContext should include time');
    assertEqual(context.mode, 'solo', 'buildContext should include mode');

    const nullCtx = buildContext(null, 1, 0, 'ai', 0, 0);
    assertEqual(nullCtx.score, 0, 'buildContext should handle null player');
    assertEqual(nullCtx.lives, 3, 'buildContext should default lives to 3');
    assertEqual(nullCtx.mode, 'ai', 'buildContext should accept ai mode');
  });

  // ---- Level Time Configuration ----
  suite('Level Time Configuration', () => {
    const level1 = parseLevel(0);
    assert(level1.time >= 300, 'Level 1 should have at least 300 seconds');

    const level2 = parseLevel(1);
    assert(level2.time >= 300, 'Level 2 should have at least 300 seconds');

    const level3 = parseLevel(2);
    assert(level3.time >= 250, 'Level 3 should have at least 250 seconds');
  });

  // ---- Player Multiple Deaths ----
  suite('Player Multiple Deaths', () => {
    const player = new Player(100, 100);
    const initialLives = player.lives;

    player.die();
    player.respawn(100, 100);
    player.invincibleTimer = 0;
    player.die();
    player.respawn(100, 100);
    player.invincibleTimer = 0;
    player.die();

    assertEqual(player.lives, initialLives - 3, 'Lives should track multiple deaths correctly');
  });

  // ---- Enemy Patrol ----
  suite('Enemy Patrol Behavior', () => {
    const enemy = new Enemy(100, 100, 'goomba');
    assertEqual(enemy.patrolRange, 80, 'Enemy should have 80px patrol range');

    // Move far enough to trigger direction change
    for (let i = 0; i < 100; i++) enemy.update();
    assert(enemy.vx !== 0, 'Enemy should keep moving');
  });

  // ---- AABB Edge Cases ----
  suite('AABB Additional Edge Cases', () => {
    const a = new AABB(0, 0, 16, 16);
    const b = new AABB(8, 8, 16, 16);
    assert(a.intersects(b), 'Partially overlapping boxes should intersect');

    const c = new AABB(0, 0, 16, 16);
    const d = new AABB(0, 0, 16, 16);
    assert(c.intersects(d), 'Identical boxes should intersect');

    const e = new AABB(-10, -10, 5, 5);
    const f = new AABB(0, 0, 5, 5);
    assert(!e.intersects(f), 'Non-overlapping negative-position boxes should not intersect');
  });

  // ---- Input WASD Tests ----
  suite('Input WASD Extended', () => {
    const input = new InputManager();

    input.keys['A'] = true;
    assert(input.left, 'Left should work with uppercase "A"');
    input.keys = {};

    input.keys['D'] = true;
    assert(input.right, 'Right should work with uppercase "D"');
    input.keys = {};

    input.keys['W'] = true;
    assert(input.jump, 'Jump should work with uppercase "W"');
    input.keys = {};

    input.keys['ArrowUp'] = true;
    assert(input.jump, 'Jump should work with ArrowUp');
    input.keys = {};

    input.justPressed['P'] = true;
    assert(input.pause, 'Pause should detect uppercase P');
    input.clearJustPressed();
  });

  // ---- Security: Output Sanitization Extended ----
  suite('Output Sanitization Extended (Security)', () => {
    assertEqual(sanitizeOutput('hello'), 'hello', 'Normal text should pass through');
    assertEqual(sanitizeOutput(''), '', 'Empty string should return empty');

    const xssAttempt = '<img src=x onerror=alert(1)>';
    assert(sanitizeOutput(xssAttempt).indexOf('<') === -1 || sanitizeOutput(xssAttempt).indexOf('&lt;') !== -1,
      'Should escape XSS img tag');

    assertEqual(sanitizeInput('a&b<c>d"e'), 'abcde', 'Should strip all special chars');
  });

  // ---- Power-up Entity Tests ----
  suite('Mushroom Power-up', () => {
    const m = new Mushroom(100, 100);
    assertEqual(m.type, 'mushroom', 'Mushroom should have type "mushroom"');
    assert(m.active, 'Mushroom should start active');
    assert(!m.collected, 'Mushroom should start uncollected');
    assertEqual(m.vx, 1.5, 'Mushroom should move right');

    m.update();
    assert(m.spawnTimer === 1, 'Spawn timer should increment');
    assert(m.active, 'Mushroom should remain active during spawn');

    m.collect();
    assert(m.collected, 'Mushroom should be collected after collect()');
    assert(!m.active, 'Mushroom should be inactive after collect()');
  });

  suite('Star Power-up', () => {
    const s = new StarPowerup(200, 100);
    assertEqual(s.type, 'star', 'Star should have type "star"');
    assert(s.active, 'Star should start active');
    assert(!s.collected, 'Star should start uncollected');
    assertEqual(s.vx, 2, 'Star should move right at speed 2');

    s.update();
    assert(s.spawnTimer === 1, 'Star spawn timer should increment');

    s.collect();
    assert(s.collected, 'Star should be collected after collect()');
    assert(!s.active, 'Star should be inactive after collect()');
  });

  // ---- Player Star Power Tests ----
  suite('Player Star Power', () => {
    const player = new Player(100, 100);
    assertEqual(player.starPower, false, 'Player should start without star power');

    player.starPower = true;
    const died = player.die();
    assert(!died, 'Player should not die while star power is active');
    assert(player.alive, 'Player should remain alive with star power');

    player.starPower = false;
    const died2 = player.die();
    assert(died2, 'Player should die when star power is off');
    assert(!player.alive, 'Player should be dead');

    player.respawn(100, 100);
    assertEqual(player.starPower, false, 'Star power should reset on respawn');
  });

  // ---- Gemini Strategy Module Test ----
  suite('Gemini Strategy Module', () => {
    const { getStrategyAnalysis } = await import('../static/js/gemini.js');
    assert(typeof getStrategyAnalysis === 'function', 'getStrategyAnalysis should be exported');
  });

  // ---- Voice Helper Module Test ----
  suite('Voice Helper Module', () => {
    const { VoiceHelper, voiceHelper } = await import('../static/js/voice.js');
    assert(typeof VoiceHelper === 'function', 'VoiceHelper should be a class');
    assert(voiceHelper !== null, 'voiceHelper singleton should exist');
    assert(typeof voiceHelper.toggle === 'function', 'voiceHelper should have toggle method');
    assert(typeof voiceHelper.speak === 'function', 'voiceHelper should have speak method');
    assert(typeof voiceHelper.speakTip === 'function', 'voiceHelper should have speakTip method');
    assert(typeof voiceHelper.speakCommentary === 'function', 'voiceHelper should have speakCommentary method');
    assert(typeof voiceHelper.stop === 'function', 'voiceHelper should have stop method');
  });

  // ---- Render Results ----
  renderResults();
}

function renderResults() {
  const container = document.getElementById('output');
  const summaryEl = document.getElementById('summary');

  if (!container) {
    console.log(`Tests: ${passed}/${total} passed, ${failed} failed`);
    return;
  }

  let currentSuite = null;
  let html = '';

  for (const item of output) {
    if (item.status === 'suite') {
      if (currentSuite) html += '</div>';
      html += `<div class="suite"><h2>${item.message}</h2>`;
      currentSuite = item.message;
    } else {
      const cls = item.status === 'pass' ? 'pass' : 'fail';
      const icon = item.status === 'pass' ? '&#10004;' : '&#10008;';
      html += `<div class="result ${cls}">${icon} ${item.message}</div>`;
    }
  }
  if (currentSuite) html += '</div>';

  container.innerHTML = html;

  const summaryClass = failed === 0 ? 'pass' : 'fail';
  summaryEl.innerHTML = `<span class="${summaryClass}">${passed}/${total} tests passed. ${failed} failed.</span>`;
}

export { runTests };
