import discord
from discord.ext import commands
from discord import app_commands
import asyncio
from datetime import datetime, timedelta
import os
print("STARTING BOT FILE")
TOKEN = os.getenv("TOKEN")

# =========================
# INTENTS
# =========================
intents = discord.Intents.default()
intents.members = True
intents.voice_states = True

bot = commands.Bot(command_prefix="!", intents=intents)

# =========================
# CONFIG
# =========================
ALLOWED_ROLE_NAMES = ["Owner"]
COOLDOWN_MINUTES = 1
last_used_time = None


# =========================
# PERMISSION CHECK
# =========================
def has_permission(member: discord.Member):
    return any(role.name in ALLOWED_ROLE_NAMES for role in member.roles)


# =========================
# VC PARSER
# =========================
def extract_vc_id(vc_link: str):
    try:
        return int(vc_link.strip().split("/")[-1])
    except:
        return None


def is_in_vc(member: discord.Member, vc_id: int):
    return (
        member.voice is not None
        and member.voice.channel is not None
        and member.voice.channel.id == vc_id
    )


# =========================
# REGIMENT DROPDOWN
# =========================
class RegimentSelect(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="Lutzowsches", value="lutzowsches"),
            discord.SelectOption(label="Alpha", value="alpha"),
            discord.SelectOption(label="Bravo", value="bravo"),
        ]

        super().__init__(
            placeholder="Select regiment...",
            min_values=1,
            max_values=1,
            options=options
        )

    async def callback(self, interaction: discord.Interaction):
        view: RegimentView = self.view
        view.regiment = self.values[0]

        await interaction.response.send_modal(BattleModal(view.regiment))


class RegimentView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=60)
        self.regiment = None
        self.add_item(RegimentSelect())


# =========================
# MODAL (VC + MESSAGE)
# =========================
class BattleModal(discord.ui.Modal):
    def __init__(self, regiment: str):
        super().__init__(title="Battle Ping Setup")
        self.regiment = regiment

        self.vc_link = discord.ui.TextInput(
            label="VC Link",
            placeholder="https://discord.com/channels/@me/123...",
            required=True
        )

        self.custom_message = discord.ui.TextInput(
            label="Custom Message",
            placeholder="Optional message (e.g. 'Rally now', 'Attack base')",
            required=False,
            style=discord.TextStyle.paragraph
        )

        self.add_item(self.vc_link)
        self.add_item(self.custom_message)

    async def on_submit(self, interaction: discord.Interaction):
        global last_used_time

        user = interaction.user

        # =========================
        # PERMISSION CHECK
        # =========================
        if not has_permission(user):
            await interaction.response.send_message("❌ No permission.", ephemeral=True)
            return

        # =========================
        # COOLDOWN
        # =========================
        now = datetime.utcnow()
        if last_used_time and (now - last_used_time) < timedelta(minutes=COOLDOWN_MINUTES):
            await interaction.response.send_message("⏳ Cooldown active.", ephemeral=True)
            return

        last_used_time = now

        # =========================
        # PARSE VC
        # =========================
        vc_id = extract_vc_id(self.vc_link.value)
        if not vc_id:
            await interaction.response.send_message("❌ Invalid VC link.", ephemeral=True)
            return

        guild = interaction.guild
        role = discord.utils.get(guild.roles, name=self.regiment)

        message = (
            self.custom_message.value.strip()
            if self.custom_message.value
            else "Battle alert!"
        )

        # =========================
        # INITIAL RESPONSE (ACK)
        # =========================
        await interaction.response.send_message(
            f"⚔️ **Battle Ping Started**\n"
            f"📌 Regiment: {self.regiment}\n"
            f"📢 {message}\n"
            f"🔊 VC: {self.vc_link.value}\n\n"
            f"⏳ Sending messages..."
        )

        # =========================
        # DM LOGIC
        # =========================
        sent = 0
        skipped = 0
        failed = 0

        if role:
            for member in role.members:

                if member.bot:
                    continue

                if is_in_vc(member, vc_id):
                    skipped += 1
                    continue

                try:
                    await member.send(
                        f"⚔️ **{self.regiment} Battle Alert**\n"
                        f"📢 {message}\n"
                        f"🔊 Join VC: {self.vc_link.value}"
                    )
                    sent += 1
                    await asyncio.sleep(1)

                except:
                    failed += 1

        # =========================
        # FINAL SUMMARY (IMPORTANT FIX)
        # =========================
        await interaction.followup.send(
            f"✅ **Battle Ping Complete**\n"
            f"⚔️ Regiment: {self.regiment}\n"
            f"📨 Sent: {sent}\n"
            f"⏭️ Skipped (already in VC): {skipped}\n"
            f"❌ Failed: {failed}"
        )


# =========================
# MAIN COMMAND
# =========================
@bot.tree.command(name="battleping", description="Send regiment battle ping")
async def battleping(interaction: discord.Interaction):
    await interaction.response.send_message(
        "Select your regiment:",
        view=RegimentView(),
        ephemeral=True
    )


# =========================
# READY EVENT
# =========================
@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"✅ Logged in as {bot.user}")


bot.run(TOKEN)