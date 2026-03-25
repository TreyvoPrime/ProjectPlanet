import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readNumberEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number.`);
  }
  return parsed;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readNumberEnv('PORT', 3000),
  discordBotToken: readRequiredEnv('DISCORD_BOT_TOKEN'),
  discordClientId: readRequiredEnv('DISCORD_CLIENT_ID'),
  discordClientSecret: readRequiredEnv('DISCORD_CLIENT_SECRET'),
  discordRedirectUri: readRequiredEnv('DISCORD_REDIRECT_URI'),
  deepSeekApiKey: readRequiredEnv('DEEPSEEK_API_KEY'),
  sessionSecret: readRequiredEnv('SESSION_SECRET'),
  sqlitePath:
    process.env.SQLITE_PATH?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    path.resolve(process.cwd(), 'data', 'studybot.db'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || '',
  discordDevGuildId: process.env.DISCORD_DEV_GUILD_ID?.trim() || '',
  deepSeekBaseUrl: (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/$/, ''),
  deepSeekTimeoutMs: readNumberEnv('DEEPSEEK_TIMEOUT_MS', 25_000)
};

export const isProduction = config.nodeEnv === 'production';
