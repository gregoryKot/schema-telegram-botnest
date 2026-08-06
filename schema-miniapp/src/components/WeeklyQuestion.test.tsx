// @vitest-environment jsdom
// Правило №7 CLAUDE.md: ответ на вопрос недели — свободный текст, обязан
// проходить через кризисную детекцию. Тест проверяет только появление
// карточки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WeeklyQuestion, shouldShowWeeklyQuestion } from './WeeklyQuestion';

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

describe('shouldShowWeeklyQuestion — показывается по понедельникам, раз в неделю', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('в понедельник, если на этой неделе ещё не отвечали — true', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 3)); // Mon Aug 3 2026
    expect(shouldShowWeeklyQuestion()).toBe(true);
  });

  it('во вторник (не понедельник) — false', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 4)); // Tue Aug 4 2026
    expect(shouldShowWeeklyQuestion()).toBe(false);
  });
});

describe('WeeklyQuestion — «Пропустить»: закрывает карточку и гасит показ на неделю, без отправки на сервер', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('клик «Пропустить» вызывает onDismiss, НЕ шлёт api.saveNote, и следующий рендер на этой неделе больше не должен показываться', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 3));
    const onDismiss = vi.fn();
    render(<WeeklyQuestion date="2026-08-03" onDismiss={onDismiss} />);
    expect(shouldShowWeeklyQuestion()).toBe(true);

    fireEvent.click(screen.getByText('Пропустить'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockApi.saveNote).not.toHaveBeenCalled();
    expect(shouldShowWeeklyQuestion()).toBe(false);
  });
});

describe('WeeklyQuestion — сохранение ответа', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('кнопка «Сохранить» выключена, пока текст пустой', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 3));
    render(<WeeklyQuestion date="2026-08-03" onDismiss={() => {}} />);
    expect(screen.getByText('Сохранить').hasAttribute('disabled')).toBe(true);
  });

  it('заполненный ответ уходит в api.saveNote вместе с текстом вопроса, карточка гасится на неделю', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 3));
    const onDismiss = vi.fn();
    render(<WeeklyQuestion date="2026-08-03" onDismiss={onDismiss} />);
    const textarea = screen.getByPlaceholderText(
      'Напиши, что приходит в голову...',
    );
    fireEvent.change(textarea, { target: { value: 'больше отдыхал' } });
    expect(screen.getByText('Сохранить').hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByText('Сохранить'));

    expect(mockApi.saveNote).toHaveBeenCalledTimes(1);
    const [date, noteText] = mockApi.saveNote.mock.calls[0];
    expect(date).toBe('2026-08-03');
    expect(noteText).toContain('больше отдыхал');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(shouldShowWeeklyQuestion()).toBe(false);
  });
});
