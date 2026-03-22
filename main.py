import asyncio
import json
import os
import secrets
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

import aiosqlite
import discord
import httpx
from discord import app_commands
from discord.ext import commands
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware


BASE_DIR = Path(__file__).parent
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "battlebot.db"))
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN") or os.getenv("TOKEN")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", f"{PUBLIC_BASE_URL}/auth/callback")
SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_urlsafe(32))
DISCORD_BOT_PERMISSIONS = os.getenv("DISCORD_BOT_PERMISSIONS", "268437504")
DEFAULT_COOLDOWN_MINUTES = int(os.getenv("DEFAULT_COOLDOWN_MINUTES", "2"))
MAX_REGIMENTS_PER_GUILD = 25
DM_SEND_DELAY_SECONDS = float(os.getenv("DM_SEND_DELAY_SECONDS", "0.35"))
DISCORD_API_BASE = "https://discord.com/api/v10"

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class GuildConfig:
    guild_id: int
    cooldown_minutes: int
    updated_at: str


@dataclass
class RegimentConfig:
    id: int
    guild_id: int
    regiment_name: str
    role_id: int
    role_name_snapshot: str
    sort_order: int


class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path

    async def initialize(self) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id INTEGER PRIMARY KEY,
                    cooldown_minutes INTEGER NOT NULL DEFAULT 2,
                    updated_at TEXT NOT NULL
                )
                """
            )
            columns = {
                row[1]
                for row in await (await db.execute("PRAGMA table_info(guild_settings)")).fetchall()
            }
            if "dashboard_token" in columns:
                await db.execute("ALTER TABLE guild_settings RENAME TO guild_settings_legacy")
                await db.execute(
                    """
                    CREATE TABLE guild_settings (
                        guild_id INTEGER PRIMARY KEY,
                        cooldown_minutes INTEGER NOT NULL DEFAULT 2,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                await db.execute(
                    """
                    INSERT INTO guild_settings (guild_id, cooldown_minutes, updated_at)
                    SELECT guild_id, cooldown_minutes, updated_at
                    FROM guild_settings_legacy
                    """
                )
                await db.execute("DROP TABLE guild_settings_legacy")
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS admin_roles (
                    guild_id INTEGER NOT NULL,
                    role_id INTEGER NOT NULL,
                    PRIMARY KEY (guild_id, role_id)
                )
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS regiments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id INTEGER NOT NULL,
                    regiment_name TEXT NOT NULL,
                    role_id INTEGER NOT NULL,
                    role_name_snapshot TEXT NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    UNIQUE (guild_id, regiment_name),
                    UNIQUE (guild_id, role_id)
                )
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS oauth_sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    user_payload TEXT NOT NULL,
                    guilds_payload TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL
                )
                """
            )
            oauth_columns = {
                row[1]
                for row in await (await db.execute("PRAGMA table_info(oauth_sessions)")).fetchall()
            }
            if "guilds_payload" not in oauth_columns:
                await db.execute(
                    "ALTER TABLE oauth_sessions ADD COLUMN guilds_payload TEXT NOT NULL DEFAULT '[]'"
                )
            await db.commit()

    async def ensure_guild(self, guild_id: int) -> GuildConfig:
        existing = await self.get_guild_config(guild_id)
        if existing:
            return existing
        updated_at = utc_now().isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO guild_settings (guild_id, cooldown_minutes, updated_at)
                VALUES (?, ?, ?)
                """,
                (guild_id, DEFAULT_COOLDOWN_MINUTES, updated_at),
            )
            await db.commit()
        return GuildConfig(
            guild_id=guild_id,
            cooldown_minutes=DEFAULT_COOLDOWN_MINUTES,
            updated_at=updated_at,
        )

    async def get_guild_config(self, guild_id: int) -> Optional[GuildConfig]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """
                SELECT guild_id, cooldown_minutes, updated_at
                FROM guild_settings
                WHERE guild_id = ?
                """,
                (guild_id,),
            )
            row = await cursor.fetchone()
        if not row:
            return None
        return GuildConfig(*row)

    async def update_cooldown(self, guild_id: int, cooldown_minutes: int) -> None:
        await self.ensure_guild(guild_id)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE guild_settings
                SET cooldown_minutes = ?, updated_at = ?
                WHERE guild_id = ?
                """,
                (cooldown_minutes, utc_now().isoformat(), guild_id),
            )
            await db.commit()

    async def get_admin_role_ids(self, guild_id: int) -> list[int]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT role_id FROM admin_roles WHERE guild_id = ? ORDER BY role_id",
                (guild_id,),
            )
            rows = await cursor.fetchall()
        return [row[0] for row in rows]

    async def add_admin_role(self, guild_id: int, role_id: int) -> None:
        await self.ensure_guild(guild_id)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR IGNORE INTO admin_roles (guild_id, role_id)
                VALUES (?, ?)
                """,
                (guild_id, role_id),
            )
            await db.commit()

    async def remove_admin_role(self, guild_id: int, role_id: int) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "DELETE FROM admin_roles WHERE guild_id = ? AND role_id = ?",
                (guild_id, role_id),
            )
            await db.commit()

    async def get_regiments(self, guild_id: int) -> list[RegimentConfig]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """
                SELECT id, guild_id, regiment_name, role_id, role_name_snapshot, sort_order
                FROM regiments
                WHERE guild_id = ?
                ORDER BY sort_order, LOWER(regiment_name)
                """,
                (guild_id,),
            )
            rows = await cursor.fetchall()
        return [RegimentConfig(*row) for row in rows]

    async def upsert_regiment(
        self,
        guild_id: int,
        regiment_name: str,
        role_id: int,
        role_name_snapshot: str,
    ) -> None:
        await self.ensure_guild(guild_id)
        regiments = await self.get_regiments(guild_id)
        if len(regiments) >= MAX_REGIMENTS_PER_GUILD and not any(
            entry.regiment_name.lower() == regiment_name.lower() for entry in regiments
        ):
            raise ValueError(f"You can configure up to {MAX_REGIMENTS_PER_GUILD} regiments per server.")

        existing = next(
            (entry for entry in regiments if entry.regiment_name.lower() == regiment_name.lower()),
            None,
        )
        sort_order = existing.sort_order if existing else len(regiments) + 1

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO regiments (guild_id, regiment_name, role_id, role_name_snapshot, sort_order)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, regiment_name)
                DO UPDATE SET role_id = excluded.role_id, role_name_snapshot = excluded.role_name_snapshot
                """,
                (guild_id, regiment_name.strip(), role_id, role_name_snapshot, sort_order),
            )
            await db.commit()

    async def delete_regiment(self, guild_id: int, regiment_name: str) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM regiments WHERE guild_id = ? AND LOWER(regiment_name) = LOWER(?)",
                (guild_id, regiment_name),
            )
            await db.commit()
        return cursor.rowcount > 0

    async def delete_regiment_by_id(self, guild_id: int, regiment_id: int) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM regiments WHERE guild_id = ? AND id = ?",
                (guild_id, regiment_id),
            )
            await db.commit()
        return cursor.rowcount > 0

    async def create_oauth_session(self, user_payload: dict, guilds_payload: list[dict], access_token: str) -> str:
        session_id = secrets.token_urlsafe(32)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO oauth_sessions (session_id, user_id, access_token, user_payload, guilds_payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    str(user_payload["id"]),
                    access_token,
                    json.dumps(user_payload),
                    json.dumps(guilds_payload),
                    utc_now().isoformat(),
                ),
            )
            await db.commit()
        return session_id

    async def get_oauth_session(self, session_id: str) -> Optional[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """
                SELECT user_id, access_token, user_payload, guilds_payload, created_at
                FROM oauth_sessions
                WHERE session_id = ?
                """,
                (session_id,),
            )
            row = await cursor.fetchone()
        if not row:
            return None
        user_id, access_token, user_payload, guilds_payload, created_at = row
        payload = json.loads(user_payload)
        payload["id"] = user_id
        return {
            "session_id": session_id,
            "access_token": access_token,
            "user": payload,
            "guilds": json.loads(guilds_payload),
            "created_at": created_at,
        }

    async def delete_oauth_session(self, session_id: str) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM oauth_sessions WHERE session_id = ?", (session_id,))
            await db.commit()


database = Database(DATABASE_PATH)


intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.voice_states = True

bot = commands.Bot(command_prefix="!", intents=intents)
guild_cooldowns: dict[int, datetime] = {}


async def ensure_guild_ready(guild_id: int) -> GuildConfig:
    return await database.ensure_guild(guild_id)


async def member_can_manage_guild(member: discord.Member) -> bool:
    if member.guild_permissions.administrator or member.guild_permissions.manage_guild:
        return True

    admin_role_ids = set(await database.get_admin_role_ids(member.guild.id))
    if not admin_role_ids:
        return False
    return any(role.id in admin_role_ids for role in member.roles)


def extract_vc_id(vc_link: str) -> Optional[int]:
    try:
        return int(vc_link.strip().rstrip("/").split("/")[-1])
    except (TypeError, ValueError):
        return None


def is_in_target_vc(member: discord.Member, vc_id: int) -> bool:
    return bool(
        member.voice
        and member.voice.channel
        and member.voice.channel.id == vc_id
    )


async def build_dashboard_url(guild_id: int) -> str:
    await ensure_guild_ready(guild_id)
    return f"{PUBLIC_BASE_URL}/dashboard/{guild_id}"


def discord_oauth_configured() -> bool:
    return bool(DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI)


def build_bot_invite_url() -> str:
    if not DISCORD_CLIENT_ID:
        return ""
    return (
        "https://discord.com/api/oauth2/authorize"
        f"?client_id={DISCORD_CLIENT_ID}"
        "&scope=bot%20applications.commands"
        f"&permissions={DISCORD_BOT_PERMISSIONS}"
    )


def build_login_url(state: str) -> str:
    query = urlencode(
        {
            "client_id": DISCORD_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": DISCORD_REDIRECT_URI,
            "scope": "identify guilds",
            "state": state,
        }
    )
    return f"https://discord.com/api/oauth2/authorize?{query}"


def has_manage_guild_access(guild_payload: dict) -> bool:
    permissions = int(guild_payload.get("permissions", "0"))
    manage_guild = 1 << 5
    administrator = 1 << 3
    return bool(guild_payload.get("owner")) or bool(permissions & manage_guild) or bool(permissions & administrator)


async def exchange_code_for_token(code: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{DISCORD_API_BASE}/oauth2/token",
            data={
                "client_id": DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": DISCORD_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        return response.json()


async def fetch_discord_identity(access_token: str) -> tuple[dict, list[dict]]:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        user_response = await client.get(f"{DISCORD_API_BASE}/users/@me", headers=headers)
        user_response.raise_for_status()
        guilds_response = await client.get(f"{DISCORD_API_BASE}/users/@me/guilds", headers=headers)
        guilds_response.raise_for_status()
    return user_response.json(), guilds_response.json()


def avatar_url_for(user: dict) -> str:
    avatar_hash = user.get("avatar")
    if avatar_hash:
        return f"https://cdn.discordapp.com/avatars/{user['id']}/{avatar_hash}.png?size=128"
    default_index = int(user["discriminator"]) % 5 if user.get("discriminator", "0").isdigit() else 0
    return f"https://cdn.discordapp.com/embed/avatars/{default_index}.png"


async def get_session_user(request: Request) -> Optional[dict]:
    session_id = request.session.get("oauth_session_id")
    if not session_id:
        return None
    session_data = await database.get_oauth_session(session_id)
    if not session_data:
        request.session.clear()
        return None

    user = dict(session_data["user"])
    user["access_token"] = session_data["access_token"]
    user["session_id"] = session_id
    user["guilds"] = session_data["guilds"]
    return user


async def require_session_user(request: Request) -> dict:
    user = await get_session_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Login required.")
    return user


async def get_manageable_guilds_for_user(request: Request) -> list[dict]:
    session_user = await require_session_user(request)
    raw_guilds = session_user.get("guilds", [])
    manageable_guilds = []

    for guild_payload in raw_guilds:
        if not has_manage_guild_access(guild_payload):
            continue
        guild_id = int(guild_payload["id"])
        bot_guild = bot.get_guild(guild_id)
        manageable_guilds.append(
            {
                "id": guild_id,
                "name": guild_payload["name"],
                "icon": (
                    f"https://cdn.discordapp.com/icons/{guild_payload['id']}/{guild_payload['icon']}.png?size=128"
                    if guild_payload.get("icon")
                    else None
                ),
                "owner": guild_payload.get("owner", False),
                "bot_in_guild": bot_guild is not None,
                "member_count": bot_guild.member_count if bot_guild else None,
                "dashboard_url": f"/dashboard/{guild_id}" if bot_guild else None,
                "invite_url": build_bot_invite_url(),
            }
        )

    manageable_guilds.sort(key=lambda item: (not item["bot_in_guild"], item["name"].lower()))
    session_user["avatar_url"] = avatar_url_for(session_user)
    return manageable_guilds


class BattleModal(discord.ui.Modal, title="Dispatch Battle Alert"):
    vc_link = discord.ui.TextInput(
        label="Voice Channel Link",
        placeholder="https://discord.com/channels/<server>/<channel>",
        required=True,
        max_length=200,
    )
    custom_message = discord.ui.TextInput(
        label="Dispatch Message",
        placeholder="Form line, rankers. The battle begins in 5 minutes.",
        required=False,
        style=discord.TextStyle.paragraph,
        max_length=500,
    )

    def __init__(self, regiment: RegimentConfig):
        super().__init__(timeout=300)
        self.regiment = regiment

    async def on_submit(self, interaction: discord.Interaction) -> None:
        if not interaction.guild or not isinstance(interaction.user, discord.Member):
            await interaction.response.send_message("This command only works inside a server.", ephemeral=True)
            return

        if not await member_can_manage_guild(interaction.user):
            await interaction.response.send_message(
                "You do not have permission to dispatch battle pings here.",
                ephemeral=True,
            )
            return

        guild_config = await ensure_guild_ready(interaction.guild.id)
        now = utc_now()
        last_used = guild_cooldowns.get(interaction.guild.id)
        if last_used and now - last_used < timedelta(minutes=guild_config.cooldown_minutes):
            retry_after = guild_config.cooldown_minutes - int((now - last_used).total_seconds() // 60)
            await interaction.response.send_message(
                f"This server is on cooldown for battle alerts. Try again in about {max(retry_after, 1)} minute(s).",
                ephemeral=True,
            )
            return

        vc_id = extract_vc_id(str(self.vc_link.value))
        if not vc_id:
            await interaction.response.send_message("That voice channel link does not look valid.", ephemeral=True)
            return

        role = interaction.guild.get_role(self.regiment.role_id)
        if role is None:
            await interaction.response.send_message(
                f"The configured role for {self.regiment.regiment_name} no longer exists. Update it in the dashboard.",
                ephemeral=True,
            )
            return

        guild_cooldowns[interaction.guild.id] = now
        dispatch_message = (
            self.custom_message.value.strip() if self.custom_message.value else "Battle alert. Join the line now."
        )

        await interaction.response.send_message(
            "\n".join(
                [
                    f"**Dispatching Orders**",
                    f"Regiment: **{self.regiment.regiment_name}**",
                    f"Role: {role.mention}",
                    f"Message: {dispatch_message}",
                    f"Voice Channel: {self.vc_link.value}",
                    "",
                    "Messengers are riding out now...",
                ]
            ),
            ephemeral=True,
        )

        sent = 0
        skipped = 0
        failed = 0

        for member in role.members:
            if member.bot:
                continue
            if is_in_target_vc(member, vc_id):
                skipped += 1
                continue

            try:
                await member.send(
                    "\n".join(
                        [
                            f"**{self.regiment.regiment_name} Battle Dispatch**",
                            dispatch_message,
                            f"Join VC: {self.vc_link.value}",
                            f"Sent from **{interaction.guild.name}**",
                        ]
                    )
                )
                sent += 1
                await asyncio.sleep(DM_SEND_DELAY_SECONDS)
            except discord.Forbidden:
                failed += 1
            except discord.HTTPException:
                failed += 1

        await interaction.followup.send(
            "\n".join(
                [
                    "**Dispatch Complete**",
                    f"Regiment: **{self.regiment.regiment_name}**",
                    f"Sent: **{sent}**",
                    f"Skipped already in VC: **{skipped}**",
                    f"Failed DM attempts: **{failed}**",
                ]
            ),
            ephemeral=True,
        )


class RegimentSelect(discord.ui.Select):
    def __init__(self, regiments: list[RegimentConfig]):
        options = [
            discord.SelectOption(label=entry.regiment_name[:100], value=str(entry.id))
            for entry in regiments[:25]
        ]
        super().__init__(
            placeholder="Choose the regiment to summon...",
            min_values=1,
            max_values=1,
            options=options,
        )
        self.regiments_by_id = {entry.id: entry for entry in regiments}

    async def callback(self, interaction: discord.Interaction) -> None:
        regiment = self.regiments_by_id.get(int(self.values[0]))
        if regiment is None:
            await interaction.response.send_message("That regiment is no longer configured.", ephemeral=True)
            return
        await interaction.response.send_modal(BattleModal(regiment))


class RegimentView(discord.ui.View):
    def __init__(self, regiments: list[RegimentConfig]):
        super().__init__(timeout=120)
        self.add_item(RegimentSelect(regiments))


@bot.tree.command(name="battleping", description="Send a regiment-specific battle DM dispatch.")
async def battleping(interaction: discord.Interaction) -> None:
    if not interaction.guild:
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    regiments = await database.get_regiments(interaction.guild.id)
    if not regiments:
        dashboard_url = await build_dashboard_url(interaction.guild.id)
        await interaction.response.send_message(
            f"No regiments are configured for this server yet. Set them up in the dashboard: {dashboard_url}",
            ephemeral=True,
        )
        return

    await interaction.response.send_message(
        "Select the regiment you want to notify.",
        view=RegimentView(regiments),
        ephemeral=True,
    )


config_group = app_commands.Group(name="config", description="Configure BattleBot for this server.")


@config_group.command(name="dashboard", description="Get the secure dashboard link for this server.")
async def config_dashboard(interaction: discord.Interaction) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not await member_can_manage_guild(interaction.user):
        await interaction.response.send_message("You do not have permission to manage this server's setup.", ephemeral=True)
        return

    await interaction.response.send_message(
        f"Open your command dashboard here: {await build_dashboard_url(interaction.guild.id)}",
        ephemeral=True,
    )


@config_group.command(name="rotate-dashboard", description="Rotate the secure dashboard token for this server.")
async def config_rotate_dashboard(interaction: discord.Interaction) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not await member_can_manage_guild(interaction.user):
        await interaction.response.send_message("You do not have permission to rotate the dashboard token.", ephemeral=True)
        return

    await interaction.response.send_message(
        "Dashboard access now uses Discord login and guild permission checks. No secret link rotation is needed anymore.",
        ephemeral=True,
    )


@config_group.command(name="cooldown", description="Set the per-server cooldown for battle dispatches.")
@app_commands.describe(minutes="How many minutes to wait between battle pings in this server.")
async def config_cooldown(interaction: discord.Interaction, minutes: app_commands.Range[int, 0, 120]) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not await member_can_manage_guild(interaction.user):
        await interaction.response.send_message("You do not have permission to change cooldowns.", ephemeral=True)
        return

    await database.update_cooldown(interaction.guild.id, minutes)
    await interaction.response.send_message(
        f"Battle dispatch cooldown set to **{minutes}** minute(s).",
        ephemeral=True,
    )


@config_group.command(name="admin-role", description="Allow a role to configure and dispatch battle alerts.")
@app_commands.describe(role="The Discord role that should have BattleBot admin powers.")
async def config_admin_role(interaction: discord.Interaction, role: discord.Role) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not (interaction.user.guild_permissions.administrator or interaction.user.guild_permissions.manage_guild):
        await interaction.response.send_message(
            "Only members with Administrator or Manage Server can assign BattleBot admin roles.",
            ephemeral=True,
        )
        return

    await database.add_admin_role(interaction.guild.id, role.id)
    await interaction.response.send_message(
        f"{role.mention} can now configure the bot and dispatch battle alerts.",
        ephemeral=True,
    )


@config_group.command(name="remove-admin-role", description="Remove BattleBot admin powers from a role.")
@app_commands.describe(role="The Discord role to remove from BattleBot admin access.")
async def config_remove_admin_role(interaction: discord.Interaction, role: discord.Role) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not (interaction.user.guild_permissions.administrator or interaction.user.guild_permissions.manage_guild):
        await interaction.response.send_message(
            "Only members with Administrator or Manage Server can change BattleBot admin roles.",
            ephemeral=True,
        )
        return

    await database.remove_admin_role(interaction.guild.id, role.id)
    await interaction.response.send_message(
        f"{role.mention} no longer has BattleBot admin powers.",
        ephemeral=True,
    )


@config_group.command(name="add-regiment", description="Map a regiment name to a Discord role.")
@app_commands.describe(regiment_name="The custom regiment name shown in the battle selector.", role="The Discord role to DM.")
async def config_add_regiment(
    interaction: discord.Interaction,
    regiment_name: app_commands.Range[str, 1, 60],
    role: discord.Role,
) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not await member_can_manage_guild(interaction.user):
        await interaction.response.send_message("You do not have permission to add regiments.", ephemeral=True)
        return

    try:
        await database.upsert_regiment(interaction.guild.id, regiment_name, role.id, role.name)
    except ValueError as exc:
        await interaction.response.send_message(str(exc), ephemeral=True)
        return
    except aiosqlite.IntegrityError:
        await interaction.response.send_message(
            "That role is already assigned to another regiment. Remove the old mapping first.",
            ephemeral=True,
        )
        return

    await interaction.response.send_message(
        f"Regiment **{regiment_name}** now dispatches to {role.mention}.",
        ephemeral=True,
    )


@config_group.command(name="remove-regiment", description="Remove a regiment mapping.")
@app_commands.describe(regiment_name="The regiment name to remove.")
async def config_remove_regiment(
    interaction: discord.Interaction,
    regiment_name: app_commands.Range[str, 1, 60],
) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not await member_can_manage_guild(interaction.user):
        await interaction.response.send_message("You do not have permission to remove regiments.", ephemeral=True)
        return

    deleted = await database.delete_regiment(interaction.guild.id, regiment_name)
    if not deleted:
        await interaction.response.send_message(
            f"No regiment named **{regiment_name}** is currently configured.",
            ephemeral=True,
        )
        return

    await interaction.response.send_message(
        f"Removed regiment **{regiment_name}** from this server.",
        ephemeral=True,
    )


@config_group.command(name="list", description="Show the current guild configuration.")
async def config_list(interaction: discord.Interaction) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Use this command inside a server.", ephemeral=True)
        return

    if not await member_can_manage_guild(interaction.user):
        await interaction.response.send_message("You do not have permission to view BattleBot config.", ephemeral=True)
        return

    guild_config = await ensure_guild_ready(interaction.guild.id)
    regiments = await database.get_regiments(interaction.guild.id)
    admin_role_ids = await database.get_admin_role_ids(interaction.guild.id)

    regiment_lines = [
        f"- **{entry.regiment_name}** -> <@&{entry.role_id}>"
        for entry in regiments
    ] or ["- None configured yet"]
    admin_lines = [f"- <@&{role_id}>" for role_id in admin_role_ids] or ["- Only Administrator / Manage Server"]

    await interaction.response.send_message(
        "\n".join(
            [
                f"**BattleBot Configuration for {interaction.guild.name}**",
                f"Cooldown: **{guild_config.cooldown_minutes}** minute(s)",
                f"Dashboard: {await build_dashboard_url(interaction.guild.id)}",
                "",
                "**Admin Roles**",
                *admin_lines,
                "",
                "**Regiments**",
                *regiment_lines,
            ]
        ),
        ephemeral=True,
    )


bot.tree.add_command(config_group)


@bot.event
async def on_ready() -> None:
    await bot.tree.sync()
    for guild in bot.guilds:
        await database.ensure_guild(guild.id)
    print(f"Logged in as {bot.user} in {len(bot.guilds)} guild(s)")


@bot.event
async def on_guild_join(guild: discord.Guild) -> None:
    await database.ensure_guild(guild.id)


def serialize_role(role: discord.Role) -> dict[str, str | int]:
    return {"id": role.id, "name": role.name}


async def get_dashboard_context(request: Request, guild_id: int) -> dict:
    guild_config = await database.get_guild_config(guild_id)
    if not guild_config:
        raise HTTPException(status_code=404, detail="Guild is not configured yet.")
    guild = bot.get_guild(guild_id)
    if guild is None:
        raise HTTPException(status_code=404, detail="The bot is not currently in that server.")

    user = await require_session_user(request)
    manageable_ids = {entry["id"] for entry in await get_manageable_guilds_for_user(request)}
    if guild_id not in manageable_ids:
        raise HTTPException(status_code=403, detail="You do not have permission to manage this server.")

    regiments = await database.get_regiments(guild_id)
    admin_role_ids = set(await database.get_admin_role_ids(guild_id))
    roles = [
        serialize_role(role)
        for role in sorted(guild.roles, key=lambda current: current.position, reverse=True)
        if not role.is_default()
    ]

    return {
        "request": request,
        "guild": guild,
        "guild_config": guild_config,
        "regiments": regiments,
        "roles": roles,
        "admin_role_ids": admin_role_ids,
        "dashboard_url": await build_dashboard_url(guild_id),
        "max_regiments": MAX_REGIMENTS_PER_GUILD,
        "user": user,
        "bot_invite_url": build_bot_invite_url(),
    }


def setup_progress(context: dict) -> dict:
    has_admin_roles = bool(context["admin_role_ids"])
    has_regiments = bool(context["regiments"])
    completed = int(has_admin_roles) + int(has_regiments) + 1
    return {
        "completed": completed,
        "total": 3,
        "has_admin_roles": has_admin_roles,
        "has_regiments": has_regiments,
    }


@asynccontextmanager
async def lifespan(_: FastAPI):
    await database.initialize()
    bot_task = None
    if DISCORD_TOKEN:
        bot_task = asyncio.create_task(bot.start(DISCORD_TOKEN))
    else:
        print("DISCORD_TOKEN is not set. Dashboard will run, but the Discord bot will stay offline.")

    try:
        yield
    finally:
        if bot_task:
            await bot.close()
            try:
                await bot_task
            except Exception:
                pass


app = FastAPI(title="BattleBot Command Dashboard", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",
    https_only=PUBLIC_BASE_URL.startswith("https://"),
    max_age=60 * 60 * 24 * 7,
)


@app.get("/", response_class=HTMLResponse)
async def landing(request: Request) -> HTMLResponse:
    session_user = await get_session_user(request)
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "public_base_url": PUBLIC_BASE_URL,
            "bot_ready": bot.is_ready(),
            "guild_count": len(bot.guilds),
            "oauth_ready": discord_oauth_configured(),
            "login_url": "/auth/login",
            "dashboard_url": "/dashboard",
            "invite_url": build_bot_invite_url(),
            "user": session_user,
            "setup_steps": [
                "Invite BattleBot to your Discord server",
                "Log in and select a server you manage",
                "Assign command staff roles and regiment mappings",
                "Run /battleping to dispatch the VC link",
            ],
        },
    )


@app.get("/healthz")
async def healthcheck() -> dict:
    return {
        "ok": True,
        "bot_ready": bot.is_ready(),
        "guild_count": len(bot.guilds),
        "database_path": str(DATABASE_PATH),
    }


@app.get("/auth/login")
async def auth_login(request: Request) -> RedirectResponse:
    if not discord_oauth_configured():
        raise HTTPException(status_code=500, detail="Discord OAuth is not configured.")

    state = secrets.token_urlsafe(24)
    request.session["oauth_state"] = state
    return RedirectResponse(build_login_url(state), status_code=302)


@app.get("/auth/callback")
async def auth_callback(request: Request, code: str, state: str) -> RedirectResponse:
    expected_state = request.session.get("oauth_state")
    if not expected_state or state != expected_state:
        raise HTTPException(status_code=400, detail="OAuth state mismatch.")

    token_payload = await exchange_code_for_token(code)
    user_payload, guilds_payload = await fetch_discord_identity(token_payload["access_token"])
    minimal_user = {
        "id": user_payload["id"],
        "username": user_payload["username"],
        "global_name": user_payload.get("global_name"),
        "avatar": user_payload.get("avatar"),
        "discriminator": user_payload.get("discriminator", "0"),
    }
    request.session["oauth_session_id"] = await database.create_oauth_session(
        minimal_user,
        guilds_payload,
        token_payload["access_token"],
    )
    request.session.pop("oauth_state", None)
    return RedirectResponse("/dashboard", status_code=302)


@app.get("/auth/logout")
async def auth_logout(request: Request) -> RedirectResponse:
    session_id = request.session.get("oauth_session_id")
    if session_id:
        await database.delete_oauth_session(session_id)
    request.session.clear()
    return RedirectResponse("/", status_code=302)


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_home(request: Request) -> HTMLResponse:
    if await get_session_user(request) is None:
        return RedirectResponse("/auth/login", status_code=302)
    user = await require_session_user(request)
    user["avatar_url"] = avatar_url_for(user)
    guilds = await get_manageable_guilds_for_user(request)
    return templates.TemplateResponse(
        "dashboard_home.html",
        {
            "request": request,
            "user": user,
            "guilds": guilds,
            "invite_url": build_bot_invite_url(),
        },
    )


@app.get("/dashboard/{guild_id}", response_class=HTMLResponse)
async def guild_dashboard(request: Request, guild_id: int) -> HTMLResponse:
    if await get_session_user(request) is None:
        return RedirectResponse("/auth/login", status_code=302)
    context = await get_dashboard_context(request, guild_id)
    context["setup_progress"] = setup_progress(context)
    return templates.TemplateResponse("guild.html", context)


@app.get("/dashboard/{guild_id}/setup", response_class=HTMLResponse)
async def guild_setup_wizard(request: Request, guild_id: int) -> HTMLResponse:
    if await get_session_user(request) is None:
        return RedirectResponse("/auth/login", status_code=302)
    context = await get_dashboard_context(request, guild_id)
    context["setup_progress"] = setup_progress(context)
    return templates.TemplateResponse("setup_wizard.html", context)


@app.post("/guild/{guild_id}/regiments")
async def add_regiment_from_dashboard(
    request: Request,
    guild_id: int,
    regiment_name: str = Form(...),
    role_id: int = Form(...),
) -> RedirectResponse:
    context = await get_dashboard_context(request, guild_id)
    guild = context["guild"]
    role = guild.get_role(role_id)
    if role is None:
        raise HTTPException(status_code=400, detail="Role not found in guild.")

    try:
        await database.upsert_regiment(guild_id, regiment_name, role.id, role.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except aiosqlite.IntegrityError as exc:
        raise HTTPException(status_code=400, detail="That role is already assigned to another regiment.") from exc

    return RedirectResponse(url=f"/dashboard/{guild_id}", status_code=303)


@app.post("/guild/{guild_id}/regiments/{regiment_id}/delete")
async def delete_regiment_from_dashboard(
    request: Request,
    guild_id: int,
    regiment_id: int,
) -> RedirectResponse:
    await get_dashboard_context(request, guild_id)
    await database.delete_regiment_by_id(guild_id, regiment_id)
    return RedirectResponse(url=f"/dashboard/{guild_id}", status_code=303)


@app.post("/guild/{guild_id}/settings")
async def update_settings_from_dashboard(
    request: Request,
    guild_id: int,
    cooldown_minutes: int = Form(...),
) -> RedirectResponse:
    await get_dashboard_context(request, guild_id)
    await database.update_cooldown(guild_id, max(0, min(cooldown_minutes, 120)))
    return RedirectResponse(url=f"/dashboard/{guild_id}", status_code=303)


@app.post("/guild/{guild_id}/admin-roles")
async def update_admin_roles_from_dashboard(
    request: Request,
    guild_id: int,
    admin_role_ids: list[int] = Form(default=[]),
) -> RedirectResponse:
    context = await get_dashboard_context(request, guild_id)
    guild = context["guild"]
    valid_role_ids = {role.id for role in guild.roles if not role.is_default()}

    existing_role_ids = set(await database.get_admin_role_ids(guild_id))
    selected_role_ids = {role_id for role_id in admin_role_ids if role_id in valid_role_ids}

    for role_id in existing_role_ids - selected_role_ids:
        await database.remove_admin_role(guild_id, role_id)
    for role_id in selected_role_ids - existing_role_ids:
        await database.add_admin_role(guild_id, role_id)

    return RedirectResponse(url=f"/dashboard/{guild_id}", status_code=303)
