/**
 * MARIO.AI Express Server
 * Serves static files and provides Gemini AI API proxy endpoints.
 * Designed for deployment on Google Cloud Run.
 *
 * Environment Variables:
 *   GEMINI_API_KEY - Google Gemini API key (required for AI features)
 *   PORT           - Server port (default: 8080, Cloud Run sets this automatically)
 */

import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middleware ---
app.use(express.json({ limit: '16kb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Rate limiting (simple in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  next();
}

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 120_000);

// Static files
app.use(express.static(__dirname, {
  maxAge: '1h',
  etag: true,
}));

// --- Gemini AI Setup ---
let genAI = null;
let geminiModel = null;

function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set. AI features will be disabled.');
    return false;
  }
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('Gemini AI initialized successfully.');
    return true;
  } catch (err) {
    console.error('Gemini initialization failed:', err.message);
    return false;
  }
}

// --- Input Validation ---
function sanitizeString(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, '').slice(0, maxLen).trim();
}

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

// --- API Endpoints ---

/**
 * POST /api/gemini/tip
 * Get a contextual game tip based on player performance.
 */
app.post('/api/gemini/tip', rateLimit, async (req, res) => {
  if (!geminiModel) {
    return res.status(503).json({ error: 'AI service not available.' });
  }

  const context = validateGameContext(req.body.context);
  if (!context) {
    return res.status(400).json({ error: 'Invalid game context.' });
  }

  try {
    const prompt = `You are a helpful game coach for MARIO.AI, a retro side-scrolling platformer game inspired by Super Mario Bros. The player is currently playing and needs a quick tip.

Player stats:
- Score: ${context.score}
- Level: World 1-${context.level}
- Lives: ${context.lives}
- Coins: ${context.coins}
- Deaths so far: ${context.deaths}
- Enemies stomped: ${context.enemiesStomped}
- Time remaining: ${context.timeRemaining} seconds
- Mode: ${context.mode === 'ai' ? 'Playing against AI opponent' : 'Solo mode'}

Give ONE short, encouraging gameplay tip (max 2 sentences). Be specific to their situation. If they are dying a lot, give survival tips. If they are doing well, suggest advanced tactics. If playing against AI, give competitive tips. Keep it fun and retro-gaming themed.`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim();

    res.json({ tip: text });
  } catch (err) {
    console.error('Gemini tip error:', err.message);
    res.status(500).json({ error: 'Failed to generate tip.' });
  }
});

/**
 * POST /api/gemini/chat
 * Chat with the AI game companion about the game.
 */
app.post('/api/gemini/chat', rateLimit, async (req, res) => {
  if (!geminiModel) {
    return res.status(503).json({ error: 'AI service not available.' });
  }

  const message = sanitizeString(req.body.message, 500);
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const context = validateGameContext(req.body.context);

  try {
    const contextInfo = context
      ? `\nPlayer stats: Score ${context.score}, Level ${context.level}, Lives ${context.lives}, Coins ${context.coins}, Mode: ${context.mode}`
      : '';

    const prompt = `You are Toad, the friendly AI companion in MARIO.AI, a reimagined retro platformer game built in 2026. You are helpful, enthusiastic, and knowledgeable about the game.

Game features:
- Classic side-scrolling platformer with running, jumping, coin collecting, and enemy stomping
- Three worlds with increasing difficulty
- VS AI mode where players compete against a ghost AI opponent
- Global leaderboard with Google Sign-In
- Procedural retro sound effects
- Built with HTML5 Canvas, Firebase, and Google Gemini AI
${contextInfo}

Player says: "${message}"

Respond helpfully in 1-3 sentences. Stay in character as a friendly game companion. You can give tips, explain mechanics, or just be encouraging. Keep it fun!`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim();

    res.json({ reply: text });
  } catch (err) {
    console.error('Gemini chat error:', err.message);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});

/**
 * POST /api/gemini/commentary
 * Get AI commentary for a game event (level complete, game over, etc.)
 */
app.post('/api/gemini/commentary', rateLimit, async (req, res) => {
  if (!geminiModel) {
    return res.status(503).json({ error: 'AI service not available.' });
  }

  const event = sanitizeString(req.body.event, 50);
  const context = validateGameContext(req.body.context);

  if (!event || !context) {
    return res.status(400).json({ error: 'Event and context are required.' });
  }

  const validEvents = ['level_complete', 'game_over', 'game_win', 'enemy_stomped', 'death'];
  if (!validEvents.includes(event)) {
    return res.status(400).json({ error: 'Invalid event type.' });
  }

  try {
    const prompt = `You are the narrator for MARIO.AI, a retro platformer game. Generate a SHORT, fun commentary (1 sentence, max 15 words) for this game event:

Event: ${event}
Score: ${context.score}, Level: ${context.level}, Lives: ${context.lives}, Coins: ${context.coins}

Be dramatic, fun, and retro-gaming themed. Use exclamation marks. Examples of good tone: "What a legendary stomp combo!", "The hero rises again!", "World 1-2 cleared like a speedrunner!"`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim();

    res.json({ commentary: text });
  } catch (err) {
    console.error('Gemini commentary error:', err.message);
    res.status(500).json({ error: 'Failed to generate commentary.' });
  }
});

/**
 * GET /api/gemini/status
 * Check if Gemini AI is available.
 */
app.get('/api/gemini/status', (req, res) => {
  res.json({ available: !!geminiModel });
});

// Health check for Cloud Run
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start Server ---
initGemini();
app.listen(PORT, () => {
  console.log(`MARIO.AI server running on port ${PORT}`);
  console.log(`Gemini AI: ${geminiModel ? 'enabled' : 'disabled (set GEMINI_API_KEY)'}`);
});
