// @vitest-environment jsdom
// Дыхание 4-4-6 — площадочные api/ShareCardSheet приходят инъекцией.
// Прохождение засчитывается только после полного цикла (BREATH_CYCLE_S) —
// правило CLAUDE.md «никаких хардкод-заглушек»: досрочная остановка не
// должна попасть в счётчик как «практика пройдена». Плюс живая фаза/круг
// по мере тиков таймера и честный счётчик прохождений под карточкой.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { BreathingCard, type BreathingCardProps } from './BreathingCard';
import { BREATH_CYCLE_S } from './breathing';
import type { ShareCardSheetProps } from '../share/shareCardSheetProps';

const mockApi = {
  trackEvent: vi.fn(),
  getPracticeSessions: vi.fn(),
  recordPracticeSession: vi.fn(),
};
const fakeApi = mockApi as unknown as BreathingCardProps['api'];

// Замена площадочного ShareCardSheet: зовёт draw() ровно как настоящий
// (useShareCard рисует в try/catch — в jsdom getContext() не реализован) и
// даёт кнопку закрытия, чтобы путь «открыл карточку → закрыл» был пройден.
function FakeShareCardSheet(props: ShareCardSheetProps) {
  const drawOnce = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    try {
      props.draw(canvas);
    } catch {
      /* jsdom без canvas-пакета — как и настоящий шит, экран не роняем */
    }
  };
  return (
    <div data-testid="share-sheet">
      {props.title}
      <canvas ref={drawOnce} />
      <button onClick={props.onClose}>Закрыть карточку</button>
    </div>
  );
}

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

function renderCard() {
  return render(
    <BreathingCard
      api={fakeApi}
      ShareCardSheet={FakeShareCardSheet}
      botShortUrl="https://t.me/test_bot"
    />,
  );
}

describe('BreathingCard — засчитывание прохождения', () => {
  it('остановка ДО первого полного цикла — прохождение не записывается', async () => {
    renderCard();
    fireEvent.click(screen.getByText('Начать дыхание'));
    act(() => {
      vi.advanceTimersByTime((BREATH_CYCLE_S - 2) * 1000);
    });
    fireEvent.click(screen.getByText('Достаточно'));
    await flush();
    expect(mockApi.recordPracticeSession).not.toHaveBeenCalled();
  });

  it('после полного цикла — прохождение записывается один раз с id="breathing"', async () => {
    renderCard();
    fireEvent.click(screen.getByText('Начать дыхание'));
    act(() => {
      vi.advanceTimersByTime(BREATH_CYCLE_S * 1000);
    });
    fireEvent.click(screen.getByText('Достаточно'));
    await flush();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('breathing');
  });

  it('breath_start трекается при старте', () => {
    renderCard();
    fireEvent.click(screen.getByText('Начать дыхание'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('breath_start');
  });
});

describe('BreathingCard — фаза и круг по ходу таймера', () => {
  it('фаза меняется вдох → задержка → выдох → вдох (новый круг)', () => {
    renderCard();
    fireEvent.click(screen.getByText('Начать дыхание'));
    expect(screen.getByText('Вдох')).toBeTruthy();
    expect(screen.getByText((c) => c.includes('круг 1'))).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000); // конец вдоха (4с)
    });
    expect(screen.getByText('Задержка')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000); // конец задержки (4с)
    });
    expect(screen.getByText('Выдох')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000); // конец выдоха (6с) — ровно полный цикл
    });
    expect(screen.getByText('Вдох')).toBeTruthy();
    expect(screen.getByText((c) => c.includes('круг 2'))).toBeTruthy();
  });
});

describe('BreathingCard — счётчик прохождений', () => {
  it('показывается под карточкой из GET /api/practice-sessions', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 4,
      grounding: 0,
      stop: 0,
    });
    renderCard();
    await flush();
    expect(screen.getByText(/Пройдено уже 4 раза/)).toBeTruthy();
  });

  it('не показывается, пока неизвестен (GET упал) — без выдуманного нуля', async () => {
    mockApi.getPracticeSessions.mockRejectedValue(new Error('offline'));
    renderCard();
    await flush();
    expect(screen.queryByText(/Пройдено уже/)).toBeNull();
  });
});

describe('BreathingCard — карточка «Поделиться»', () => {
  it('«Поделиться» открывает карточку практики, «Закрыть карточку» её убирает', async () => {
    renderCard();
    await flush();
    expect(screen.queryByTestId('share-sheet')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(screen.getByTestId('share-sheet')).toBeTruthy();
    expect(screen.getByText('Дыхание 4-4-6')).toBeTruthy();
    fireEvent.click(screen.getByText('Закрыть карточку'));
    expect(screen.queryByTestId('share-sheet')).toBeNull();
  });
});
