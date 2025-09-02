import { registerAs } from '@nestjs/config';

export interface AppConfig {
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  ai: {
    openaiApiKey: string;
    cohereApiKey: string;
    modelName: string;
    temperature: number;
  };
  retrieval: {
    maxDocuments: number;
    rerankTopN: number;
  };
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    database: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME || 'hr_help_desk',
    },
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY!,
      cohereApiKey: process.env.COHERE_API_KEY!,
      modelName: process.env.LLM_MODEL || 'gpt-4',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0'),
    },
    retrieval: {
      maxDocuments: parseInt(process.env.MAX_DOCUMENTS || '10'),
      rerankTopN: parseInt(process.env.RERANK_TOP_N || '5'),
    },
  }),
);
