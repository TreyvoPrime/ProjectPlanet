import path from 'path';
import express from 'express';
import { createSiteRouter } from './routes/dashboard';

export function createWebServer() {
  const app = express();
  const viewsPath = path.resolve(process.cwd(), 'views');
  const publicPath = path.resolve(process.cwd(), 'public');

  app.set('view engine', 'ejs');
  app.set('views', viewsPath);

  app.use('/public', express.static(publicPath));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use(createSiteRouter());

  app.get('/healthz', (_request, response) => {
    response.json({
      ok: true,
      uptimeSeconds: Math.round(process.uptime())
    });
  });

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error('Express error:', error);
    response.status(500).render('error', {
      title: 'Project Planet',
      message: 'Something went wrong. Please try again.'
    });
  });

  return app;
}
