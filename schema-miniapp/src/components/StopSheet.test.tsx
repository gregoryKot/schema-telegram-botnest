// @vitest-environment jsdom
// Правило №8 CLAUDE.md: stop_start уходит РОВНО один раз при маунте (аналог
// breath_start у BreathingCard), без провайдера addressForm — дефолт «ты» из
// AddressFormContext (см. utils/addressForm.tsx). Плюс read-after-write:
// прохождение техники записывается ровно один раз, счётчик на done-экране —
// из ответа POST, кнопка «Поделиться» открывает карточку-шит.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { StopSheet } from './StopSheet';

vi.mock('../api', () => ({
  api: {
    trackEvent: vi.fn(),
    getPracticeSessions: vi.fn(),
    recordPracticeSession: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPracticeSessions.mockResolvedValue({
    breathing: 0,
    grounding: 0,
    stop: 0,
  });
  mockApi.recordPracticeSession.mockResolvedValue({ ok: true, count: 7 });
});

afterEach(() => {
  cleanup();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function finishAllSteps() {
  fireEvent.click(screen.getByText('Дальше')); // С -> Т
  fireEvent.click(screen.getByText('Дальше')); // Т -> О
  fireEvent.click(screen.getByText('Дальше')); // О -> П (последний)
  fireEvent.click(screen.getByText('Готово')); // -> done-экран
  await flush();
}

describe('StopSheet', () => {
  it('шлёт stop_start ровно один раз при открытии', () => {
    render(<StopSheet onClose={() => {}} />);
    expect(mockApi.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('stop_start');
  });

  it('первый шаг — «С — Стоп» (дефолтная форма «ты» без провайдера)', () => {
    render(<StopSheet onClose={() => {}} />);
    expect(screen.getByText('С — Стоп. Замри на секунду')).toBeTruthy();
  });

  it('пройдя все шаги до конца, записывает прохождение РОВНО один раз', async () => {
    render(<StopSheet onClose={() => {}} />);
    await finishAllSteps();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('stop');
  });

  it('на done-экране виден счётчик из ответа записи (read-after-write, безлично)', async () => {
    render(<StopSheet onClose={() => {}} />);
    await finishAllSteps();
    expect(screen.getByText('Пройдено уже 7 раз')).toBeTruthy();
  });

  it('«Поделиться» на done-экране открывает шит с карточкой', async () => {
    render(<StopSheet onClose={() => {}} />);
    await finishAllSteps();
    expect(document.querySelector('canvas')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(document.querySelector('canvas')).not.toBeNull();
  });
});
