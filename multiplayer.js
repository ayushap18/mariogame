/**
 * Multiplayer module using Socket.io.
 * Room-based system: players create/join rooms with 4-char codes.
 * Handles player sync, flag events, level transitions, and disconnects.
 */

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function setupMultiplayer(io) {
  io.on('connection', (socket) => {
    let currentRoom = null;
    let playerSlot = null;

    socket.on('create-room', (callback) => {
      if (currentRoom) {
        leaveRoom(socket, currentRoom, playerSlot);
      }

      const code = generateRoomCode();
      rooms.set(code, {
        players: [socket.id],
        created: Date.now(),
        level: 0,
      });
      currentRoom = code;
      playerSlot = 0;
      socket.join(code);
      callback({ code, slot: 0 });
    });

    socket.on('join-room', (code, callback) => {
      if (typeof code !== 'string') {
        callback({ error: 'Invalid room code.' });
        return;
      }
      code = code.toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        callback({ error: 'Room not found.' });
        return;
      }
      if (room.players.length >= 2) {
        callback({ error: 'Room is full.' });
        return;
      }

      if (currentRoom) {
        leaveRoom(socket, currentRoom, playerSlot);
      }

      room.players.push(socket.id);
      currentRoom = code;
      playerSlot = 1;
      socket.join(code);

      callback({ code, slot: 1 });

      // Notify player 1 that player 2 joined
      socket.to(code).emit('player-joined', { slot: 1 });
    });

    socket.on('player-update', (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('remote-update', {
        slot: playerSlot,
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        facing: data.facing,
        onGround: data.onGround,
        alive: data.alive,
        score: data.score,
        finished: data.finished,
      });
    });

    socket.on('flag-reached', (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('remote-flag-reached', {
        slot: playerSlot,
        score: data.score,
      });
    });

    socket.on('next-level', (data) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) {
        room.level = data.level;
      }
      socket.to(currentRoom).emit('remote-next-level', {
        level: data.level,
      });
    });

    socket.on('disconnect', () => {
      if (currentRoom) {
        leaveRoom(socket, currentRoom, playerSlot);
      }
    });
  });

  // Clean up stale rooms every 60 seconds
  setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    for (const [code, room] of rooms) {
      if (now - room.created > maxAge || room.players.length === 0) {
        rooms.delete(code);
      }
    }
  }, 60_000);
}

function leaveRoom(socket, code, slot) {
  const room = rooms.get(code);
  if (!room) return;

  room.players = room.players.filter(id => id !== socket.id);
  socket.leave(code);
  socket.to(code).emit('player-disconnected', { slot });

  if (room.players.length === 0) {
    rooms.delete(code);
  }
}

export { setupMultiplayer, rooms };
