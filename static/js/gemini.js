/**
 * Client-side Gemini AI integration module.
 * Communicates with the server-side Gemini API proxy endpoints
 * to provide AI-powered game tips, chat, and commentary.
 */

let _available = null;

/**
 * Check if Gemini AI backend is available.
 * Caches the result to avoid repeated checks.
 * @returns {Promise<boolean>}
 */
async function isGeminiAvailable() {
  if (_available !== null) return _available;
  try {
    const res = await fetch('/api/gemini/status');
    if (!res.ok) { _available = false; return false; }
    const data = await res.json();
    _available = !!data.available;
  } catch {
    _available = false;
  }
  return _available;
}

/**
 * Build a game context object from player state.
 * @param {object} player - Player entity
 * @param {number} level - Current level (1-indexed)
 * @param {number} timeRemaining - Seconds left
 * @param {string} mode - 'solo' or 'ai'
 * @param {number} deaths - Total deaths this session
 * @param {number} enemiesStomped - Total enemies stomped
 * @returns {object}
 */
function buildContext(player, level, timeRemaining, mode, deaths, enemiesStomped) {
  return {
    score: player ? player.score : 0,
    level: level || 1,
    lives: player ? player.lives : 3,
    coins: player ? player.coins : 0,
    deaths: deaths || 0,
    enemiesStomped: enemiesStomped || 0,
    timeRemaining: timeRemaining || 0,
    mode: mode || 'solo',
  };
}

/**
 * Get a contextual game tip from Gemini AI.
 * @param {object} context - Game context from buildContext()
 * @returns {Promise<string|null>} Tip text or null on failure
 */
async function getGameTip(context) {
  try {
    const res = await fetch('/api/gemini/tip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.tip || null;
  } catch {
    return null;
  }
}

/**
 * Chat with the AI game companion.
 * @param {string} message - Player's message
 * @param {object} [context] - Optional game context
 * @returns {Promise<string|null>} AI response or null on failure
 */
async function chatWithCompanion(message, context) {
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.reply || null;
  } catch {
    return null;
  }
}

/**
 * Get AI commentary for a game event.
 * @param {string} event - Event type (level_complete, game_over, game_win, enemy_stomped, death, powerup_mushroom, powerup_star, coin_streak)
 * @param {object} context - Game context
 * @returns {Promise<string|null>} Commentary text or null
 */
async function getCommentary(event, context) {
  try {
    const res = await fetch('/api/gemini/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.commentary || null;
  } catch {
    return null;
  }
}

/**
 * Get strategy analysis from Gemini AI.
 * @param {object} context - Game context from buildContext()
 * @returns {Promise<string|null>} Strategy analysis or null
 */
async function getStrategyAnalysis(context) {
  try {
    const res = await fetch('/api/gemini/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.analysis || null;
  } catch {
    return null;
  }
}

/**
 * Get AI live coaching advice by reading the current game state.
 * @param {object} context - Game context from buildContext()
 * @param {string} situation - Brief description of current situation
 * @returns {Promise<string|null>} Coaching advice or null
 */
async function getLiveCoach(context, situation) {
  try {
    const res = await fetch('/api/gemini/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, situation }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.advice || null;
  } catch {
    return null;
  }
}

export { isGeminiAvailable, buildContext, getGameTip, chatWithCompanion, getCommentary, getStrategyAnalysis, getLiveCoach };
