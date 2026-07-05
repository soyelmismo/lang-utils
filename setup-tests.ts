import { vi } from 'vitest';

vi.mock('webextension-polyfill', () => {
  return {
    default: {
      runtime: {
        sendMessage: vi.fn(),
      }
    }
  };
});
