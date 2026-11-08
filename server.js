const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Trust proxy for Render
app.set('trust proxy', 1);

// Store room states
const rooms = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username || 'Anonymous';

    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        videoState: {
          playing: false,
          currentTime: 0,
          lastUpdate: Date.now()
        }
      };
    }

    rooms[roomId].users.push({
      id: socket.id,
      username: socket.username
    });

    // Send current state to the new user
    socket.emit('room-state', rooms[roomId].videoState);
    io.to(roomId).emit('user-list', rooms[roomId].users);
    io.to(roomId).emit('chat-message', {
      system: true,
      message: `${socket.username} joined the room`
    });
  });

  // WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    socket.to(socket.roomId).emit('webrtc-offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('webrtc-answer', (data) => {
    socket.to(socket.roomId).emit('webrtc-answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(socket.roomId).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  socket.on('host-ready', () => {
    socket.to(socket.roomId).emit('host-ready');
  });

  socket.on('video-action', (action) => {
    if (!socket.roomId || !rooms[socket.roomId]) return;

    const room = rooms[socket.roomId];
    room.videoState = {
      ...action,
      lastUpdate: Date.now()
    };

    // Broadcast to everyone else in the room
    socket.to(socket.roomId).emit('video-sync', room.videoState);
  });

  socket.on('chat-message', (message) => {
    if (!socket.roomId) return;
    io.to(socket.roomId).emit('chat-message', {
      username: socket.username,
      message,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].users = rooms[socket.roomId].users.filter(u => u.id !== socket.id);
      io.to(socket.roomId).emit('user-list', rooms[socket.roomId].users);
      io.to(socket.roomId).emit('chat-message', {
        system: true,
        message: `${socket.username} left the room`
      });

      if (rooms[socket.roomId].users.length === 0) {
        delete rooms[socket.roomId];
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Watch Together server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
