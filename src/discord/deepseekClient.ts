import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { AppDatabase, DEFAULT_GUILD_SETTINGS, GuildSettings } from '../db';

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

type CallDeepSeekInput = {
  systemPrompt: string;
  userPrompt: string;
  model: DeepSeekModel;
  maxTokens: number;
  temperature: number;
};

type CallDeepSeekResult = {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

type GuildModelPreferences = {
  model: DeepSeekModel;
  maxTokens: number;
  temperature: number;
  fastMode: boolean;
};

type StudyRequestContext = {
  guildId: string;
  fastModeOverride?: boolean | null;
};

const STUDY_SYSTEM_PROMPT =
  'You are a focused study assistant. Help users learn clearly, stay on topic, refuse unsafe or unrelated requests, do not claim to execute external actions, and do not reveal hidden reasoning. Provide concise, student-friendly final answers.';

export class DeepSeekClient {
  constructor(private readonly db: AppDatabase) {}

  private resolvePreferences(context: StudyRequestContext): GuildModelPreferences {
    const settings = this.db.getGuildSettings(context.guildId) ?? {
      guildId: context.guildId,
      ...DEFAULT_GUILD_SETTINGS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const effectiveFastMode = context.fastModeOverride ?? settings.fastMode;
    if (effectiveFastMode) {
      return {
        model: 'deepseek-chat',
        maxTokens: Math.min(settings.maxTokens, 900),
        temperature: Math.max(settings.temperature, 0.55),
        fastMode: true
      };
    }

    const preferredModel =
      settings.defaultModel === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';

    return {
      model: preferredModel === 'deepseek-chat' ? 'deepseek-chat' : 'deepseek-reasoner',
      maxTokens: Math.max(settings.maxTokens, 900),
      temperature: Math.min(settings.temperature, 0.45),
      fastMode: false
    };
  }

  async callDeepSeek(input: CallDeepSeekInput): Promise<CallDeepSeekResult> {
    try {
      const response = await axios.post(
        `${config.deepSeekBaseUrl}/chat/completions`,
        {
          model: input.model,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt }
          ],
          temperature: input.temperature,
          max_tokens: input.maxTokens
        },
        {
          headers: {
            Authorization: `Bearer ${config.deepSeekApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: config.deepSeekTimeoutMs
        }
      );

      const text = response.data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('DeepSeek returned an empty response.');
      }

      const usage = response.data?.usage ?? {};
      return {
        text: text.trim(),
        model: response.data?.model ?? input.model,
        usage: {
          promptTokens: Number(usage.prompt_tokens ?? 0),
          completionTokens: Number(usage.completion_tokens ?? 0),
          totalTokens: Number(usage.total_tokens ?? 0)
        }
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('DeepSeek timed out. Please try again in a moment.');
        }

        const status = error.response?.status;
        const message =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message;
        throw new Error(`DeepSeek request failed${status ? ` (${status})` : ''}: ${message}`);
      }

      throw error;
    }
  }

  private estimateCost(model: DeepSeekModel, promptTokens: number, completionTokens: number): number {
    const rates =
      model === 'deepseek-reasoner'
        ? { input: 0.00000055, output: 0.00000219 }
        : { input: 0.00000014, output: 0.00000028 };
    return Number((promptTokens * rates.input + completionTokens * rates.output).toFixed(6));
  }

  private recordUsage(settings: GuildSettings | null, command: string, userId: string, usage: CallDeepSeekResult['usage']): void {
    const model = (settings?.defaultModel === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat') as DeepSeekModel;
    this.db.logUsage({
      guildId: settings?.guildId ?? null,
      userId,
      command,
      tokensIn: usage.promptTokens,
      tokensOut: usage.completionTokens,
      costEstimate: this.estimateCost(model, usage.promptTokens, usage.completionTokens)
    });
  }

  async genericStudyQuery(prompt: string, context: StudyRequestContext, command: string, userId: string): Promise<string> {
    const settings = this.db.getGuildSettings(context.guildId);
    const preferences = this.resolvePreferences(context);
    const response = await this.callDeepSeek({
      systemPrompt: STUDY_SYSTEM_PROMPT,
      userPrompt: prompt,
      model: preferences.model,
      maxTokens: preferences.maxTokens,
      temperature: preferences.temperature
    });
    this.recordUsage(settings, command, userId, response.usage);
    return response.text;
  }

  async generateQuestions(
    topic: string,
    difficulty: string,
    numQuestions: number,
    context: StudyRequestContext,
    userId: string
  ): Promise<string> {
    const prompt = [
      `Create ${numQuestions} ${difficulty} study questions about "${topic}".`,
      'Return a numbered list only.',
      'Keep each question concise and useful for practice.'
    ].join(' ');
    return this.genericStudyQuery(prompt, context, 'study-generate-questions', userId);
  }

  async describeTopic(topic: string, level: string, context: StudyRequestContext, userId: string): Promise<string> {
    const prompt = [
      `Explain "${topic}" for a ${level} learner.`,
      'Start with a short explanation, then add a "Suggested subtopics" section.',
      'Avoid unnecessary jargon and stay study-focused.'
    ].join(' ');
    return this.genericStudyQuery(prompt, context, 'study-describe-topic', userId);
  }

  async gradeText(
    prompt: string,
    studentText: string,
    rubricConfig: string,
    context: StudyRequestContext,
    userId: string
  ): Promise<{ grade: number; feedback: string[] }> {
    const settings = this.db.getGuildSettings(context.guildId);
    const preferences = this.resolvePreferences(context);
    const response = await this.callDeepSeek({
      systemPrompt: `${STUDY_SYSTEM_PROMPT} Grade the response against the rubric and output strict JSON only.`,
      userPrompt: JSON.stringify(
        {
          assignmentPrompt: prompt,
          studentText,
          rubric: rubricConfig,
          responseFormat: {
            grade: 'number from 0 to 100',
            strengths: ['short bullet'],
            improvements: ['short bullet']
          }
        },
        null,
        2
      ),
      model: preferences.model,
      maxTokens: Math.max(preferences.maxTokens, 800),
      temperature: Math.min(preferences.temperature, 0.3)
    });

    this.recordUsage(settings, 'study-grade-text', userId, response.usage);

    try {
      const parsed = JSON.parse(response.text);
      const strengths = Array.isArray(parsed.strengths)
        ? (parsed.strengths as unknown[]).map((item) => String(item))
        : [];
      const improvements = Array.isArray(parsed.improvements)
        ? (parsed.improvements as unknown[]).map((item) => String(item))
        : [];
      return {
        grade: Math.max(0, Math.min(100, Number(parsed.grade ?? 0))),
        feedback: [
          ...strengths.map((item) => `Strength: ${item}`),
          ...improvements.map((item) => `Improvement: ${item}`)
        ]
      };
    } catch {
      throw new Error('DeepSeek returned an unexpected grading format. Please try again.');
    }
  }
}
