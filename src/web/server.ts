import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { Client } from 'discord.js';
import { config, isProduction } from '../config';
import { AppDatabase } from '../db';
import { attachViewLocals } from './middleware/auth';
import { SqliteSessionStore } from './middleware/sessionStore';
import { createDashboardRouter } from './routes/dashboard';
import { DeepSeekClient } from '../discord/deepseekClient';

export function createWebServer(db: AppDatabase, botClient: Client, _deepSeek: DeepSeekClient) {
  const app = express();
  const viewsPath = path.resolve(process.cwd(), 'views');
  const publicPath = path.resolve(process.cwd(), 'public');

  app.set('view engine', 'ejs');
  app.set('views', viewsPath);

  app.use('/public', express.static(publicPath));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new SqliteSessionStore(db),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
    })
  );

  app.use(attachViewLocals);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many auth requests. Please try again later.'
  });

  const settingsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many settings updates. Please slow down.'
  });

  app.use('/auth', authLimiter);
  app.use('/dashboard/guild', settingsLimiter);

  app.use(createDashboardRouter(db, botClient));

  app.get('/healthz', (_request, response) => {
    response.json({
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      botReady: botClient.isReady()
    });
  });

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error('Express error:', error);
    response.status(500).render('error', {
      title: 'Error',
      message: 'Something went wrong. Please try again.'
    });
  });

  return app;
}
