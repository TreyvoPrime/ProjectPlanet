import session from 'express-session';
import { AppDatabase } from '../../db';

export class SqliteSessionStore extends session.Store {
  constructor(private readonly db: AppDatabase) {
    super();
  }

  get(sid: string, callback: (err?: unknown, sessionData?: session.SessionData | null) => void): void {
    try {
      const row = this.db.getSessionRow(sid);
      if (!row) {
        callback(undefined, null);
        return;
      }
      callback(undefined, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(
    sid: string,
    sessionData: session.SessionData,
    callback?: ((err?: unknown) => void) | undefined
  ): void {
    try {
      const expiresAt = sessionData.cookie.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + 1000 * 60 * 60 * 24 * 7;
      this.db.setSessionRow(sid, JSON.stringify(sessionData), expiresAt);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: ((err?: unknown) => void) | undefined): void {
    try {
      this.db.destroySessionRow(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
}
