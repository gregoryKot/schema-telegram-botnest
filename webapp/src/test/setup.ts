import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Изоляция: размонтировать дерево и почистить хранилище после каждого теста.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom не реализует matchMedia — нужен для theme.ts и медиа-запросов.
// Параметризуется через setMatchMedia() ниже; по умолчанию ничего не совпадает.
let mediaMatches = false;

beforeEach(() => {
  mediaMatches = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: mediaMatches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

/** Заставить matchMedia(...).matches вернуть нужное значение в конкретном тесте. */
export function setMatchMedia(matches: boolean) {
  mediaMatches = matches;
}
