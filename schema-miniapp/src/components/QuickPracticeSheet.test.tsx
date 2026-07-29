// @vitest-environment jsdom
// Один лист на две пошаговые практики «Здесь и сейчас» (заземление и
// «Стоп») — проверяем обе. Правило №8: stop_start уходит РОВНО один раз и
// только у «Стопа» (у заземления своего события нет). Плюс read-after-write:
// прохождение записывается один раз, счётчик на done-экране — из ответа
// POST, кнопка «Поделиться» открывает карточку-шит.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { QuickPracticeSheet } from './QuickPracticeSheet';
import { asMockApi } from '../test-support/mockApi';

vi.mock('../api', async () => {
  const { mockPracticeApi } = await import('../test-support/mockApi');
  return { api: mockPracticeApi() };
});
import { api } from '../api';
const mockApi = asMockApi(api);

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

/** Пролистать все шаги практики до done-экрана (у практик разное число шагов). */
async function finishAllSteps() {
  while (screen.queryByText('Дальше')) {
    fireEvent.click(screen.getByText('Дальше'));
  }
  fireEvent.click(screen.getByText('Готово'));
  await flush();
}

describe('QuickPracticeSheet — техника «Стоп»', () => {
  it('шлёт stop_start ровно один раз при открытии', () => {
    render(<QuickPracticeSheet id="stop" onClose={() => {}} />);
    expect(mockApi.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('stop_start');
  });

  it('первый шаг — «С — Стоп» (дефолтная форма «ты» без провайдера)', () => {
    render(<QuickPracticeSheet id="stop" onClose={() => {}} />);
    expect(screen.getByText('С — Стоп. Замри на секунду')).toBeTruthy();
  });

  it('пройдя все шаги до конца, записывает прохождение РОВНО один раз', async () => {
    render(<QuickPracticeSheet id="stop" onClose={() => {}} />);
    await finishAllSteps();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('stop');
  });

  it('на done-экране виден счётчик из ответа записи (read-after-write, безлично)', async () => {
    render(<QuickPracticeSheet id="stop" onClose={() => {}} />);
    await finishAllSteps();
    expect(screen.getByText(/Пройдено уже 7 раз/)).toBeTruthy();
  });

  it('«Поделиться» на done-экране открывает шит с карточкой', async () => {
    render(<QuickPracticeSheet id="stop" onClose={() => {}} />);
    await finishAllSteps();
    expect(document.querySelector('canvas')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(document.querySelector('canvas')).not.toBeNull();
  });
});

describe('QuickPracticeSheet — заземление 5-4-3-2-1', () => {
  it('показывает свой первый шаг, а не шаг «Стопа»', () => {
    render(<QuickPracticeSheet id="grounding" onClose={() => {}} />);
    expect(screen.getByText('Найди 5 вещей, которые видишь')).toBeTruthy();
  });

  it('своего события старта у заземления нет — trackEvent не зовётся', () => {
    render(<QuickPracticeSheet id="grounding" onClose={() => {}} />);
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('записывает прохождение именно заземления', async () => {
    render(<QuickPracticeSheet id="grounding" onClose={() => {}} />);
    await finishAllSteps();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('grounding');
  });

  it('счётчик не показывается, пока он неизвестен (сеть упала) — без выдуманного нуля', async () => {
    mockApi.getPracticeSessions.mockRejectedValue(new Error('offline'));
    mockApi.recordPracticeSession.mockRejectedValue(new Error('offline'));
    render(<QuickPracticeSheet id="grounding" onClose={() => {}} />);
    await finishAllSteps();
    expect(screen.queryByText(/Пройдено уже/)).toBeNull();
    // «Поделиться» остаётся доступной и без счётчика
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });
});
