/**
 * Multiplayer client using Socket.io.
 * Handles connection, room management, and player state sync.
 */

class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.roomCode = null;
    this.slot = null;
    this.connected = false;

    // Callbacks
    this.onPlayerJoined = null;
    this.onRemoteUpdate = null;
    this.onRemoteFlagReached = null;
    this.onRemoteNextLevel = null;
    this.onPlayerDisconnected = null;
    this.onConnectionError = null;

    this._syncCounter = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        resolve();
        return;
      }

      try {
        // Socket.io client is loaded via script tag from /socket.io/socket.io.js
        this.socket = io();

        this.socket.on('connect', () => {
          this.connected = true;
          resolve();
        });

        this.socket.on('disconnect', () => {
          this.connected = false;
        });

        this.socket.on('connect_error', (err) => {
          this.connected = false;
          if (this.onConnectionError) this.onConnectionError(err);
          reject(err);
        });

        this.socket.on('player-joined', (data) => {
          if (this.onPlayerJoined) this.onPlayerJoined(data);
        });

        this.socket.on('remote-update', (data) => {
          if (this.onRemoteUpdate) this.onRemoteUpdate(data);
        });

        this.socket.on('remote-flag-reached', (data) => {
          if (this.onRemoteFlagReached) this.onRemoteFlagReached(data);
        });

        this.socket.on('remote-next-level', (data) => {
          if (this.onRemoteNextLevel) this.onRemoteNextLevel(data);
        });

        this.socket.on('player-disconnected', (data) => {
          if (this.onPlayerDisconnected) this.onPlayerDisconnected(data);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  createRoom() {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }
      this.socket.emit('create-room', (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        this.roomCode = response.code;
        this.slot = response.slot;
        resolve(response);
      });
    });
  }

  joinRoom(code) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }
      this.socket.emit('join-room', code, (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        this.roomCode = response.code;
        this.slot = response.slot;
        resolve(response);
      });
    });
  }

  sendUpdate(playerData) {
    if (!this.socket || !this.roomCode) return;
    // Throttle to ~20Hz (every 3 frames at 60fps)
    this._syncCounter++;
    if (this._syncCounter % 3 !== 0) return;

    this.socket.emit('player-update', {
      x: playerData.x,
      y: playerData.y,
      vx: playerData.vx,
      vy: playerData.vy,
      facing: playerData.facing,
      onGround: playerData.onGround,
      alive: playerData.alive,
      score: playerData.score,
      finished: playerData.finished,
    });
  }

  sendFlagReached(score) {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit('flag-reached', { score });
  }

  sendNextLevel(level) {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit('next-level', { level });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.roomCode = null;
    this.slot = null;
  }
}

export { MultiplayerClient };
