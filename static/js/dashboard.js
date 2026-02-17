/**
 * Dashboard controller for the landing page.
 * Handles navigation, leaderboard display, user auth UI,
 * game launch, and AI companion chat (powered by Google Gemini).
 */

import { initFirebase, signInWithGoogle, signOut, getUser, getLeaderboard, trackPageView, trackEvent } from './services.js';
import { audioManager } from './audio.js';
import { voiceHelper } from './voice.js';
import { isGeminiAvailable, chatWithCompanion } from './gemini.js';
import { progressStorage } from './storage.js';

class Dashboard {
  constructor() {
    this.currentView = 'home';
    this._bindElements();
    this._bindEvents();
    initFirebase();
    trackPageView('dashboard');
    this._updateAuthUI();
    this._loadLeaderboard();

    document.addEventListener('auth-changed', () => this._updateAuthUI());
  }

  _bindElements() {
    this.playBtn = document.getElementById('play-btn');
    this.aiBtn = document.getElementById('ai-btn');
    this.timeAttackBtn = document.getElementById('timeattack-btn');
    this.companionBtn = document.getElementById('companion-btn');
    this.leaderboardBtn = document.getElementById('leaderboard-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.signInBtn = document.getElementById('sign-in-btn');
    this.signOutBtn = document.getElementById('sign-out-btn');
    this.userName = document.getElementById('user-name');
    this.userAvatar = document.getElementById('user-avatar');
    this.companionPanel = document.getElementById('companion-panel');
    this.companionMessages = document.getElementById('companion-messages');
    this.companionForm = document.getElementById('companion-form');
    this.companionInput = document.getElementById('companion-input');
    this.companionStatus = document.getElementById('companion-status');
    this.closeCompanion = document.getElementById('close-companion');
    this.leaderboardPanel = document.getElementById('leaderboard-panel');
    this.leaderboardBody = document.getElementById('leaderboard-body');
    this.closeLeaderboard = document.getElementById('close-leaderboard');
    this.settingsPanel = document.getElementById('settings-panel');
    this.closeSettings = document.getElementById('close-settings');
    this.volumeSlider = document.getElementById('volume-slider');
    this.soundToggle = document.getElementById('sound-toggle');
    this.highContrastToggle = document.getElementById('high-contrast-toggle');
    this.reducedMotionToggle = document.getElementById('reduced-motion-toggle');
    this.voiceToggle = document.getElementById('voice-toggle');
    this.levelSelectBtn = document.getElementById('levelselect-btn');
    this.levelSelectPanel = document.getElementById('levelselect-panel');
    this.closeLevelSelect = document.getElementById('close-levelselect');
    this.levelGrid = document.getElementById('level-grid');
    this.multiplayerBtn = document.getElementById('multiplayer-btn');
    this.multiplayerPanel = document.getElementById('multiplayer-panel');
    this.closeMultiplayer = document.getElementById('close-multiplayer');
    this.createRoomBtn = document.getElementById('create-room-btn');
    this.joinRoomBtn = document.getElementById('join-room-btn');
    this.joinCodeInput = document.getElementById('join-code-input');
    this.lobbyStatus = document.getElementById('lobby-status');
    this.lobbyContent = document.getElementById('lobby-content');
  }

  _bindEvents() {
    this.playBtn?.addEventListener('click', () => this._startGame(false));
    this.aiBtn?.addEventListener('click', () => this._startGame(true));
    this.timeAttackBtn?.addEventListener('click', () => this._startGame(false, true));
    this.signInBtn?.addEventListener('click', () => this._signIn());
    this.signOutBtn?.addEventListener('click', () => this._signOut());

    this.companionBtn?.addEventListener('click', () => this._togglePanel('companion'));
    this.closeCompanion?.addEventListener('click', () => this._closePanel('companion'));
    this.companionForm?.addEventListener('submit', (e) => this._handleCompanionSubmit(e));

    this.leaderboardBtn?.addEventListener('click', () => this._togglePanel('leaderboard'));
    this.closeLeaderboard?.addEventListener('click', () => this._closePanel('leaderboard'));

    this.settingsBtn?.addEventListener('click', () => this._togglePanel('settings'));
    this.closeSettings?.addEventListener('click', () => this._closePanel('settings'));

    this.levelSelectBtn?.addEventListener('click', () => this._togglePanel('levelselect'));
    this.closeLevelSelect?.addEventListener('click', () => this._closePanel('levelselect'));

    this.multiplayerBtn?.addEventListener('click', () => this._togglePanel('multiplayer'));
    this.closeMultiplayer?.addEventListener('click', () => this._closePanel('multiplayer'));
    this.createRoomBtn?.addEventListener('click', () => this._createRoom());
    this.joinRoomBtn?.addEventListener('click', () => this._joinRoom());

    this.volumeSlider?.addEventListener('input', (e) => {
      audioManager.setVolume(Number(e.target.value) / 100);
    });
    this.soundToggle?.addEventListener('change', () => {
      audioManager.toggle();
    });
    this.highContrastToggle?.addEventListener('change', (e) => {
      document.body.classList.toggle('high-contrast', e.target.checked);
      localStorage.setItem('highContrast', e.target.checked);
    });
    this.reducedMotionToggle?.addEventListener('change', (e) => {
      document.body.classList.toggle('reduced-motion', e.target.checked);
      localStorage.setItem('reducedMotion', e.target.checked);
    });
    this.voiceToggle?.addEventListener('change', () => {
      voiceHelper.toggle();
      if (voiceHelper.enabled) {
        voiceHelper.speak('AI voice helper activated!');
      }
    });

    if (localStorage.getItem('highContrast') === 'true') {
      document.body.classList.add('high-contrast');
      if (this.highContrastToggle) this.highContrastToggle.checked = true;
    }
    if (localStorage.getItem('reducedMotion') === 'true') {
      document.body.classList.add('reduced-motion');
      if (this.reducedMotionToggle) this.reducedMotionToggle.checked = true;
    }
    if (voiceHelper.enabled && this.voiceToggle) {
      this.voiceToggle.checked = true;
    }

    this.playBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._startGame(false);
      }
    });
    this.aiBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._startGame(true);
      }
    });

    // Escape key closes any open panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const panels = ['companion', 'leaderboard', 'settings', 'levelselect', 'multiplayer'];
        for (const panel of panels) {
          const el = { companion: this.companionPanel, leaderboard: this.leaderboardPanel, settings: this.settingsPanel, levelselect: this.levelSelectPanel, multiplayer: this.multiplayerPanel }[panel];
          if (el && !el.hidden) {
            this._closePanel(panel);
            break;
          }
        }
      }
    });
  }

  _startGame(aiMode, timeAttack) {
    audioManager.init();
    audioManager.menuSelect();
    let params = '';
    if (aiMode) params = '?mode=ai';
    else if (timeAttack) params = '?mode=timeattack';
    window.location.href = 'game.html' + params;
  }

  async _signIn() {
    const user = await signInWithGoogle();
    if (user) {
      this._updateAuthUI();
      this._loadLeaderboard();
    }
  }

  async _signOut() {
    await signOut();
    this._updateAuthUI();
  }

  _updateAuthUI() {
    const user = getUser();
    if (user) {
      if (this.signInBtn) this.signInBtn.hidden = true;
      if (this.signOutBtn) this.signOutBtn.hidden = false;
      if (this.userName) this.userName.textContent = user.displayName || 'Player';
      if (this.userAvatar) {
        this.userAvatar.src = user.photoURL || '';
        this.userAvatar.alt = `${user.displayName || 'Player'} avatar`;
        this.userAvatar.hidden = !user.photoURL;
      }
    } else {
      if (this.signInBtn) this.signInBtn.hidden = false;
      if (this.signOutBtn) this.signOutBtn.hidden = true;
      if (this.userName) this.userName.textContent = '';
      if (this.userAvatar) this.userAvatar.hidden = true;
    }
  }

  async _loadLeaderboard() {
    const scores = await getLeaderboard(10);
    if (!this.leaderboardBody) return;

    if (scores.length === 0) {
      this.leaderboardBody.innerHTML = '<tr><td colspan="4" class="center">No scores yet. Be the first!</td></tr>';
      return;
    }

    this.leaderboardBody.innerHTML = scores.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.score.toLocaleString()}</td>
        <td>${s.mode === 'ai' ? 'VS AI' : 'Solo'}</td>
      </tr>
    `).join('');
  }

  _togglePanel(panel) {
    const panels = {
      companion: this.companionPanel,
      leaderboard: this.leaderboardPanel,
      settings: this.settingsPanel,
      levelselect: this.levelSelectPanel,
      multiplayer: this.multiplayerPanel,
    };
    const el = panels[panel];
    if (!el) return;

    const isHidden = el.hidden;

    // Close all panels
    for (const p of Object.values(panels)) {
      if (p) p.hidden = true;
    }

    el.hidden = !isHidden;

    // Update aria-expanded on toggle buttons
    const toggleBtns = {
      companion: this.companionBtn,
      leaderboard: this.leaderboardBtn,
      settings: this.settingsBtn,
      levelselect: this.levelSelectBtn,
      multiplayer: this.multiplayerBtn,
    };
    for (const [key, btn] of Object.entries(toggleBtns)) {
      if (btn) btn.setAttribute('aria-expanded', String(key === panel && !el.hidden));
    }

    if (!el.hidden) {
      const focusable = el.querySelector('button, [tabindex], input');
      if (focusable) focusable.focus();
      if (panel === 'leaderboard') this._loadLeaderboard();
      if (panel === 'companion') this._checkCompanionAvailability();
      if (panel === 'levelselect') this._loadLevelSelect();
    }
  }

  _closePanel(panel) {
    const panels = {
      companion: this.companionPanel,
      leaderboard: this.leaderboardPanel,
      settings: this.settingsPanel,
      levelselect: this.levelSelectPanel,
      multiplayer: this.multiplayerPanel,
    };
    const btns = {
      companion: this.companionBtn,
      leaderboard: this.leaderboardBtn,
      settings: this.settingsBtn,
      levelselect: this.levelSelectBtn,
      multiplayer: this.multiplayerBtn,
    };
    const el = panels[panel];
    if (el) el.hidden = true;
    const btn = btns[panel];
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  }

  async _checkCompanionAvailability() {
    const available = await isGeminiAvailable();
    if (!available && this.companionStatus) {
      this.companionStatus.textContent = 'AI companion not available. Set GEMINI_API_KEY on the server.';
    }
  }

  async _handleCompanionSubmit(e) {
    e.preventDefault();
    const message = this.companionInput?.value?.trim();
    if (!message) return;

    // Add user message to chat
    this._addCompanionMessage(message, 'user');
    if (this.companionInput) this.companionInput.value = '';
    if (this.companionStatus) this.companionStatus.textContent = 'Thinking...';

    trackEvent('companion_chat', { message_length: message.length });

    const reply = await chatWithCompanion(message);
    if (this.companionStatus) this.companionStatus.textContent = '';

    if (reply) {
      this._addCompanionMessage(reply, 'ai');
      voiceHelper.speakCommentary(reply);
    } else {
      this._addCompanionMessage('Sorry, I could not respond. Please try again later.', 'ai');
    }
  }

  _addCompanionMessage(text, sender) {
    if (!this.companionMessages) return;
    const div = document.createElement('div');
    div.className = `companion-msg companion-${sender}`;
    div.textContent = text;
    this.companionMessages.appendChild(div);
    this.companionMessages.scrollTop = this.companionMessages.scrollHeight;
  }

  _loadLevelSelect() {
    if (!this.levelGrid) return;
    const highest = progressStorage.highestLevel;
    const maxShow = Math.max(highest + 1, 3);

    this.levelGrid.innerHTML = '';
    for (let i = 1; i <= maxShow; i++) {
      const btn = document.createElement('button');
      const locked = i > highest + 1;
      const best = progressStorage.getBestScore(i);

      btn.className = 'level-btn' + (locked ? ' level-locked' : '') + (best > 0 ? ' level-cleared' : '');
      btn.setAttribute('aria-label', locked ? `Level ${i} - Locked` : `Level ${i}${best > 0 ? ' - Best: ' + best.toLocaleString() : ''}`);

      if (locked) {
        btn.innerHTML = `<span class="level-num">${i}</span><span class="level-lock">LOCKED</span>`;
        btn.disabled = true;
      } else {
        btn.innerHTML = `<span class="level-num">${i}</span>${best > 0 ? `<span class="level-score">${best.toLocaleString()}</span>` : '<span class="level-score">---</span>'}`;
        btn.addEventListener('click', () => {
          audioManager.init();
          audioManager.menuSelect();
          window.location.href = `game.html?level=${i}`;
        });
      }

      this.levelGrid.appendChild(btn);
    }
  }

  async _createRoom() {
    if (!window.io) {
      if (this.lobbyStatus) this.lobbyStatus.textContent = 'Multiplayer not available.';
      return;
    }

    if (this.lobbyStatus) this.lobbyStatus.textContent = 'Connecting...';

    try {
      const socket = window.io();
      socket.on('connect', () => {
        socket.emit('create-room', (response) => {
          if (response.error) {
            if (this.lobbyStatus) this.lobbyStatus.textContent = response.error;
            return;
          }

          if (this.lobbyContent) {
            this.lobbyContent.innerHTML = `
              <p class="lobby-waiting">Share this code with a friend:</p>
              <div class="lobby-room-code">${response.code}</div>
              <p class="lobby-waiting">Waiting for opponent to join...</p>
              <div id="lobby-status" class="lobby-status"></div>
            `;
          }

          socket.on('player-joined', () => {
            audioManager.init();
            audioManager.menuSelect();
            window.location.href = `game.html?mode=multiplayer&room=${response.code}`;
          });
        });
      });

      socket.on('connect_error', () => {
        if (this.lobbyStatus) this.lobbyStatus.textContent = 'Connection failed.';
      });
    } catch (err) {
      if (this.lobbyStatus) this.lobbyStatus.textContent = 'Connection failed.';
    }
  }

  async _joinRoom() {
    const code = this.joinCodeInput?.value?.trim().toUpperCase();
    if (!code || code.length !== 4) {
      if (this.lobbyStatus) this.lobbyStatus.textContent = 'Enter a 4-character code.';
      return;
    }

    if (!window.io) {
      if (this.lobbyStatus) this.lobbyStatus.textContent = 'Multiplayer not available.';
      return;
    }

    if (this.lobbyStatus) this.lobbyStatus.textContent = 'Joining...';

    try {
      const socket = window.io();
      socket.on('connect', () => {
        socket.emit('join-room', code, (response) => {
          if (response.error) {
            if (this.lobbyStatus) this.lobbyStatus.textContent = response.error;
            socket.disconnect();
            return;
          }

          audioManager.init();
          audioManager.menuSelect();
          window.location.href = `game.html?mode=multiplayer&room=${response.code}`;
        });
      });

      socket.on('connect_error', () => {
        if (this.lobbyStatus) this.lobbyStatus.textContent = 'Connection failed.';
      });
    } catch (err) {
      if (this.lobbyStatus) this.lobbyStatus.textContent = 'Connection failed.';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});

export { Dashboard };
