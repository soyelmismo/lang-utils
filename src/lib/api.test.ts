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
import { parseResponseText } from './api';

describe('parseResponseText', () => {
  it('throws an error if response is empty', () => {
    expect(() => parseResponseText('')).toThrowError("API returned an empty response");
    expect(() => parseResponseText('   ')).toThrowError("API returned an empty response");
  });

  it('parses valid plain JSON and returns content', () => {
    const jsonStr = JSON.stringify({
      choices: [
        {
          message: {
            content: "Hello, plain JSON world!"
          }
        }
      ]
    });
    expect(parseResponseText(jsonStr)).toBe("Hello, plain JSON world!");
  });

  it('throws an error if plain JSON response contains an error field as string', () => {
    const jsonStr = JSON.stringify({
      error: "Something went wrong"
    });
    expect(() => parseResponseText(jsonStr)).toThrowError("API error: Something went wrong");
  });

  it('throws an error if plain JSON response contains an error object', () => {
    const jsonStr = JSON.stringify({
      error: { message: "Invalid request" }
    });
    expect(() => parseResponseText(jsonStr)).toThrowError("API error: Invalid request");
  });

  it('parses valid SSE stream and concatenates content', () => {
    const sseStr = `
data: {"choices":[{"delta":{"content":"Hello, "}}]}
data: {"choices":[{"delta":{"content":"SSE "}}]}
data: {"choices":[{"delta":{"content":"world!"}}]}
data: [DONE]
    `;
    expect(parseResponseText(sseStr)).toBe("Hello, SSE world!");
  });

  it('parses SSE stream that uses message.content instead of delta.content', () => {
    const sseStr = `
data: {"choices":[{"message":{"content":"Hello, "}}]}
data: {"choices":[{"message":{"content":"world!"}}]}
    `;
    expect(parseResponseText(sseStr)).toBe("Hello, world!");
  });

  it('ignores malformed SSE chunks and continues parsing', () => {
    const sseStr = `
data: {"choices":[{"delta":{"content":"Valid 1"}}]}
data: {malformed_json}
data: {"choices":[{"delta":{"content":" Valid 2"}}]}
    `;
    expect(parseResponseText(sseStr)).toBe("Valid 1 Valid 2");
  });

  it('throws a "Could not parse API response" error if neither JSON nor SSE works', () => {
    const invalidResponse = "This is not valid JSON or SSE";
    expect(() => parseResponseText(invalidResponse)).toThrowError("Could not parse API response: This is not valid JSON or SSE");
  });
});
