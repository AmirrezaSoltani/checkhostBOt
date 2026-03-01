import { connectDb, disconnectDb } from './db/index.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { createBot } from './bot/index.js';
import { startScheduler, stopScheduler } from './monitor/scheduler.js';
import { createApi, startApi } from './api/index.js';

let apiServer = null;

async function main() {
  if (!config.BOT_TOKEN) {
    logger.error('BOT_TOKEN is required');
    process.exit(1);
  }

  await connectDb();

  const bot = createBot();
  bot.catch((err) => logger.error({ err }, 'Bot error'));
  await bot.start({
    onStart: (info) => logger.info({ username: info.username }, 'Bot started'),
  });

  startScheduler();

  const app = createApi();
  apiServer = await startApi(app);

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down');
    stopScheduler();
    if (bot) await bot.stop();
    if (apiServer) await new Promise((r) => apiServer.close(r));
    await disconnectDb();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal');
  process.exit(1);
});
