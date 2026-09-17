// @vitest-environment jsdom
// Один лист на две пошаговые практики «Здесь и сейчас» (заземление и
// «Стоп») на сайте — зеркало schema-miniapp/QuickPracticeSheet.test.tsx.
// Правило №8: stop_start уходит РОВНО один раз и только у «Стопа» (у
// заземления своего события нет). Плюс read-after-write: прохождение
// записывается один раз, счётчик на done-экране — из ответа POST, а не из
// выдуманного нуля, если сеть упала (правило «никаких хардкод-заглушек»).
// Оболочка — StepFlowSheet (useHistorySheet) + ShareCardSheet (тоже
// useHistorySheet), поэтому дерево обязано жить внутри MemoryRouter.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickPracticeSheet } from './QuickPracticeSheet';

vi.mock('../../api', () => ({
  api: {
    trackEvent: vi.fn(),
    getPracticeSessions: vi.fn(),
    recordPracticeSession: vi.fn(),
  },
}));
import { api } from '../../api';
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

function renderSheet(id: 'stop' | 'grounding', onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <QuickPracticeSheet id={id} onClose={onClose} />
    </MemoryRouter>,
  );
}

/** Пролистать все шаги практики до done-экрана (у практик разное число шагов). */
async function finishAllSteps() {
  while (screen.queryByText('Дальше')) {
    fireEvent.click(screen.getByText('Дальше'));
  }
  fireEvent.click(screen.getByText('Готово'));
  await flush();
}

describe('QuickPracticeSheet (webapp) — техника «Стоп»', () => {
  it('шлёт stop_start ровно один раз при открытии', () => {
    renderSheet('stop');
    expect(mockApi.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('stop_start');
  });

  it('первый шаг — «С — Стоп» (дефолтная форма «ты» без провайдера)', () => {
    renderSheet('stop');
    expect(screen.getByText('С — Стоп. Замри на секунду')).toBeTruthy();
  });

  it('пройдя все шаги до конца, записывает прохождение РОВНО один раз', async () => {
    renderSheet('stop');
    await finishAllSteps();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('stop');
  });

  it('на done-экране виден счётчик из ответа записи (read-after-write, безлично)', async () => {
    renderSheet('stop');
    await finishAllSteps();
    expect(screen.getByText(/Пройдено уже 7 раз/)).toBeTruthy();
  });

  it('«Поделиться» на done-экране открывает шит с карточкой', async () => {
    renderSheet('stop');
    await finishAllSteps();
    expect(document.querySelector('canvas')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(document.querySelector('canvas')).not.toBeNull();
  });
});

describe('QuickPracticeSheet (webapp) — заземление 5-4-3-2-1', () => {
  it('показывает свой первый шаг, а не шаг «Стопа»', () => {
    renderSheet('grounding');
    expect(screen.getByText('Найди 5 вещей, которые видишь')).toBeTruthy();
  });

  it('своего события старта у заземления нет — trackEvent не зовётся', () => {
    renderSheet('grounding');
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('записывает прохождение именно заземления', async () => {
    renderSheet('grounding');
    await finishAllSteps();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('grounding');
  });

  it('счётчик не показывается, пока он неизвестен (сеть упала) — без выдуманного нуля', async () => {
    mockApi.getPracticeSessions.mockRejectedValue(new Error('offline'));
    mockApi.recordPracticeSession.mockRejectedValue(new Error('offline'));
    renderSheet('grounding');
    await finishAllSteps();
    expect(screen.queryByText(/Пройдено уже/)).toBeNull();
    // «Поделиться» остаётся доступной и без счётчика
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });
});
