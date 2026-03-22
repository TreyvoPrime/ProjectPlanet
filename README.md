# BattleBot Command

BattleBot Command is a public-facing Discord bot for regiment-style battle dispatches. Server managers log in with Discord, configure regiment-to-role mappings in a Napoleonic-themed dashboard, and use `/battleping` to DM the right rankers with the VC link while skipping members already in that voice channel.

## Launch Stack

- Python + `discord.py`
- FastAPI dashboard
- SQLite for launch storage
- Railway for hosting

## Core Features

- Discord OAuth login for the dashboard
- Guild permission checks before showing server settings
- Per-server command staff roles
- Per-server regiment mappings
- Per-server cooldowns
- SQLite-backed server-side OAuth sessions
- Guided setup wizard for first-time server onboarding

## Environment Variables

Copy `.env.example` and set these values:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `PUBLIC_BASE_URL`
- `DISCORD_REDIRECT_URI`
- `SESSION_SECRET`

Optional:

- `DATABASE_PATH`
- `DEFAULT_COOLDOWN_MINUTES`
- `DM_SEND_DELAY_SECONDS`
- `DISCORD_BOT_PERMISSIONS`

## Local Run

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000`.

## Railway Setup

1. Push this repo to GitHub.
2. Create a fresh Railway project from the GitHub repo.
3. Make sure the project contains only one public app service for this repo. Do not attach your public domain to any database service.
4. Prefer the Dockerfile deploy path for a deterministic build.
5. Add a persistent volume and mount it only if you want SQLite persistence across redeploys.
6. Set the environment variables from `.env.example`.
7. In the Discord Developer Portal, add the Railway callback URL:
   `https://your-app.up.railway.app/auth/callback`
8. Deploy.

Recommended `DATABASE_PATH` on Railway:

```text
/data/battlebot.db
```

Fastest test-only fallback if you do not have a volume mounted yet:

```text
./battlebot.db
```

## Clean Railway Rebuild

If Railway got into a weird state with multiple services or the public domain is pointing at the wrong thing, the clean reset path is:

1. Create a brand new Railway project.
2. Deploy only this GitHub repository into that new project.
3. Do not add MySQL or any other database service.
4. Generate one public domain for the app service only.
5. Set:
   `PUBLIC_BASE_URL=https://your-service.up.railway.app`
6. Set:
   `DISCORD_REDIRECT_URI=https://your-service.up.railway.app/auth/callback`
7. Add that same callback URL in the Discord Developer Portal.
8. Redeploy and test `/healthz`.

## Discord Application Setup

In the Discord Developer Portal:

- Enable the `SERVER MEMBERS INTENT`
- Add OAuth redirect URL: `https://your-app.up.railway.app/auth/callback`
- Use the bot invite URL from the landing page or dashboard

## Health Check

- `GET /healthz`

## GitHub Push

```powershell
git init
git add .
git commit -m "Initial BattleBot launch"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```
