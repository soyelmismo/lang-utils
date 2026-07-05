import { describe, it, expect } from 'vitest';
import { buildBody } from './api';
import { ChatMessage, Settings } from '../types';

describe('buildBody', () => {
  const baseSettings: Settings = {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    model: 'default-model',
    temperature: 0.7,
    language: 'en',
    resultPopup: true,
    favoriteTargetLang: 'es',
    autoSetFavorite: false,
  };

  const messages: ChatMessage[] = [
    { role: 'user', content: 'hello' }
  ];

  it('uses settings.model when modelOverride is empty', () => {
    const result = buildBody(messages, '', baseSettings);
    expect(result.model).toBe('default-model');
  });

  it('uses modelOverride over settings.model when modelOverride is given', () => {
    const result = buildBody(messages, 'override-model', baseSettings);
    expect(result.model).toBe('override-model');
  });

  it('includes provided messages', () => {
    const result = buildBody(messages, '', baseSettings);
    expect(result.messages).toEqual(messages);
  });

  it('ensures stream: false is set in the body', () => {
    const result = buildBody(messages, '', baseSettings);
    expect(result.stream).toBe(false);
  });
});
