// @vitest-environment jsdom
// Правило №7 CLAUDE.md: ответ на вопрос недели — свободный текст, обязан
// проходить через кризисную детекцию. Тест проверяет только появление
// карточки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WeeklyQuestion } from './WeeklyQuestion';

vi.mock('../api', () => ({
  api: {
    saveNote: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.saveNote.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

function renderCard() {
  render(<WeeklyQuestion date="2026-07-20" onDismiss={() => {}} />);
  return screen.getByPlaceholderText('Напиши, что приходит в голову...');
}

describe('WeeklyQuestion — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе', () => {
    const textarea = renderCard();
    fireEvent.change(textarea, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const textarea = renderCard();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
