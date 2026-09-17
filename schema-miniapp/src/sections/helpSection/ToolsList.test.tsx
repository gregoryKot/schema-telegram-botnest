// @vitest-environment jsdom
// ToolsList — 10 строк-переходов раздела «Здесь и сейчас», собранных из
// toolRows.ts (общий источник с листом настройки видимости). Проверяем:
// плюрализацию подписей (0/1/несколько), null-состояние без выдуманных
// чисел (правило «никаких хардкод-заглушек»), что клик по строке зовёт
// именно свой обработчик, скрытие строк через настройку видимости
// (utils/quickActionPrefs.ts) и пустое состояние, когда всё скрыто.
// Ж2 (аудит 2026-08): пилюля «Настроить» рядом с заголовком убрана (был
// второй вход в тот же лист, что и шестерёнка HelpHeader) — лист теперь
// открывается только через customizeOpenRef, как из настоящей шапки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { ToolsList } from './ToolsList';
import { QUICK_ACTION_IDS } from '../../utils/quickActions';
import {
  TOOLS_ACTIONS_HIDDEN_KEY,
  serializeHiddenActions,
} from '../../utils/quickActionPrefs';
import {
  TOOLS_ACTIONS_ORDER_KEY,
  getActionOrder,
  serializeActionOrder,
} from '../../utils/quickActionOrder';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

function renderList(overrides: Partial<Parameters<typeof ToolsList>[0]> = {}) {
  const handlers = {
    onOpenTasks: vi.fn(),
    onOpenPractices: vi.fn(),
    onOpenPlans: vi.fn(),
    onOpenBeliefCheck: vi.fn(),
    onOpenPhraseCheck: vi.fn(),
    onOpenSafePlace: vi.fn(),
    onOpenLetterToSelf: vi.fn(),
    onOpenFlashcard: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
    onOpenWarmWords: vi.fn(),
  };
  // Единственный вход в лист настройки — customizeOpenRef (имитирует
  // шестерёнку HelpHeader, пилюли внутри списка больше нет, Ж2).
  const customizeOpenRef = { current: () => {} };
  const { container } = render(
    <ToolsList
      tasksCount={0}
      practiceCount={null}
      planCount={null}
      childhoodDone={false}
      customizeOpenRef={customizeOpenRef}
      {...handlers}
      {...overrides}
    />,
  );
  return { ...handlers, container, customizeOpenRef };
}

function openCustomizeSheet(customizeOpenRef: { current: () => void }) {
  act(() => customizeOpenRef.current());
}

describe('ToolsList — плюрализация и пустые состояния', () => {
  it('0 целей — «Нет активных», а не «0 целей»', () => {
    renderList({ tasksCount: 0 });
    expect(screen.getByText('Нет активных')).toBeTruthy();
  });

  it('1 цель — единственное число', () => {
    renderList({ tasksCount: 1 });
    expect(screen.getByText('1 цель')).toBeTruthy();
  });

  it('3 цели — форма "цели"', () => {
    renderList({ tasksCount: 3 });
    expect(screen.getByText('3 цели')).toBeTruthy();
  });

  it('5 целей — форма "целей"', () => {
    renderList({ tasksCount: 5 });
    expect(screen.getByText('5 целей')).toBeTruthy();
  });

  it('practiceCount=null — подпись отсутствует (не выдуманный 0)', () => {
    renderList({ practiceCount: null });
    expect(screen.queryByText('Нет практик')).toBeNull();
    expect(screen.queryByText(/практик/)).toBeNull();
  });

  it('planCount=0 — «История пуста»', () => {
    renderList({ planCount: 0 });
    expect(screen.getByText('История пуста')).toBeTruthy();
  });

  it('колесо детства: подпись меняется от того, пройдено ли оно', () => {
    renderList({ childhoodDone: false });
    expect(screen.getByText('Займёт 2 минуты')).toBeTruthy();
    cleanup();
    renderList({ childhoodDone: true });
    expect(screen.getByText('Паттерны из прошлого')).toBeTruthy();
  });
});

describe('ToolsList — клики по строкам зовут свой обработчик', () => {
  it('клик по «Проверка убеждений» зовёт onOpenBeliefCheck, а не соседний', () => {
    const handlers = renderList();
    fireEvent.click(screen.getByText('Проверка убеждений'));
    expect(handlers.onOpenBeliefCheck).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenSafePlace).not.toHaveBeenCalled();
  });

  it('клик по «Критик или забота?» зовёт onOpenPhraseCheck, а не соседний разбор', () => {
    const handlers = renderList();
    fireEvent.click(screen.getByText('Критик или забота?'));
    expect(handlers.onOpenPhraseCheck).toHaveBeenCalledTimes(1);
    // Соседняя строка — тоже «проверка», перепутать легко именно её.
    expect(handlers.onOpenBeliefCheck).not.toHaveBeenCalled();
  });

  it('клик по «Колесо детства» зовёт onOpenChildhoodWheel', () => {
    const handlers = renderList();
    fireEvent.click(screen.getByText('Колесо детства'));
    expect(handlers.onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });
});

describe('ToolsList — скрытие строк (лист настройки через customizeOpenRef)', () => {
  it('скрытая строка не рендерится, остальные видны', () => {
    localStorage.setItem(
      TOOLS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions(['warm_words']),
    );
    renderList();
    expect(screen.queryByText('Тёплые слова')).toBeNull();
    expect(screen.getByText('Проверка убеждений')).toBeTruthy();
  });

  it('id в localStorage-скрытии/порядке, которого больше нет на поверхности «Инструменты» — не ломает рендер', () => {
    // diary_gratitude/tracker — только «плюс» после сведения дублей; лишний
    // id в hidden/order «Инструментов» просто не находит строку.
    localStorage.setItem(
      TOOLS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions(['diary_gratitude', 'tracker']),
    );
    localStorage.setItem(
      TOOLS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['tracker', 'warm_words']),
    );
    renderList();
    expect(screen.getByText('Проверка убеждений')).toBeTruthy();
    expect(screen.getByText('Тёплые слова')).toBeTruthy();
    expect(screen.getByText('Критик или забота?')).toBeTruthy();
  });

  it('пилюли «Настроить» рядом с заголовком больше нет — единственный вход (Ж2)', () => {
    renderList();
    expect(screen.queryByText('Настроить')).toBeNull();
  });

  it('customizeOpenRef (шестерёнка шапки HelpSection) открывает лист настройки', () => {
    const { customizeOpenRef } = renderList();
    expect(screen.queryByText('Какие инструменты показывать')).toBeNull();
    openCustomizeSheet(customizeOpenRef);
    expect(screen.getByText('Какие инструменты показывать')).toBeTruthy();
  });

  it('toggle в листе прячет строку и пишет в localStorage', () => {
    const { customizeOpenRef } = renderList();
    openCustomizeSheet(customizeOpenRef);
    const rows = screen.getAllByText('Тёплые слова');
    fireEvent.click(rows[rows.length - 1]);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_toggle', {
      action: 'warm_words',
      hidden: true,
      surface: 'tools',
    });
    expect(
      serializeHiddenActions(
        JSON.parse(localStorage.getItem(TOOLS_ACTIONS_HIDDEN_KEY) ?? '[]'),
      ),
    ).toBe(serializeHiddenActions(['warm_words']));
    expect(screen.getAllByText('Проверка убеждений').length).toBeGreaterThan(0);
  });

  it('все строки скрыты — подсказка вместо списка, ссылается на шестерёнку в шапке', () => {
    localStorage.setItem(
      TOOLS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions([...QUICK_ACTION_IDS]),
    );
    renderList();
    expect(screen.queryByText('Проверка убеждений')).toBeNull();
    expect(
      screen.getByText(
        'Все инструменты скрыты. Вернуть их можно через шестерёнку в шапке.',
      ),
    ).toBeTruthy();
  });
});

describe('ToolsList — порядок строк', () => {
  it('сохранённый порядок применяется: поднятая строка рендерится первой', () => {
    localStorage.setItem(
      TOOLS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['warm_words']),
    );
    const { container } = renderList();
    const html = container.textContent ?? '';
    expect(html.indexOf('Тёплые слова')).toBeLessThan(
      html.indexOf('Критик или забота?'),
    );
  });

  it('строки, которых нет в сохранённом порядке, не пропадают', () => {
    localStorage.setItem(
      TOOLS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['warm_words']),
    );
    renderList();
    expect(screen.getByText('Критик или забота?')).toBeTruthy();
    expect(screen.getByText('Мои цели')).toBeTruthy();
  });

  it('клавиша ArrowUp на ручке в листе настройки двигает строку, шлёт quick_action_move и меняет список', () => {
    // «Мои цели» (tasks) — вторая строка реестра, сосед первой («Критик или
    // забота?») — соседние строки, чтобы один шаг дал видимый результат.
    const { container, customizeOpenRef } = renderList();
    openCustomizeSheet(customizeOpenRef);

    // Два «Мои цели» на экране: строка списка и строка листа настройки —
    // последнее вхождение (портал листа монтируется позже) и есть строка листа.
    const matches = screen.getAllByLabelText('Переставить: Мои цели');
    const handle = matches[matches.length - 1];
    fireEvent.keyDown(handle, { key: 'ArrowUp' });

    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'tasks',
      surface: 'tools',
      dir: 'up',
    });
    expect(getActionOrder(TOOLS_ACTIONS_ORDER_KEY)[0]).toBe('tasks');

    fireEvent.click(screen.getByText('Готово'));
    const html = container.textContent ?? '';
    expect(html.indexOf('Мои цели')).toBeLessThan(
      html.indexOf('Критик или забота?'),
    );
  });

  it('крайняя строка списка: ArrowUp на ручке первой строки — no-op (событие не отправлено)', () => {
    const { customizeOpenRef } = renderList();
    openCustomizeSheet(customizeOpenRef);
    const matches = screen.getAllByLabelText('Переставить: Критик или забота?');
    const handle = matches[matches.length - 1];
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'quick_action_move',
      expect.anything(),
    );
  });

  it('жест ручки (pointerdown→move→up) в листе настройки — read-after-write в localStorage и на экране', () => {
    const { container, customizeOpenRef } = renderList();
    openCustomizeSheet(customizeOpenRef);
    const matches = screen.getAllByLabelText('Переставить: Критик или забота?');
    const handle = matches[matches.length - 1] as HTMLElement & {
      setPointerCapture: () => void;
    };
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 60, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(handle, { clientY: 60, pointerId: 1 });

    expect(getActionOrder(TOOLS_ACTIONS_ORDER_KEY)[1]).toBe('phrase_check');
    fireEvent.click(screen.getByText('Готово'));
    const html = container.textContent ?? '';
    expect(html.indexOf('Мои цели')).toBeLessThan(
      html.indexOf('Критик или забота?'),
    );
  });
});
