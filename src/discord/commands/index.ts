import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandBuilder
} from 'discord.js';
import type { SlashCommandSubcommandsOnlyBuilder } from '@discordjs/builders';
import { AppDatabase } from '../../db';
import { DeepSeekClient } from '../deepseekClient';

export type CommandContext = {
  db: AppDatabase;
  deepSeek: DeepSeekClient;
};

export type SlashCommand = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, context: CommandContext) => Promise<void>;
};

const MAX_TEXT_LENGTH = 3_000;
const MAX_TOPIC_LENGTH = 150;

function requireGuild(interaction: ChatInputCommandInteraction): string {
  if (!interaction.guildId) {
    throw new Error('This command can only be used in a server.');
  }
  return interaction.guildId;
}

function validateLength(label: string, value: string, maxLength: number): void {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
}

const generateQuestionsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('study-generate-questions')
    .setDescription('Generate study questions for a topic.')
    .addStringOption((option) =>
      option.setName('topic').setDescription('The topic to study').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('difficulty')
        .setDescription('Difficulty level')
        .setRequired(true)
        .addChoices(
          { name: 'easy', value: 'easy' },
          { name: 'medium', value: 'medium' },
          { name: 'hard', value: 'hard' }
        )
    )
    .addIntegerOption((option) =>
      option.setName('count').setDescription('Number of questions').setRequired(true).setMinValue(1).setMaxValue(10)
    )
    .addBooleanOption((option) =>
      option.setName('fast_mode').setDescription('Use faster, lighter responses')
    ),
  async execute(interaction, context) {
    const guildId = requireGuild(interaction);
    const topic = interaction.options.getString('topic', true);
    const difficulty = interaction.options.getString('difficulty', true);
    const count = interaction.options.getInteger('count', true);
    const fastMode = interaction.options.getBoolean('fast_mode');
    validateLength('Topic', topic, MAX_TOPIC_LENGTH);

    await interaction.deferReply();
    const text = await context.deepSeek.generateQuestions(topic, difficulty, count, { guildId, fastModeOverride: fastMode }, interaction.user.id);
    await interaction.editReply(text.slice(0, 1_900));
  }
};

const describeTopicCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('study-describe-topic')
    .setDescription('Explain a topic for a chosen level.')
    .addStringOption((option) =>
      option.setName('topic').setDescription('The topic to explain').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('level')
        .setDescription('Learner level')
        .setRequired(true)
        .addChoices(
          { name: 'beginner', value: 'beginner' },
          { name: 'intermediate', value: 'intermediate' },
          { name: 'advanced', value: 'advanced' }
        )
    )
    .addBooleanOption((option) =>
      option.setName('fast_mode').setDescription('Use faster, lighter responses')
    ),
  async execute(interaction, context) {
    const guildId = requireGuild(interaction);
    const topic = interaction.options.getString('topic', true);
    const level = interaction.options.getString('level', true);
    const fastMode = interaction.options.getBoolean('fast_mode');
    validateLength('Topic', topic, MAX_TOPIC_LENGTH);

    await interaction.deferReply();
    const text = await context.deepSeek.describeTopic(topic, level, { guildId, fastModeOverride: fastMode }, interaction.user.id);
    await interaction.editReply(text.slice(0, 1_900));
  }
};

const gradeTextCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('study-grade-text')
    .setDescription('Grade a student answer against a prompt.')
    .addStringOption((option) =>
      option.setName('prompt').setDescription('The assignment prompt').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('student_text').setDescription('The student answer').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('criteria').setDescription('Optional rubric notes')
    )
    .addBooleanOption((option) =>
      option.setName('fast_mode').setDescription('Use faster, lighter responses')
    ),
  async execute(interaction, context) {
    const guildId = requireGuild(interaction);
    const prompt = interaction.options.getString('prompt', true);
    const studentText = interaction.options.getString('student_text', true);
    const criteria = interaction.options.getString('criteria');
    const fastMode = interaction.options.getBoolean('fast_mode');
    validateLength('Prompt', prompt, MAX_TEXT_LENGTH);
    validateLength('Student text', studentText, MAX_TEXT_LENGTH);
    if (criteria) {
      validateLength('Criteria', criteria, 1_500);
    }

    await interaction.deferReply();
    const settings = context.db.ensureGuildSettings(guildId, interaction.guild?.name ?? 'Unknown Server');
    const rubric = criteria || settings.gradingRubricJson;
    const result = await context.deepSeek.gradeText(prompt, studentText, rubric, { guildId, fastModeOverride: fastMode }, interaction.user.id);
    const feedback = result.feedback.map((line) => `- ${line}`).join('\n');
    await interaction.editReply(`Grade: ${result.grade}/100\nFeedback:\n${feedback}`);
  }
};

const configSubcommands: Array<
  (builder: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder
> = [
  (builder: SlashCommandSubcommandBuilder) => builder.setName('view').setDescription('View current guild settings.'),
  (builder: SlashCommandSubcommandBuilder) =>
    builder
      .setName('set-model')
      .setDescription('Set the default DeepSeek model.')
      .addStringOption((option) =>
        option
          .setName('model')
          .setDescription('Default model')
          .setRequired(true)
          .addChoices(
            { name: 'deepseek-chat', value: 'deepseek-chat' },
            { name: 'deepseek-reasoner', value: 'deepseek-reasoner' }
          )
      ),
  (builder: SlashCommandSubcommandBuilder) =>
    builder
      .setName('set-fast-mode')
      .setDescription('Enable or disable fast mode by default.')
      .addBooleanOption((option) =>
        option.setName('enabled').setDescription('Whether fast mode is enabled').setRequired(true)
      ),
  (builder: SlashCommandSubcommandBuilder) =>
    builder
      .setName('set-max-tokens')
      .setDescription('Set the default max tokens.')
      .addIntegerOption((option) =>
        option.setName('value').setDescription('Token limit').setRequired(true).setMinValue(200).setMaxValue(4000)
      ),
  (builder: SlashCommandSubcommandBuilder) =>
    builder
      .setName('set-temperature')
      .setDescription('Set the default temperature.')
      .addNumberOption((option) =>
        option.setName('value').setDescription('Temperature').setRequired(true).setMinValue(0).setMaxValue(1.5)
      ),
  (builder: SlashCommandSubcommandBuilder) =>
    builder
      .setName('set-language-level')
      .setDescription('Set the default learner level.')
      .addStringOption((option) =>
        option
          .setName('value')
          .setDescription('Language level')
          .setRequired(true)
          .addChoices(
            { name: 'beginner', value: 'beginner' },
            { name: 'intermediate', value: 'intermediate' },
            { name: 'advanced', value: 'advanced' }
          )
      )
];

const configBuilder = new SlashCommandBuilder()
  .setName('study-config')
  .setDescription('View or update study bot configuration.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

for (const configureSubcommand of configSubcommands) {
  configBuilder.addSubcommand(configureSubcommand);
}

const configCommand: SlashCommand = {
  data: configBuilder,
  async execute(interaction, context) {
    const guildId = requireGuild(interaction);
    const memberPermissions = interaction.memberPermissions;
    if (!memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new Error('You need Manage Server permission to use this command.');
    }

    const subcommand = interaction.options.getSubcommand(true);
    const settings = context.db.ensureGuildSettings(guildId, interaction.guild?.name ?? 'Unknown Server');

    if (subcommand === 'view') {
      await interaction.reply(
        [
          `Model: ${settings.defaultModel}`,
          `Fast mode: ${settings.fastMode ? 'enabled' : 'disabled'}`,
          `Max tokens: ${settings.maxTokens}`,
          `Temperature: ${settings.temperature}`,
          `Language level: ${settings.languageLevel}`
        ].join('\n')
      );
      return;
    }

    if (subcommand === 'set-model') {
      const model = interaction.options.getString('model', true);
      context.db.updateGuildSettings(guildId, { defaultModel: model });
      await interaction.reply(`Default model set to ${model}.`);
      return;
    }

    if (subcommand === 'set-fast-mode') {
      const enabled = interaction.options.getBoolean('enabled', true);
      context.db.updateGuildSettings(guildId, { fastMode: enabled });
      await interaction.reply(`Fast mode ${enabled ? 'enabled' : 'disabled'}.`);
      return;
    }

    if (subcommand === 'set-max-tokens') {
      const value = interaction.options.getInteger('value', true);
      context.db.updateGuildSettings(guildId, { maxTokens: value });
      await interaction.reply(`Max tokens set to ${value}.`);
      return;
    }

    if (subcommand === 'set-temperature') {
      const value = interaction.options.getNumber('value', true);
      context.db.updateGuildSettings(guildId, { temperature: value });
      await interaction.reply(`Temperature set to ${value}.`);
      return;
    }

    const value = interaction.options.getString('value', true) as 'beginner' | 'intermediate' | 'advanced';
    context.db.updateGuildSettings(guildId, { languageLevel: value });
    await interaction.reply(`Default language level set to ${value}.`);
  }
};

const pingCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName('study-ping').setDescription('Check bot and model health.'),
  async execute(interaction, context) {
    const guildId = requireGuild(interaction);
    const settings = context.db.ensureGuildSettings(guildId, interaction.guild?.name ?? 'Unknown Server');
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong. Latency: ${latency}ms. Default model: ${settings.defaultModel}.`);
  }
};

export const slashCommands: SlashCommand[] = [
  generateQuestionsCommand,
  describeTopicCommand,
  gradeTextCommand,
  configCommand,
  pingCommand
];
