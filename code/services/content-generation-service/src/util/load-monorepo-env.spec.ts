import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadMonorepoEnv } = require('../../load-monorepo-env.cjs');

describe('loadMonorepoEnv', () => {
  const tempFiles: string[] = [];
  const touchedKeys: string[] = [];

  afterEach(() => {
    for (const file of tempFiles.splice(0)) {
      fs.rmSync(file, { force: true });
    }
    for (const key of touchedKeys.splice(0)) {
      delete process.env[key];
    }
  });

  it('loads variables from a .env file without overriding existing process.env', () => {
    const envPath = path.join(os.tmpdir(), `scrm-env-${Date.now()}.env`);
    tempFiles.push(envPath);
    fs.writeFileSync(
      envPath,
      '# comment\nLLM_WIKI_BASE_URL=http://127.0.0.1:19828\nLLM_WIKI_API_TOKEN=secret-token\n'
    );

    process.env.LLM_WIKI_BASE_URL = 'http://existing';
    touchedKeys.push('LLM_WIKI_BASE_URL', 'LLM_WIKI_API_TOKEN');
    delete process.env.LLM_WIKI_API_TOKEN;

    const result = loadMonorepoEnv({ envPath });

    expect(result.loaded).toBe(true);
    expect(result.count).toBe(1);
    expect(process.env.LLM_WIKI_BASE_URL).toBe('http://existing');
    expect(process.env.LLM_WIKI_API_TOKEN).toBe('secret-token');
  });

  it('returns loaded=false when the env file is missing', () => {
    const envPath = path.join(os.tmpdir(), `missing-${Date.now()}.env`);
    const result = loadMonorepoEnv({ envPath });
    expect(result.loaded).toBe(false);
    expect(result.count).toBe(0);
  });
});
