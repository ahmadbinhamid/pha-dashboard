// services/websocket.service.js

const { Server } = require("socket.io");
const { logger } = require("../loaders/logging");
const { verifyJwt } = require("../utils/auth/jwt");

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
      // join() returns void with the sync in-memory adapter; `void` marks this deliberate, not a missed await.
      void socket.join(`user:${socket.user.sub}`);
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

// Targets the per-user rooms initialize() already joins; no-ops silently if no socket server is up (e.g. tests).
function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const userId of userIds) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

module.exports = { initialize, emitToUsers };
