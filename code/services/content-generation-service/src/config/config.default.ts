import { MidwayConfig } from '@midwayjs/core';

export default {
  keys:
    process.env.APP_KEYS ||
    'content_generation_service_secret_key_please_change_in_production',

  koa: {
    port: 7010,
  },

  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'root123',
        database: process.env.DB_DATABASE || 'scrm_dev',
        synchronize: false,
        logging: process.env.NODE_ENV === 'local',
        entities: ['**/entity/*.entity{.ts,.js}'],
        timezone: '+08:00',
      },
    },
  },

  redis: {
    client: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB || '0'),
    },
  },

  bull: {
    defaultQueueOptions: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '2'),
      },
    },
  },

  contentGeneration: {
    llmApiBase: process.env.LLM_API_BASE || '',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
    promptVersion: process.env.CONTENT_PROMPT_VERSION || 'v1',
    acquisitionServiceUrl:
      process.env.ACQUISITION_SERVICE_URL || 'http://localhost:7003',
    llmWikiBaseUrl: process.env.LLM_WIKI_BASE_URL || 'http://127.0.0.1:19828',
    llmWikiApiToken: process.env.LLM_WIKI_API_TOKEN || '',
    llmWikiProjectId: process.env.LLM_WIKI_PROJECT_ID || 'current',
  },
} as MidwayConfig;
