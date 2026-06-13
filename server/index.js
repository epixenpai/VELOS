import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import db from './db.js';
import projectRoutes from './routes/projects.js';
import assetRoutes from './routes/assets.js';
import exportRoutes from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/export', exportRoutes);

// Serve static assets
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/exports', express.static(path.join(__dirname, '../exports')));

// Socket.io for real-time sync
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-project', (projectId) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project ${projectId}`);
  });

  socket.on('timeline-update', (data) => {
    const { projectId, state } = data;
    // Broadcast to everyone else in the project room
    socket.to(projectId).emit('timeline-sync', state);

    // Optionally trigger an async db save here to persist frequently
    // Though it's usually better to debounce this from the client via the PUT endpoint
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, () => {
  const ip = getLocalIpAddress();
  console.log(`Server running at http://${ip}:${PORT}`);
  console.log(`Local network URL: http://${ip}:${PORT}`);
});
