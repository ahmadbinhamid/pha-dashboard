// server.js

const http = require("http");
const app = require("./app");
const config = require("./config");
const { connectMongo } = require("./loaders/mongoose");
const { logger } = require("./loaders/logging");
const webSocketService = require("./services/websocket.service");

(async () => {
  try {
    await connectMongo();
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize WebSocket service
    webSocketService.initialize(server);
    
    server.listen(config.port, () => {
      logger.info({ message: `Server listening on port ${config.port}` });
    });
  } catch (err) {
    logger.error({ message: "Fatal startup error", err });
    process.exit(1);
  }
})();
