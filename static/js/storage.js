/**
 * Progression storage using localStorage.
 * Tracks: highest level reached, best scores, total stats, achievements.
 */

const STORAGE_KEY = 'marioai_progress';

class ProgressStorage {
  constructor() {
    this._data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return {
      highestLevel: 0,
      bestScores: {},
      totalCoins: 0,
      totalStomps: 0,
      totalDeaths: 0,
      achievements: [],
    };
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) { /* ignore */ }
  }

  get highestLevel() { return this._data.highestLevel; }
  get totalCoins() { return this._data.totalCoins; }
  get totalStomps() { return this._data.totalStomps; }
  get totalDeaths() { return this._data.totalDeaths; }
  get achievements() { return this._data.achievements; }

  getBestScore(level) {
    return this._data.bestScores[level] || 0;
  }

  updateLevelComplete(level, score, coins, stomps) {
    if (level > this._data.highestLevel) {
      this._data.highestLevel = level;
    }
    if (!this._data.bestScores[level] || score > this._data.bestScores[level]) {
      this._data.bestScores[level] = score;
    }
    this._data.totalCoins += coins || 0;
    this._data.totalStomps += stomps || 0;
    this._save();
  }

  addStats(deaths, coins, stomps) {
    this._data.totalDeaths += deaths || 0;
    this._data.totalCoins += coins || 0;
    this._data.totalStomps += stomps || 0;
    this._save();
  }

  unlockAchievement(id) {
    if (this._data.achievements.includes(id)) return false;
    this._data.achievements.push(id);
    this._save();
    return true;
  }

  hasAchievement(id) {
    return this._data.achievements.includes(id);
  }
}

const progressStorage = new ProgressStorage();

export { ProgressStorage, progressStorage };
