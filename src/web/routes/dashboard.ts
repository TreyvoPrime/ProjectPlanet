import crypto from 'crypto';
import axios from 'axios';
import { Router } from 'express';
import { Client, PermissionFlagsBits } from 'discord.js';
import { config } from '../../config';
import { AppDatabase } from '../../db';
import { requireAuth, verifyCsrf, DiscordGuildSummary } from '../middleware/auth';

function canManageGuild(guild: DiscordGuildSummary): boolean {
  if (guild.owner) {
    return true;
  }
  const permissions = BigInt(guild.permissions ?? '0');
  return (permissions & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createDashboardRouter(db: AppDatabase, botClient: Client): Router {
  const router = Router();

  router.get('/', (request, response) => {
    response.render('home', {
      title: 'Study Assistant Bot'
    });
  });

  router.get('/dashboard', requireAuth, async (request, response) => {
    const oauthGuilds = request.session.discordGuilds ?? [];
    const guilds = oauthGuilds
      .filter((guild) => botClient.guilds.cache.has(guild.id))
      .map((guild) => {
        db.upsertGuild({ guildId: guild.id, name: guild.name });
        return {
          ...guild,
          canManage: canManageGuild(guild)
        };
      });

    response.render('dashboard', {
      title: 'My Servers',
      guilds
    });
  });

  router.get('/dashboard/guild/:guildId', requireAuth, async (request, response) => {
    const guildId = request.params.guildId;
    const oauthGuilds = request.session.discordGuilds ?? [];
    const guild = oauthGuilds.find((entry) => entry.id === guildId);
    if (!guild || !botClient.guilds.cache.has(guildId)) {
      request.session.flash = { error: 'That server is not available in your dashboard.' };
      response.redirect('/dashboard');
      return;
    }

    if (!canManageGuild(guild)) {
      request.session.flash = { error: 'You need Manage Server permission for that server.' };
      response.redirect('/dashboard');
      return;
    }

    const settings = db.ensureGuildSettings(guildId, guild.name);
    const usage = db.getUsageStatsForGuild(guildId);
    response.render('guild-settings', {
      title: guild.name,
      guild,
      settings,
      usage,
      models: ['deepseek-chat', 'deepseek-reasoner']
    });
  });

  router.post('/dashboard/guild/:guildId', requireAuth, verifyCsrf, async (request, response) => {
    const guildId = request.params.guildId;
    const oauthGuilds = request.session.discordGuilds ?? [];
    const guild = oauthGuilds.find((entry) => entry.id === guildId);
    if (!guild || !botClient.guilds.cache.has(guildId) || !canManageGuild(guild)) {
      request.session.flash = { error: 'You do not have permission to update that server.' };
      response.redirect('/dashboard');
      return;
    }

    const defaultModel = String(request.body.defaultModel ?? 'deepseek-chat');
    const fastMode = request.body.fastMode === 'on';
    const temperature = clamp(Number(request.body.temperature ?? 0.7), 0, 1.5);
    const maxTokens = clamp(Number(request.body.maxTokens ?? 700), 200, 4000);
    const languageLevel = String(request.body.languageLevel ?? 'intermediate') as
      | 'beginner'
      | 'intermediate'
      | 'advanced';
    const gradingRubricJson = String(request.body.gradingRubricJson ?? '').trim();

    if (!['deepseek-chat', 'deepseek-reasoner'].includes(defaultModel)) {
      request.session.flash = { error: 'Unsupported model selected.' };
      response.redirect(`/dashboard/guild/${guildId}`);
      return;
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(languageLevel)) {
      request.session.flash = { error: 'Unsupported language level selected.' };
      response.redirect(`/dashboard/guild/${guildId}`);
      return;
    }

    if (gradingRubricJson.length > 8_000) {
      request.session.flash = { error: 'Rubric content is too long.' };
      response.redirect(`/dashboard/guild/${guildId}`);
      return;
    }

    db.updateGuildSettings(guildId, {
      defaultModel,
      fastMode,
      temperature,
      maxTokens,
      languageLevel,
      gradingRubricJson: gradingRubricJson || db.ensureGuildSettings(guildId, guild.name).gradingRubricJson
    });

    request.session.flash = { success: 'Guild settings updated.' };
    response.redirect(`/dashboard/guild/${guildId}`);
  });

  router.get('/logout', (request, response) => {
    request.session.destroy(() => {
      response.redirect('/');
    });
  });

  router.get('/auth/login', (request, response) => {
    const state = crypto.randomUUID();
    request.session.oauthState = state;
    const params = new URLSearchParams({
      client_id: config.discordClientId,
      redirect_uri: config.discordRedirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      prompt: 'consent',
      state
    });
    response.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  router.get('/auth/callback', async (request, response) => {
    const code = typeof request.query.code === 'string' ? request.query.code : '';
    const state = typeof request.query.state === 'string' ? request.query.state : '';
    if (!code || !state || state !== request.session.oauthState) {
      request.session.flash = { error: 'Discord login could not be verified. Please try again.' };
      response.redirect('/');
      return;
    }

    try {
      const tokenResponse = await fetchDiscordToken(code);
      const [user, guilds] = await Promise.all([
        fetchDiscordUser(tokenResponse.access_token),
        fetchDiscordGuilds(tokenResponse.access_token)
      ]);

      request.session.user = {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      };
      request.session.discordGuilds = guilds;
      db.upsertUser({ discordId: user.id, username: user.username });
      request.session.flash = { success: 'Logged in with Discord.' };
      response.redirect('/dashboard');
    } catch (error) {
      console.error('Discord OAuth error:', error);
      request.session.flash = { error: 'Discord login failed. Please try again.' };
      response.redirect('/');
    }
  });

  return router;
}
async function fetchDiscordToken(code: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    client_id: config.discordClientId,
    client_secret: config.discordClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.discordRedirectUri
  });
  const response = await axios.post('https://discord.com/api/v10/oauth2/token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return response.data;
}

async function fetchDiscordUser(accessToken: string): Promise<{ id: string; username: string; avatar?: string | null }> {
  const response = await axios.get('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.data;
}

async function fetchDiscordGuilds(accessToken: string): Promise<DiscordGuildSummary[]> {
  const response = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.data;
}
