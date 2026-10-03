
import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import { createRoom } from './services/roomService.js';
import { registerSocketHandlers } from './socket/socketHandlers.js';

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 4000);

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(x => x.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST']
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'watch-party-server' });
});

app.post('/api/rooms', (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 30);
  const userId = String(req.body?.userId || '').slice(0, 80);

  if (!username || !userId) {
    return res.status(400).json({
      error: 'Username and user session are required.'
    });
  }

  const room = createRoom({ username, userId });

  // DEBUG: verify the host ID when a room is created
  console.log('ROOM CREATED:', {
    roomId: room.id,
    hostUserId: room.hostUserId,
    userId,
    sameUser: room.hostUserId === userId
  });

  res.status(201).json({
    roomId: room.id,
    invitePath: `/room/${room.id}`
  });
});

registerSocketHandlers(io);

server.listen(port, () => {
  console.log(`WatchTogether server running at http://localhost:${port}`);
});