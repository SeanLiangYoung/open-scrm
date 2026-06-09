import type {
  CoreComposeOptions,
  CoreComposePageInput,
  CoreComposePrompt,
} from './core-compose-prompt.types';

export class CoreComposePromptRegistry {
  build(pages: CoreComposePageInput[], options: CoreComposeOptions = {}): CoreComposePrompt {
    const pagesBlock = pages
      .map(
        page =>
          `### ${page.title} (${page.path})\n${page.content}`
      )
      .join('\n\n---\n\n');

    const optionsBlock = [
      options.tone ? `Tone: ${options.tone}` : '',
      options.targetAudience ? `Target audience: ${options.targetAudience}` : '',
      options.instruction ? `User instruction: ${options.instruction}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      system: [
        'You are an editorial assistant synthesizing a core article from llm-wiki pages.',
        'Return strict JSON only: {"title":"","summary":"","body":"","keywords":[]}.',
        'body may use Markdown. keywords is a string array.',
        'Do not invent facts beyond the provided wiki pages.',
        'When referencing ideas, keep path provenance in mind (paths listed in user message).',
      ].join(' '),
      user: [
        'Synthesize one cohesive core article from these wiki pages:',
        pagesBlock,
        optionsBlock ? `\nConstraints:\n${optionsBlock}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }
}
