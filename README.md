# Study Assistant Bot

Study Assistant Bot is a Discord bot plus web dashboard built with Node.js, TypeScript, Express, EJS, SQLite, and DeepSeek. It is designed to run as a single Railway service with one start command and a persistent SQLite file mounted under `/data`.

## Stack

- Discord bot: `discord.js`
- Web dashboard: Express + EJS
- Database: SQLite via `better-sqlite3`
- AI backend: DeepSeek chat completions API
- Auth: Discord OAuth2 (`identify guilds`)
- Deploy target: Railway

## Features

- Slash commands for question generation, topic explanation, grading, config, and health checks
- Per-guild DeepSeek configuration
- Discord OAuth dashboard for server management
- SQLite-backed app data and SQLite-backed web sessions
- Railway-ready defaults with a single `npm run start`

## Required Environment Variables

Copy [`.env.example`](/C:/Users/trey2/Desktop/BattleBot/.env.example) and set:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DEEPSEEK_API_KEY`
- `SESSION_SECRET`

Common optional values:

- `PORT=3000`
- `SQLITE_PATH=/data/studybot.db`
- `PUBLIC_BASE_URL=https://your-railway-app.up.railway.app`
- `DISCORD_DEV_GUILD_ID=` for guild-scoped slash command registration while developing
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`

## Local Run

```powershell
npm install
npm run build
npm run dev
```

Open `http://127.0.0.1:3000`.

## Railway Notes

- Start command: `npm run start`
- Build command: `npm run build`
- Set `SQLITE_PATH=/data/studybot.db`
- Mount a persistent volume to `/data`
- Set `DISCORD_REDIRECT_URI=https://your-service.up.railway.app/auth/callback`
- Add that same callback URL in the Discord Developer Portal

## Discord App Setup

In the Discord Developer Portal:

1. Create an application and bot.
2. Copy the client ID, client secret, and bot token into Railway or your local `.env`.
3. Add your callback URL to OAuth2 redirects.
4. Invite the bot with `applications.commands` and `bot` scopes.
5. Grant at least `Send Messages`, `Use Slash Commands`, and `Read Message History`.

## Project Layout

- [`package.json`](/C:/Users/trey2/Desktop/BattleBot/package.json)
- [`tsconfig.json`](/C:/Users/trey2/Desktop/BattleBot/tsconfig.json)
- [`src/index.ts`](/C:/Users/trey2/Desktop/BattleBot/src/index.ts)
- [`src/config.ts`](/C:/Users/trey2/Desktop/BattleBot/src/config.ts)
- [`src/db/index.ts`](/C:/Users/trey2/Desktop/BattleBot/src/db/index.ts)
- [`src/discord/bot.ts`](/C:/Users/trey2/Desktop/BattleBot/src/discord/bot.ts)
- [`src/discord/deepseekClient.ts`](/C:/Users/trey2/Desktop/BattleBot/src/discord/deepseekClient.ts)
- [`src/web/server.ts`](/C:/Users/trey2/Desktop/BattleBot/src/web/server.ts)
- [`src/web/routes/dashboard.ts`](/C:/Users/trey2/Desktop/BattleBot/src/web/routes/dashboard.ts)

## Railway Start Command

Railway can use either:

- `npm run start`
- `Procfile` with `web: npm run start`
