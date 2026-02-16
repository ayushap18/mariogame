# MARIO.AI

A retro-style side-scrolling platformer game built with vanilla HTML5, CSS3, and JavaScript. Features an AI ghost opponent mode where you compete against an autonomous AI player in real-time.

## Features

- **Classic Platformer Gameplay**: Side-scrolling action with running, jumping, enemies, coins, and question blocks
- **AI vs Mode**: Compete against a ghost AI opponent that navigates levels autonomously using rule-based decision making
- **3 Unique Levels**: Progressive difficulty across World 1-1, 1-2, and 1-3
- **Procedural Audio**: Retro sound effects generated using the Web Audio API (no audio files needed)
- **Pixel Art Rendering**: All sprites drawn programmatically on HTML5 Canvas (no image files)
- **Leaderboard**: Firebase-powered global leaderboard with Google Sign-In
- **Responsive Design**: Playable on desktop and mobile with touch controls
- **Accessibility**: WCAG-compliant with screen reader support, high contrast mode, reduced motion, keyboard navigation, and ARIA annotations

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules), HTML5 Canvas, CSS3
- **Authentication**: Firebase Authentication (Google Sign-In)
- **Database**: Cloud Firestore (leaderboard storage)
- **Analytics**: Google Analytics 4 (game event tracking)
- **Fonts**: Google Fonts (Press Start 2P)
- **Audio**: Web Audio API (procedural sound generation)

## Google Cloud Services

| Service | Usage |
|---------|-------|
| Firebase Authentication | Google Sign-In for player accounts |
| Cloud Firestore | Leaderboard data storage and retrieval |
| Google Analytics 4 | Game event tracking (starts, completions, scores) |
| Google Fonts | Retro pixel font rendering |

## Project Structure

```
promptwar/
├── index.html              # Dashboard / landing page
├── game.html               # Game page
├── static/
│   ├── css/
│   │   └── style.css       # All styles with accessibility support
│   └── js/
│       ├── game.js          # Main game loop and state management
│       ├── engine.js        # Physics, collision detection, camera
│       ├── sprites.js       # Pixel art sprite definitions and renderer
│       ├── player.js        # Player entity with movement and animation
│       ├── ai-player.js     # AI ghost opponent with decision-making
│       ├── entities.js      # Enemies, coins, flags, particles
│       ├── levels.js        # Level data and parser
│       ├── input.js         # Keyboard and touch input manager
│       ├── audio.js         # Web Audio procedural sound effects
│       ├── services.js      # Firebase Auth, Firestore, Analytics
│       └── dashboard.js     # Dashboard page controller
├── tests/
│   ├── index.html           # Test runner page
│   └── tests.js             # Unit test suite
├── .gitignore
└── README.md
```

## Setup

1. Clone the repository
2. Configure Firebase:
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Google Sign-In provider)
   - Create a Firestore database
   - Copy your Firebase config into `static/js/services.js`
3. Configure Google Analytics:
   - Create a GA4 property at [analytics.google.com](https://analytics.google.com)
   - Replace `G-XXXXXXXXXX` with your Measurement ID in both HTML files
4. Serve the project using any static file server

## Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move Left | Arrow Left / A | Left button |
| Move Right | Arrow Right / D | Right button |
| Jump | Arrow Up / W / Space | Jump button |
| Pause | Escape / P | Pause button |

## Accessibility

- **Skip Navigation**: Skip link to jump to main content
- **Screen Reader**: ARIA live regions announce game events (score changes, deaths, level completion)
- **Keyboard Navigation**: Full keyboard support for menus and gameplay
- **High Contrast Mode**: Toggle in settings for improved visibility
- **Reduced Motion**: Respects `prefers-reduced-motion` and provides a manual toggle
- **Semantic HTML**: Proper landmarks, headings, and roles throughout

## Security

- Input sanitization on all user-provided data
- XSS prevention via DOM-based text escaping
- Security meta headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Firebase security rules for authenticated-only writes
- No use of `eval()`, `innerHTML` with user data, or inline event handlers

## Testing

Open `tests/index.html` in a browser to run the unit test suite. Tests cover:

- AABB collision detection
- Physics engine (gravity, tile collision)
- Camera system boundaries
- Level parsing and validation
- Player movement, scoring, death/respawn mechanics
- AI player decision-making
- Entity behavior (enemies, coins, particles)
- Input management
- Security input sanitization

## License

MIT
