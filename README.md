# MARIO.AI

A reimagined retro-style side-scrolling platformer inspired by Super Mario Bros, built for 2026 with Google Gemini AI integration. Features an AI-powered game companion, voice helper mode, ghost opponent mode, power-ups, CRT retro effects, Firebase leaderboard, and procedural audio — all with zero image or audio files.

## Chosen Vertical

**Gaming / Interactive Entertainment** — Reimagining a classic childhood game (Super Mario Bros) with modern AI capabilities that weren't possible 20 years ago.

## Approach and Logic

The core idea is to take the classic Mario platformer experience and enhance it with Google Gemini AI to create something that goes beyond a clone:

1. **AI Game Companion**: Players can chat with a Gemini-powered companion (Toad) that provides contextual tips, strategies, and encouragement based on their actual game performance (score, deaths, level, time remaining).

2. **Real-time AI Tips**: During gameplay, players can request AI-generated tips that adapt to their current situation — struggling players get survival advice, skilled players get advanced tactics.

3. **AI Voice Helper**: Toggle voice mode to hear AI tips, commentary, and strategy analysis spoken aloud using the Web Speech API. Works on dashboard companion chat and in-game events.

4. **AI Commentary**: Game events (level completions, deaths, victories, power-ups, coin streaks) trigger dynamic Gemini-generated commentary displayed as a retro overlay on the game canvas and spoken aloud.

5. **AI Strategy Analysis**: Request a detailed performance analysis from Gemini that rates your skill level, identifies strengths, suggests improvements, and provides actionable tips.

6. **VS AI Mode**: Compete against a rule-based AI ghost opponent that navigates levels autonomously, adding a competitive element.

7. **Power-ups**: Classic mushroom (extra life) and star (10-second invincibility with rainbow flash) power-ups spawn from question blocks.

8. **Global Leaderboard**: Firebase-powered score tracking with Google Sign-In authentication.

9. **Retro CRT Effects**: Authentic CRT scanlines and vignette effects rendered on canvas and via CSS for maximum retro feel.

## How the Solution Works

### Architecture

```
Browser (Client)                    Cloud Run (Server)
┌─────────────────┐                ┌──────────────────────┐
│  HTML5 Canvas    │  REST API     │  Express.js Server   │
│  Game Engine     │───────────────│  Gemini API Proxy    │
│  ES6 Modules     │               │  Static File Server  │
│  Gemini Client   │               │  Rate Limiting       │
│  Web Speech API  │               │  Input Validation    │
│  Voice Helper    │               │  Security Headers    │
└─────────────────┘                └──────────────────────┘
        │                                    │
        │ Firebase SDK                       │ @google/generative-ai
        ▼                                    ▼
┌─────────────────┐                ┌──────────────────────┐
│  Firebase Auth   │                │  Google Gemini API   │
│  Cloud Firestore │                │  (gemini-2.0-flash)  │
│  Google Analytics│                └──────────────────────┘
└─────────────────┘
```

### Game Engine
- **Rendering**: HTML5 Canvas with pixel-art sprites defined as character arrays (no image files)
- **Physics**: Custom AABB collision detection, gravity simulation, tile-based world
- **Audio**: Web Audio API procedural sound generation (no audio files)
- **Input**: Keyboard (WASD/Arrows) and touch controls for mobile
- **Power-ups**: Mushroom (extra life) and Star (temporary invincibility) from question blocks
- **CRT Effects**: Canvas-rendered scanlines and vignette for authentic retro aesthetics

### AI Integration
- **Server-side proxy**: Express.js server proxies Gemini API requests, keeping the API key secure
- **Five AI endpoints**:
  - `/api/gemini/tip` — Contextual gameplay tips based on player stats
  - `/api/gemini/chat` — Conversational AI companion
  - `/api/gemini/commentary` — Dynamic event commentary (supports 8 event types)
  - `/api/gemini/strategy` — Detailed performance analysis and skill rating
  - `/api/gemini/status` — AI availability check
- **Voice output**: Web Speech API reads AI responses aloud when voice mode is enabled
- **Auto-triggered commentary**: Game events automatically request Gemini commentary with cooldown management
- **Rate limiting**: 30 requests/minute per IP to prevent abuse
- **Input validation**: All user inputs sanitized before reaching Gemini

## Google Services Integration

| Service | Purpose | Implementation |
|---------|---------|----------------|
| **Google Gemini AI** | AI companion chat, contextual tips, game commentary, strategy analysis | Server-side via `@google/generative-ai` SDK, proxied through 5 Express endpoints |
| **Firebase Authentication** | Google Sign-In for player accounts | Client-side Firebase Auth SDK with popup sign-in flow |
| **Cloud Firestore** | Global leaderboard storage and retrieval | Score submission with server timestamps, ordered queries |
| **Google Analytics 4** | Game event tracking (starts, completions, scores, AI usage) | Client-side gtag.js with custom events |
| **Google Fonts** | Retro pixel font (Press Start 2P) | CSS link with preconnect optimization |
| **Google Cloud Run** | Production deployment with auto-scaling | Dockerfile-based containerized deployment |
| **Web Speech API** | AI Voice Helper — speaks tips, commentary, and strategy aloud | Browser-native SpeechSynthesis with voice selection |
| **Web Audio API** | Procedural retro sound effects | No audio files — all sounds generated programmatically |

## Project Structure

```
mario-ai/
├── index.html                 # Dashboard with menu, leaderboard, AI companion, settings
├── game.html                  # Game page with canvas, controls, AI tips, voice toggle
├── server.js                  # Express server with Gemini API proxy (5 endpoints)
├── package.json               # Node.js dependencies and scripts
├── Dockerfile                 # Cloud Run deployment container
├── .dockerignore              # Docker build exclusions
├── .gitignore                 # Git exclusions
├── static/
│   ├── css/
│   │   └── style.css          # Responsive styles, CRT effects, voice UI, accessibility
│   └── js/
│       ├── game.js            # Main game loop, state management, AI commentary, power-ups, CRT
│       ├── engine.js          # Physics, AABB collision, camera system
│       ├── player.js          # Player entity with movement, star power, animation
│       ├── ai-player.js       # AI ghost opponent with decision-making
│       ├── entities.js        # Enemies, coins, flags, mushrooms, stars, particles
│       ├── sprites.js         # Pixel art sprite definitions and renderer
│       ├── levels.js          # Level data (3 worlds) and parser
│       ├── input.js           # Keyboard and touch input manager
│       ├── audio.js           # Web Audio procedural sound effects (incl. star, voice-ready)
│       ├── services.js        # Firebase Auth, Firestore, Analytics
│       ├── gemini.js          # Client-side Gemini AI integration (tips, chat, commentary, strategy)
│       ├── voice.js           # AI Voice Helper using Web Speech API
│       └── dashboard.js       # Dashboard page controller with voice integration
├── tests/
│   ├── index.html             # Browser test runner page
│   ├── tests.js               # Client-side unit tests (130+ assertions)
│   └── server.test.js         # Server-side unit tests
└── README.md
```

## Setup Guide

### Prerequisites

- Node.js 18+ installed
- A Google Cloud project with billing enabled
- Git installed and configured
- A public GitHub repository

### Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd mario-ai
npm install
```

### Step 2: Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** and create a new project (or use existing GCP project)
3. In the project dashboard, click the web icon (**</>**) to add a web app
4. Copy the Firebase config object
5. Open `static/js/services.js` and replace the placeholder config:

```javascript
const firebaseConfig = {
  apiKey: 'YOUR_ACTUAL_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
  measurementId: 'G-XXXXXXXXXX',
};
```

6. **Enable Authentication**:
   - In Firebase Console, go to **Authentication** > **Sign-in method**
   - Enable **Google** as a sign-in provider
   - Add your domain to **Authorized domains**

7. **Create Firestore Database**:
   - Go to **Firestore Database** > **Create database**
   - Choose **Start in production mode**
   - Select a region close to your users
   - Set up security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{entry} {
      allow read: if true;
      allow create: if request.auth != null;
    }
  }
}
```

### Step 3: Set Up Google Analytics 4

1. Go to [Google Analytics](https://analytics.google.com)
2. Create a new GA4 property
3. Get the **Measurement ID** (format: `G-XXXXXXXXXX`)
4. Replace `G-XXXXXXXXXX` in both `index.html` and `game.html`

### Step 4: Set Up Gemini AI

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click **Get API key** > **Create API key**
3. Copy the API key
4. Set it as an environment variable:

```bash
export GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 5: Run Locally

```bash
npm start
```

Open http://localhost:8080 in your browser.

### Step 6: Deploy to Google Cloud Run

1. **Install Google Cloud CLI** if not already installed:
```bash
# Follow: https://cloud.google.com/sdk/docs/install
gcloud init
gcloud auth login
```

2. **Set your project**:
```bash
gcloud config set project YOUR_PROJECT_ID
```

3. **Enable required APIs**:
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

4. **Deploy**:
```bash
gcloud run deploy mario-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_gemini_api_key_here
```

5. The deployment will output a Cloud Run URL (e.g., `https://mario-ai-xxxxx-uc.a.run.app`)

## APIs Required

| API | Purpose | Key Required? |
|-----|---------|---------------|
| **Gemini API** | AI tips, chat, commentary, strategy analysis | Yes (`GEMINI_API_KEY` env var) |
| **Firebase Auth** | Google Sign-In | Firebase config in `services.js` |
| **Cloud Firestore** | Leaderboard database | Same Firebase config |
| **Google Analytics 4** | Event tracking | Measurement ID in HTML |
| **Web Speech API** | AI Voice Helper (text-to-speech) | No (browser built-in) |
| **Web Audio API** | Procedural sound effects | No (browser built-in) |
| **Google Fonts** | Press Start 2P retro font | No |
| **Google Cloud Run** | Production deployment | GCP project |

## Assumptions

- The game is designed to work in modern browsers (Chrome, Firefox, Safari, Edge) with ES6 module support
- Firebase configuration must be set up by the user with their own project credentials
- The Gemini API key is kept server-side for security; AI features gracefully degrade if unavailable
- The game is client-rendered with a lightweight server for static files and Gemini proxy
- Level data is embedded in JavaScript to avoid external file dependencies and keep the repo small
- All sprites and audio are generated programmatically — no external assets needed
- Voice helper uses the browser's built-in Speech Synthesis (no external API key needed)

## Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move Left | Arrow Left / A | Left button |
| Move Right | Arrow Right / D | Right button |
| Jump | Arrow Up / W / Space | Jump button |
| Pause | Escape / P | Pause button |

## Features

- **Classic Platformer Gameplay**: Side-scrolling action with running, jumping, enemies, coins, and question blocks
- **Power-ups**: Mushroom (extra life) and Star (10-second invincibility with rainbow flash) from question blocks
- **Gemini AI Companion**: Chat-based game companion powered by Google Gemini for tips and strategies
- **Real-time AI Tips**: Context-aware gameplay tips based on your current performance
- **AI Voice Helper**: Toggle voice mode to hear tips, commentary, and strategy spoken aloud (Web Speech API)
- **AI Commentary Overlay**: Auto-triggered retro-styled Gemini commentary on game events (displayed on canvas)
- **AI Strategy Analysis**: Detailed performance analysis with skill rating, strengths, and improvement suggestions
- **VS AI Mode**: Compete against a ghost AI opponent that navigates levels autonomously
- **3 Progressive Worlds**: Increasing difficulty across World 1-1, 1-2, and 1-3
- **Global Leaderboard**: Firebase-powered leaderboard with Google Sign-In
- **CRT Retro Effects**: Authentic scanline and vignette effects on game canvas
- **Procedural Audio**: Retro sound effects generated using Web Audio API (including star power-up)
- **Pixel Art Rendering**: All sprites drawn programmatically on Canvas
- **Responsive Design**: Desktop and mobile with touch controls
- **Accessibility**: WCAG-compliant with screen reader support, high contrast, reduced motion, skip navigation

## Accessibility

- **Skip Navigation**: Skip link to jump to main content
- **Screen Reader**: ARIA live regions announce game events
- **Keyboard Navigation**: Full keyboard support for menus and gameplay
- **High Contrast Mode**: Toggle in settings for improved visibility
- **Reduced Motion**: Respects system preference and provides manual toggle
- **Semantic HTML**: Proper landmarks, headings, and ARIA roles
- **Focus Indicators**: Visible focus rings on all interactive elements
- **Touch Controls**: Mobile-friendly touch buttons with labels
- **Voice Helper**: AI responses can be spoken aloud for accessibility

## Security

- Input sanitization on all user-provided data (server and client)
- XSS prevention via DOM-based text escaping and input stripping
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-XSS-Protection)
- Gemini API key stored server-side only (never exposed to client)
- Rate limiting on API endpoints (30 req/min per IP)
- Firebase security rules for authenticated-only writes
- No `eval()`, `innerHTML` with user data, or inline event handlers
- Request body size limits (16KB max)

## Testing

### Client-side Tests
Open `tests/index.html` in a browser to run 130+ unit test assertions covering:
- AABB collision detection and edge cases
- Physics engine (gravity, tile collision, boundary checks)
- Camera system boundaries and following
- Level parsing and validation (all 3 levels)
- Player movement, scoring, death/respawn, invincibility, star power
- AI player decision-making and state management
- Entity behavior (enemies, coins, particles, floating text)
- Power-up entities (Mushroom, StarPowerup) lifecycle
- Input management (keyboard, WASD, pause)
- Security input/output sanitization
- Gemini AI module (buildContext, availability, strategy analysis)
- Voice Helper module (class, methods, singleton)

### Server-side Tests
```bash
npm test
```
Tests cover server input sanitization, game context validation, event type validation (including power-up and coin streak events).

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules), HTML5 Canvas, CSS3
- **Backend**: Node.js, Express.js
- **AI**: Google Gemini 2.0 Flash via `@google/generative-ai` SDK
- **Voice**: Web Speech API (SpeechSynthesis) for AI voice helper
- **Authentication**: Firebase Authentication (Google Sign-In)
- **Database**: Cloud Firestore (leaderboard)
- **Analytics**: Google Analytics 4
- **Fonts**: Google Fonts (Press Start 2P)
- **Audio**: Web Audio API (procedural generation)
- **Deployment**: Google Cloud Run (Docker container)

## License

MIT
