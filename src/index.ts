import http from 'http';
import { config } from './config';
import { AppDatabase } from './db';
import { createBot } from './discord/bot';
import { DeepSeekClient } from './discord/deepseekClient';
import { createWebServer } from './web/server';

async function main(): Promise<void> {
  const db = new AppDatabase(config.sqlitePath);
  db.initialize();

  const deepSeek = new DeepSeekClient(db);
  const bot = createBot(db, deepSeek);
  const app = createWebServer(db, bot.client, deepSeek);
  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`Web dashboard listening on port ${config.port}.`);
  });

  await bot.start();

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully.`);
    server.close(() => db.close());
    bot.client.destroy();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
