import { describe, expect, it } from 'vitest';
import { CoreComposePromptRegistry } from './core-compose-prompt.registry';
import type { CoreComposePageInput } from './core-compose-prompt.types';

describe('CoreComposePromptRegistry', () => {
  const registry = new CoreComposePromptRegistry();

  const pages: CoreComposePageInput[] = [
    { path: 'notes/topic-a.md', title: 'Topic A', content: '# Topic A\n\nContent about A.' },
    { path: 'notes/topic-b.md', title: 'Topic B', content: '# Topic B\n\nContent about B.' },
  ];

  it('builds prompt with all page contents and citation paths', () => {
    const prompt = registry.build(pages, {
      tone: '专业',
      targetAudience: '创作者',
      instruction: '突出实践案例',
    });

    expect(prompt.system).toContain('strict JSON');
    expect(prompt.system).toContain('title');
    expect(prompt.user).toContain('notes/topic-a.md');
    expect(prompt.user).toContain('notes/topic-b.md');
    expect(prompt.user).toContain('专业');
    expect(prompt.user).toContain('突出实践案例');
  });

  it('requires citations to reference provided paths only', () => {
    const prompt = registry.build(pages, {});

    expect(prompt.system).toContain('path');
    expect(prompt.system.toLowerCase()).toMatch(/not invent|do not fabricate|不捏造/);
  });
});
