// @vitest-environment jsdom
// Прохождение дыхания засчитывается только после полного цикла
// (BREATH_IN_S+BREATH_HOLD_S+BREATH_OUT_S=BREATH_CYCLE_S) — правило CLAUDE.md
// «никаких хардкод-заглушек»: досрочная остановка не должна попасть в
// счётчик как «практика пройдена».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { BreathingCard } from './BreathingCard';
import { BREATH_CYCLE_S } from '../utils/breathing';
import { asMockApi } from '../test-support/mockApi';

vi.mock('../api', async () => {
  const { mockPracticeApi } = await import('../test-support/mockApi');
  return { api: mockPracticeApi() };
});
import { api } from '../api';
const mockApi = asMockApi(api);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockApi.getPracticeSessions.mockResolvedValue({
    breathing: 0,
    grounding: 0,
    stop: 0,
  });
  mockApi.recordPracticeSession.mockResolvedValue({ ok: true, count: 1 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('BreathingCard', () => {
  it('остановка ДО первого полного цикла — прохождение не записывается', async () => {
    render(<BreathingCard />);
    fireEvent.click(screen.getByText('Начать дыхание'));
    act(() => {
      vi.advanceTimersByTime((BREATH_CYCLE_S - 2) * 1000);
    });
    fireEvent.click(screen.getByText('Достаточно'));
    await flush();
    expect(mockApi.recordPracticeSession).not.toHaveBeenCalled();
  });

  it('после полного цикла — прохождение записывается один раз', async () => {
    render(<BreathingCard />);
    fireEvent.click(screen.getByText('Начать дыхание'));
    act(() => {
      vi.advanceTimersByTime(BREATH_CYCLE_S * 1000);
    });
    fireEvent.click(screen.getByText('Достаточно'));
    await flush();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('breathing');
  });

  it('существующее событие breath_start уходит при запуске', () => {
    render(<BreathingCard />);
    fireEvent.click(screen.getByText('Начать дыхание'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('breath_start');
  });
});
