import http from 'http';
import { config } from './config';
import { createWebServer } from './web/server';

async function main(): Promise<void> {
  const app = createWebServer();
  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`Project Planet listening on port ${config.port}.`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully.`);
    server.close();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
