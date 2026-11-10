// @vitest-environment jsdom
// Дыхание 4-4-6 листом (⌘K, итог разбора, паттерн) — та же живая механика, что в разделе
// «Практики», а не пошаговые «Вдохни на 4 счёта / Дальше» (правило №3). Проверяем: покой с
// «Начать дыхание» и «Закрыть», предупреждение только в покое, полоса фаз во время дыхания,
// итог через минуту («Закрыть» главнее «Ещё минуту»), прохождение засчитано один раз, «Закрыть»
// идёт через историю (goBack), «поделиться» открывает карточку поверх листа.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BreathingSheet } from './BreathingSheet';
import { BREATH_SESSION_S } from '../../../../shared/src/practices/breathing';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn(), getPracticeSessions: vi.fn(), recordPracticeSession: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockApi.getPracticeSessions.mockResolvedValue({ breathing: 2, grounding: 0, stop: 0 });
  mockApi.recordPracticeSession.mockResolvedValue({ ok: true, count: 3 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderSheet(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <BreathingSheet onClose={onClose} note={<span>самопомощь</span>} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('BreathingSheet', () => {
  it('покой: «Начать дыхание», «Закрыть» и предупреждение под листом; пошаговых «Дальше» нет', () => {
    renderSheet();
    expect(screen.getByText('Начать дыхание')).toBeTruthy();
    expect(screen.getByText('Закрыть')).toBeTruthy();
    expect(screen.getByText('самопомощь')).toBeTruthy();
    expect(screen.queryByText('Дальше')).toBeNull();
    expect(screen.queryByText('Вдохни на 4 счёта')).toBeNull();
  });

  it('во время дыхания: фаза заголовком, полоса фаз с текущей, тихое «Достаточно», без предупреждения', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Начать дыхание'));
    expect(screen.getByRole('heading', { name: 'Вдох' })).toBeTruthy();
    expect(screen.getByText('круг 1 из 4')).toBeTruthy();
    expect(screen.getByText('вдох 4').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Достаточно').className).toContain('ds-link');
    expect(screen.queryByText('самопомощь')).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('heading', { name: 'Задержка' })).toBeTruthy();
    expect(screen.getByText('задержка 4').closest('li')?.getAttribute('aria-current')).toBe('step');
  });

  it('через минуту — итог: «Закрыть» залитая, «Ещё минуту» ссылкой; прохождение записано один раз', async () => {
    const onClose = renderSheet();
    fireEvent.click(screen.getByText('Начать дыхание'));
    act(() => { vi.advanceTimersByTime(BREATH_SESSION_S * 1000); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Минута позади')).toBeTruthy();
    expect(screen.getByText('Закрыть').className).toContain('ds-btn');
    expect(screen.getByText('Ещё минуту').className).toContain('ds-link');
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('«поделиться» открывает карточку шаринга поверх листа', () => {
    renderSheet();
    expect(document.querySelector('canvas')).toBeNull();
    fireEvent.click(screen.getByText('поделиться →'));
    expect(document.querySelector('canvas')).not.toBeNull();
  });
});
