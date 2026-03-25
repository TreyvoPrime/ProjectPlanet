import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

export type DashboardUser = {
  id: string;
  username: string;
  avatar?: string | null;
};

export type DiscordGuildSummary = {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
};

declare module 'express-session' {
  interface SessionData {
    user?: DashboardUser;
    discordGuilds?: DiscordGuildSummary[];
    oauthState?: string;
    csrfToken?: string;
    flash?: {
      error?: string;
      success?: string;
    };
  }
}

declare global {
  namespace Express {
    interface Locals {
      currentUser?: DashboardUser;
      csrfToken?: string;
      flash?: {
        error?: string;
        success?: string;
      };
    }
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  if (!request.session.user) {
    request.session.flash = { error: 'Please log in with Discord first.' };
    response.redirect('/');
    return;
  }
  next();
}

export function attachViewLocals(request: Request, response: Response, next: NextFunction): void {
  if (!request.session.csrfToken) {
    request.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  response.locals.currentUser = request.session.user;
  response.locals.csrfToken = request.session.csrfToken;
  response.locals.flash = request.session.flash;
  delete request.session.flash;
  next();
}

export function verifyCsrf(request: Request, response: Response, next: NextFunction): void {
  const incomingToken = request.body?._csrf || request.get('x-csrf-token');
  if (!incomingToken || incomingToken !== request.session.csrfToken) {
    request.session.flash = { error: 'Your session token is invalid. Please try again.' };
    response.status(403).redirect('back');
    return;
  }
  next();
}
