// @vitest-environment jsdom
// Флоу быстрой практики «Здесь и сейчас» (заземление и техника «Стоп») —
// площадочные StepFlow/ShareCardSheet/api приходят инъекцией, здесь
// проверяется сама связка. Правило №8: stop_start уходит РОВНО один раз и
// только у «Стопа». Read-after-write: прохождение записывается один раз,
// счётчик на done-экране — из ответа POST. StepFlow — настоящий
// StepFlowBody (не заглушка), чтобы флоу проходил по-честному.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import {
  QuickPracticeFlow,
  type QuickPracticeFlowProps,
} from './QuickPracticeFlow';
import { StepFlowBody } from './StepFlowBody';
import type { QuickPracticeId } from './quickPractices';
import type { ShareCardSheetProps } from '../share/shareCardSheetProps';

// api площадки приходит инъекцией (webapp — JWT, мини-апп — initData) — сам
// объект стабилен между рендерами одного открытия практики (уходит в
// зависимости эффекта stop_start и useQuickPractice).
const mockApi = {
  trackEvent: vi.fn(),
  getPracticeSessions: vi.fn(),
  recordPracticeSession: vi.fn(),
};
const fakeApi = mockApi as unknown as QuickPracticeFlowProps['api'];

// Честная, но лёгкая замена площадочного ShareCardSheet: рендерит title и
// canvas, зовёт draw() ровно как настоящий (useShareCard рисует в try/catch —
// в jsdom getContext() не реализован, и без catch тест падал бы не на своей
// ошибке) и даёт кнопку закрытия, чтобы onClose тоже был пройден.
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
    <div data-testid="share-sheet" data-zindex={props.zIndex}>
      {props.title}
      <canvas ref={drawOnce} />
      <button onClick={props.onClose}>Закрыть карточку</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPracticeSessions.mockResolvedValue({
    breathing: 0,
    grounding: 0,
    stop: 0,
  });
  mockApi.recordPracticeSession.mockResolvedValue({ ok: true, count: 7 });
});

afterEach(() => cleanup());

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

function renderFlow(
  id: QuickPracticeId,
  extra: Partial<QuickPracticeFlowProps> = {},
) {
  return render(
    <QuickPracticeFlow
      id={id}
      onClose={vi.fn()}
      api={fakeApi}
      StepFlow={StepFlowBody}
      ShareCardSheet={FakeShareCardSheet}
      botShortUrl="https://t.me/test_bot"
      shareZIndex={321}
      {...extra}
    />,
  );
}

describe('QuickPracticeFlow — техника «Стоп»', () => {
  it('шлёт stop_start ровно один раз при открытии', () => {
    renderFlow('stop');
    expect(mockApi.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('stop_start');
  });

  it('показывает свой первый шаг', () => {
    renderFlow('stop');
    expect(screen.getByText('С — Стоп. Замри на секунду')).toBeTruthy();
  });

  it('пройдя все шаги, записывает прохождение ровно один раз с id="stop"', async () => {
    renderFlow('stop');
    await finishAllSteps();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('stop');
  });

  it('done-экран показывает счётчик из ответа POST (read-after-write)', async () => {
    mockApi.recordPracticeSession.mockResolvedValue({ ok: true, count: 9 });
    renderFlow('stop');
    await finishAllSteps();
    expect(screen.getByText(/Пройдено уже 9 раз/)).toBeTruthy();
  });

  it('«Поделиться» открывает инжектированный ShareCardSheet со своим zIndex', async () => {
    renderFlow('stop', { shareZIndex: 555 });
    await finishAllSteps();
    expect(screen.queryByTestId('share-sheet')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    const sheet = screen.getByTestId('share-sheet');
    expect(sheet).toBeTruthy();
    expect(sheet.getAttribute('data-zindex')).toBe('555');
    expect(sheet.textContent).toContain('Техника «Стоп»'); // title дошёл до шита
    // Закрытие карточки возвращает на done-экран практики, а не закрывает всё.
    fireEvent.click(screen.getByText('Закрыть карточку'));
    expect(screen.queryByTestId('share-sheet')).toBeNull();
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });
});

describe('QuickPracticeFlow — заземление 5-4-3-2-1', () => {
  it('своего события старта у заземления нет — trackEvent не зовётся', () => {
    renderFlow('grounding');
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('показывает свой первый шаг, а не шаг «Стопа»', () => {
    renderFlow('grounding');
    expect(screen.getByText('Найди 5 вещей, которые видишь')).toBeTruthy();
  });

  it('записывает прохождение именно заземления', async () => {
    renderFlow('grounding');
    await finishAllSteps();
    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('grounding');
  });

  it('GET и POST оба упали — без "Пройдено уже", но «Поделиться» остаётся', async () => {
    mockApi.getPracticeSessions.mockRejectedValue(new Error('offline'));
    mockApi.recordPracticeSession.mockRejectedValue(new Error('offline'));
    renderFlow('grounding');
    await finishAllSteps();
    expect(screen.queryByText(/Пройдено уже/)).toBeNull();
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });
});
