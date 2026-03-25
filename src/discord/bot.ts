import {
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  REST,
  Routes
} from 'discord.js';
import { config } from '../config';
import { AppDatabase } from '../db';
import { DeepSeekClient } from './deepseekClient';
import { slashCommands } from './commands';

export type BotRuntime = {
  client: Client;
  start: () => Promise<void>;
};

export function createBot(db: AppDatabase, deepSeek: DeepSeekClient): BotRuntime {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  async function registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(config.discordBotToken);
    const commandPayload = slashCommands.map((command) => command.data.toJSON());

    if (config.discordDevGuildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discordClientId, config.discordDevGuildId),
        { body: commandPayload }
      );
      console.log(`Registered guild slash commands for development guild ${config.discordDevGuildId}.`);
      return;
    }

    await rest.put(Routes.applicationCommands(config.discordClientId), { body: commandPayload });
    console.log('Registered global slash commands.');
  }

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Discord bot logged in as ${readyClient.user.tag}.`);
    await registerCommands();
  });

  client.on(Events.GuildCreate, (guild) => {
    db.ensureGuildSettings(guild.id, guild.name);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = slashCommands.find((entry) => entry.data.name === interaction.commandName);
    if (!command) {
      return;
    }

    try {
      if (interaction.guildId) {
        db.ensureGuildSettings(interaction.guildId, interaction.guild?.name ?? 'Unknown Server');
      }
      await command.execute(interaction, { db, deepSeek });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while handling that command.';
      console.error('Discord command error:', {
        commandName: interaction.commandName,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        error
      });

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  });

  return {
    client,
    start: async () => {
      await client.login(config.discordBotToken);
    }
  };
}
