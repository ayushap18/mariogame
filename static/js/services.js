/**
 * Firebase and Google services integration.
 * Handles authentication (Google Sign-In), Firestore leaderboard,
 * and Google Analytics 4 event tracking.
 *
 * IMPORTANT: Replace the firebaseConfig values with your own
 * Firebase project credentials before deploying.
 */

/* global firebase, gtag */

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'YOUR_MEASUREMENT_ID',
};

let app = null;
let auth = null;
let db = null;
let currentUser = null;
let _initialized = false;

function initFirebase() {
  if (_initialized) return;
  try {
    if (typeof firebase === 'undefined') return;
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    _initialized = true;

    auth.onAuthStateChanged((user) => {
      currentUser = user;
      document.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
    });
  } catch (e) {
    console.warn('Firebase initialization skipped:', e.message);
  }
}

async function signInWithGoogle() {
  if (!auth) return null;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    trackEvent('login', { method: 'google' });
    return result.user;
  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error('Sign-in error:', error.message);
    }
    return null;
  }
}

async function signOut() {
  if (!auth) return;
  try {
    await auth.signOut();
    trackEvent('logout');
  } catch (error) {
    console.error('Sign-out error:', error.message);
  }
}

function getUser() {
  return currentUser;
}

async function submitScore(score, level, coins, mode) {
  if (!db || !currentUser) return false;

  const sanitizedName = sanitizeInput(currentUser.displayName || 'Anonymous');

  try {
    await db.collection('leaderboard').add({
      uid: currentUser.uid,
      name: sanitizedName,
      score: Number(score) || 0,
      level: Number(level) || 1,
      coins: Number(coins) || 0,
      mode: mode === 'ai' ? 'ai' : 'solo',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    trackEvent('score_submitted', { score, level, mode });
    return true;
  } catch (error) {
    console.error('Score submission error:', error.message);
    return false;
  }
}

async function getLeaderboard(limit) {
  if (!db) return [];
  try {
    const snapshot = await db.collection('leaderboard')
      .orderBy('score', 'desc')
      .limit(Math.min(limit || 10, 50))
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        name: sanitizeOutput(data.name),
        score: data.score,
        level: data.level,
        coins: data.coins,
        mode: data.mode,
      };
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error.message);
    return [];
  }
}

function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, '').slice(0, 50);
}

function sanitizeOutput(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function trackEvent(eventName, params) {
  try {
    if (typeof gtag === 'function') {
      gtag('event', eventName, params || {});
    }
  } catch (e) {
    // Analytics not available
  }
}

function trackPageView(pageName) {
  trackEvent('page_view', { page_title: pageName });
}

function trackGameStart(mode, level) {
  trackEvent('game_start', { mode, level });
}

function trackLevelComplete(level, score, time) {
  trackEvent('level_complete', { level, score, time_remaining: time });
}

function trackGameOver(score, level, coins) {
  trackEvent('game_over', { score, level, coins });
}

function isFirebaseReady() {
  return _initialized;
}

export {
  initFirebase,
  signInWithGoogle,
  signOut,
  getUser,
  submitScore,
  getLeaderboard,
  trackEvent,
  trackPageView,
  trackGameStart,
  trackLevelComplete,
  trackGameOver,
  isFirebaseReady,
  sanitizeInput,
  sanitizeOutput,
};
