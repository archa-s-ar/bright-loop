const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

async function startServer() {
  try {
    // 1. Verify Database Connection
    await prisma.$connect();
    console.log('✅ Connected to MySQL database via Prisma');

    // 2. Start HTTP listener
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Brightloop server listening on http://localhost:${env.PORT}`);
      console.log(`🌐 Static frontend served at http://localhost:${env.PORT}/login.html`);
      console.log(`🩺 Health check available at http://localhost:${env.PORT}/api/health`);
    });

    // 3. Graceful shutdown handler
    const shutdown = async (signal) => {
      console.log(`\n⚠️  Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        console.log('🛑 Closed HTTP server');
        await prisma.$disconnect();
        console.log('🔌 Disconnected Prisma database client');
        process.exit(0);
      });

      // Force exit after 10s timeout
      setTimeout(() => {
        console.error('❌ Forcefully terminating server after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
