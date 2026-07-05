import { describe, it, expect } from 'vitest';
import { getEffectivePrompt } from './mode-helpers';

describe('getEffectivePrompt', () => {
  it('should replace {{selection}} with the provided selection text', () => {
    const prompt = 'Summarize this: {{selection}}';
    const result = getEffectivePrompt({ prompt }, 'Hello world!');
    expect(result).toBe('Summarize this: Hello world!');
  });

  it('should replace {{targetLang}} when provided', () => {
    const prompt = 'Translate to {{targetLang}}: {{selection}}';
    const result = getEffectivePrompt({ prompt }, 'Hello world!', 'Spanish');
    expect(result).toBe('Translate to Spanish: Hello world!');
  });

  it('should replace multiple occurrences of {{selection}} and {{targetLang}}', () => {
    const prompt = 'Translate {{selection}} to {{targetLang}}. Again, {{selection}} to {{targetLang}}.';
    const result = getEffectivePrompt({ prompt }, 'Hello', 'Spanish');
    expect(result).toBe('Translate Hello to Spanish. Again, Hello to Spanish.');
  });

  it('should not replace {{targetLang}} if targetLang argument is not provided', () => {
    const prompt = 'Translate to {{targetLang}}: {{selection}}';
    const result = getEffectivePrompt({ prompt }, 'Hello world!');
    expect(result).toBe('Translate to {{targetLang}}: Hello world!');
  });

  it('should handle undefined prompt gracefully', () => {
    const result = getEffectivePrompt({}, 'Hello');
    expect(result).toBe('');
  });

  it('should handle empty prompt string gracefully', () => {
    const result = getEffectivePrompt({ prompt: '' }, 'Hello');
    expect(result).toBe('');
  });

  it('should handle empty selection gracefully', () => {
    const prompt = 'Text: {{selection}}';
    const result = getEffectivePrompt({ prompt }, '');
    expect(result).toBe('Text: ');
  });
});
