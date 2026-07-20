// @vitest-environment jsdom
// Правило №7 CLAUDE.md: свободнотекстовое поле «Безопасное место» обязано
// проходить через кризисную детекцию. Тест проверяет только появление
// карточки, не разметку.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { SafePlace } from './SafePlace';

vi.mock('../api', () => ({
  api: {
    getSafePlace: vi.fn(),
    saveSafePlace: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Пусто на сервере → компонент остаётся в форме редактирования (editing).
  mockApi.getSafePlace.mockResolvedValue(null);
  mockApi.saveSafePlace.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

async function renderSheet() {
  render(<SafePlace onClose={() => {}} />);
  await act(async () => {}); // flush getSafePlace()
  return screen.getByPlaceholderText(
    'Это небольшой уютный лес недалеко от дома. Я слышу птиц...',
  );
}

describe('SafePlace — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
