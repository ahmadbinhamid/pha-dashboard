// services/websocket.service.js

const { Server } = require("socket.io");
const { logger } = require("../loaders/logging");
const { verifyJwt } = require("../utils/jwt");

let io = null;

function initialize(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // JWT auth handshake
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      // Allow unauthenticated connections; set socket.user = null
      socket.user = null;
      return next();
    }

    try {
      socket.user = verifyJwt(token);
    } catch {
      socket.user = null;
    }

    return next();
  });

  io.on("connection", (socket) => {
    logger.info({
      message: "WebSocket connected",
      socketId: socket.id,
      userId: socket.user?.sub ?? "anonymous",
    });

    // Join a personal room so the server can target this user
    if (socket.user?.sub) {
      socket.join(`user:${socket.user.sub}`);
    }

    socket.on("disconnect", (reason) => {
      logger.info({
        message: "WebSocket disconnected",
        socketId: socket.id,
        reason,
      });
    });
  });

  logger.info({ message: "WebSocket service initialized" });
  return io;
}

// Emit to a specific user's room
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

// Broadcast to all connected clients
function broadcast(event, data) {
  if (!io) return;
  io.emit(event, data);
}

function getIO() {
  return io;
}

module.exports = { initialize, emitToUser, broadcast, getIO };
