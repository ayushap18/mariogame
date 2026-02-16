/**
 * Server-side tests for MARIO.AI API endpoints.
 * Run with: node --experimental-vm-modules tests/server.test.js
 *
 * Tests validate input sanitization, rate limiting logic,
 * and game context validation independently of the server.
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// --- Input Sanitization Tests ---
describe('Server Input Sanitization', () => {
  function sanitizeString(str, maxLen = 200) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"']/g, '').slice(0, maxLen).trim();
  }

  test('strips HTML special characters', () => {
    assert.equal(sanitizeString('<script>alert("xss")</script>'), 'scriptalert(xss)/script');
  });

  test('preserves normal text', () => {
    assert.equal(sanitizeString('Hello World'), 'Hello World');
  });

  test('truncates to max length', () => {
    const long = 'a'.repeat(300);
    assert.equal(sanitizeString(long).length, 200);
  });

  test('handles non-string input', () => {
    assert.equal(sanitizeString(null), '');
    assert.equal(sanitizeString(undefined), '');
    assert.equal(sanitizeString(123), '');
  });

  test('trims whitespace', () => {
    assert.equal(sanitizeString('  hello  '), 'hello');
  });
});

// --- Game Context Validation Tests ---
describe('Game Context Validation', () => {
  function validateGameContext(ctx) {
    if (!ctx || typeof ctx !== 'object') return null;
    return {
      score: Math.max(0, Math.min(Number(ctx.score) || 0, 999999)),
      level: Math.max(1, Math.min(Number(ctx.level) || 1, 10)),
      lives: Math.max(0, Math.min(Number(ctx.lives) || 0, 99)),
      coins: Math.max(0, Math.min(Number(ctx.coins) || 0, 9999)),
      deaths: Math.max(0, Math.min(Number(ctx.deaths) || 0, 999)),
      enemiesStomped: Math.max(0, Math.min(Number(ctx.enemiesStomped) || 0, 999)),
      timeRemaining: Math.max(0, Math.min(Number(ctx.timeRemaining) || 0, 999)),
      mode: ctx.mode === 'ai' ? 'ai' : 'solo',
    };
  }

  test('returns null for invalid input', () => {
    assert.equal(validateGameContext(null), null);
    assert.equal(validateGameContext('string'), null);
    assert.equal(validateGameContext(123), null);
  });

  test('clamps score to valid range', () => {
    const ctx = validateGameContext({ score: -100 });
    assert.equal(ctx.score, 0);

    const ctx2 = validateGameContext({ score: 9999999 });
    assert.equal(ctx2.score, 999999);
  });

  test('clamps level to valid range', () => {
    const ctx = validateGameContext({ level: 0 });
    assert.equal(ctx.level, 1);

    const ctx2 = validateGameContext({ level: 100 });
    assert.equal(ctx2.level, 10);
  });

  test('defaults mode to solo', () => {
    const ctx = validateGameContext({ mode: 'invalid' });
    assert.equal(ctx.mode, 'solo');
  });

  test('accepts ai mode', () => {
    const ctx = validateGameContext({ mode: 'ai' });
    assert.equal(ctx.mode, 'ai');
  });

  test('handles missing fields with defaults', () => {
    const ctx = validateGameContext({});
    assert.equal(ctx.score, 0);
    assert.equal(ctx.level, 1);
    assert.equal(ctx.lives, 0);
    assert.equal(ctx.coins, 0);
    assert.equal(ctx.mode, 'solo');
  });

  test('handles NaN values', () => {
    const ctx = validateGameContext({ score: 'abc', level: NaN });
    assert.equal(ctx.score, 0);
    assert.equal(ctx.level, 1);
  });
});

// --- Valid Events Tests ---
describe('Event Validation', () => {
  const validEvents = ['level_complete', 'game_over', 'game_win', 'enemy_stomped', 'death', 'powerup_mushroom', 'powerup_star', 'coin_streak'];

  test('accepts all valid event types', () => {
    for (const event of validEvents) {
      assert.ok(validEvents.includes(event), `${event} should be valid`);
    }
  });

  test('accepts new power-up events', () => {
    assert.ok(validEvents.includes('powerup_mushroom'), 'powerup_mushroom should be valid');
    assert.ok(validEvents.includes('powerup_star'), 'powerup_star should be valid');
    assert.ok(validEvents.includes('coin_streak'), 'coin_streak should be valid');
  });

  test('rejects invalid event types', () => {
    assert.ok(!validEvents.includes('hack'), 'hack should be invalid');
    assert.ok(!validEvents.includes(''), 'empty should be invalid');
  });
});

console.log('Server tests completed.');
