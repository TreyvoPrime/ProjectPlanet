import dotenv from 'dotenv';

dotenv.config();

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
  port: readNumberEnv('PORT', 3000)
};

export const isProduction = config.nodeEnv === 'production';
