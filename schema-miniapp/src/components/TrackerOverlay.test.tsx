// @vitest-environment jsdom
// Аудит автосейва (CLAUDE.md, инцидент useClientDetail). handleChange здесь
// получает конкретное значение `v` АРГУМЕНТОМ от NeedRatingBar в момент тапа
// и кладёт именно его (не state) в замыкание setTimeout — структурно не может
// прочитать устаревший рендер. Тест эмпирически проверяет, что это НЕ баг:
// быстрые повторные тапы по шкале не теряют последнюю оценку.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { TrackerOverlay } from './TrackerOverlay';
import type { Need } from '../types';

vi.mock('../api', () => ({
  api: { ratings: vi.fn(), saveRating: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const NEEDS: Need[] = [
  { id: 'safety', emoji: '🛡️', title: 'Безопасность', chartLabel: 'Безоп.' },
];

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    needs: NEEDS,
    ratings: {},
    saved: {},
    onChange: vi.fn(),
    onSaved: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.setItem('tracker_onboarding_v1', '1'); // онбординг не мешает тапам
  mockApi.saveRating.mockResolvedValue({ ok: true, allDone: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TrackerOverlay — debounce сохранения оценки (обычный режим, не бэкафилл)', () => {
  it('не отправляет запрос сразу — только после паузы 500мс', () => {
    render(<TrackerOverlay {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Поставить 3'));
    expect(mockApi.saveRating).not.toHaveBeenCalled();
  });

  it('НЕ БАГ: серия быстрых тапов по одной потребности — сохраняется ПОСЛЕДНЕЕ значение, один вызов api', async () => {
    render(<TrackerOverlay {...baseProps()} />);
    fireEvent.click(screen.getByLabelText('Поставить 3'));
    fireEvent.click(screen.getByLabelText('Поставить 7'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockApi.saveRating).toHaveBeenCalledTimes(1);
    expect(mockApi.saveRating).toHaveBeenCalledWith('safety', 7);
  });

  it('НЕ БАГ: каждый тап сразу пробрасывает СВОЁ значение наверх (onChange), а не устаревшее', () => {
    const onChange = vi.fn();
    render(<TrackerOverlay {...baseProps({ onChange })} />);
    fireEvent.click(screen.getByLabelText('Поставить 4'));
    expect(onChange).toHaveBeenLastCalledWith('safety', 4);
    fireEvent.click(screen.getByLabelText('Поставить 9'));
    expect(onChange).toHaveBeenLastCalledWith('safety', 9);
  });
});

describe('TrackerOverlay — debounce сохранения оценки (бэкафилл прошлой даты)', () => {
  it('НЕ БАГ: серия быстрых тапов — сохраняется ПОСЛЕДНЕЕ значение с датой, один вызов api', async () => {
    mockApi.ratings.mockResolvedValue({});
    render(<TrackerOverlay {...baseProps({ date: '2026-07-10' })} />);
    await act(async () => {}); // flush api.ratings(date) -> localLoading=false
    fireEvent.click(screen.getByLabelText('Поставить 2'));
    fireEvent.click(screen.getByLabelText('Поставить 8'));
    expect(mockApi.saveRating).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockApi.saveRating).toHaveBeenCalledTimes(1);
    expect(mockApi.saveRating).toHaveBeenCalledWith('safety', 8, '2026-07-10');
  });
});
