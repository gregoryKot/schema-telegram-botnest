// @vitest-environment jsdom
// ToolsList — 10 строк-переходов раздела «Здесь и сейчас», собранных из
// toolRows.ts (общий источник с листом настройки видимости). Проверяем:
// плюрализацию подписей (0/1/несколько), null-состояние без выдуманных
// чисел (правило «никаких хардкод-заглушек»), что клик по строке зовёт
// именно свой обработчик, скрытие строк через «Настроить»
// (utils/quickActionPrefs.ts) и пустое состояние, когда всё скрыто.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
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
  const { container } = render(
    <ToolsList
      tasksCount={0}
      practiceCount={null}
      planCount={null}
      childhoodDone={false}
      {...handlers}
      {...overrides}
    />,
  );
  return { ...handlers, container };
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

describe('ToolsList — скрытие строк («Настроить»)', () => {
  it('скрытая строка не рендерится, остальные видны', () => {
    localStorage.setItem(
      TOOLS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions(['warm_words']),
    );
    renderList();
    expect(screen.queryByText('Тёплые слова')).toBeNull();
    expect(screen.getByText('Проверка убеждений')).toBeTruthy();
  });

  it('«Настроить» открывает лист настройки', () => {
    renderList();
    fireEvent.click(screen.getByText('Настроить'));
    expect(screen.getByText('Какие инструменты показывать')).toBeTruthy();
  });

  it('toggle в листе прячет строку и пишет в localStorage', () => {
    renderList();
    fireEvent.click(screen.getByText('Настроить'));
    // В листе строки помечены их label — берём именно там (после открытия
    // на экране два «Тёплые слова»: строка списка + строка листа настройки).
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

  it('все строки скрыты — подсказка вместо списка, кнопка «Настроить» остаётся', () => {
    localStorage.setItem(
      TOOLS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions([...QUICK_ACTION_IDS]),
    );
    renderList();
    expect(screen.queryByText('Проверка убеждений')).toBeNull();
    expect(
      screen.getByText(
        'Все инструменты скрыты. Вернуть их можно через «Настроить» выше.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Настроить')).toBeTruthy();
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

  it('стрелка в листе настройки двигает строку, шлёт quick_action_move и меняет список', () => {
    // «Мои цели» (tasks) — вторая строка реестра, сосед первой («Критик или
    // забота?») — соседние строки, чтобы один свап дал видимый результат.
    const { container } = renderList();
    fireEvent.click(screen.getByText('Настроить'));

    // Два «Мои цели» на экране: строка списка и строка листа настройки —
    // последнее вхождение (портал листа монтируется позже) и есть строка листа.
    const matches = screen.getAllByText('Мои цели');
    const switchEl = matches[matches.length - 1].closest(
      '[role="switch"]',
    ) as HTMLElement;
    const moveArrows = (switchEl.parentElement as HTMLElement)
      .nextElementSibling as HTMLElement;
    fireEvent.click(within(moveArrows).getByLabelText('Выше'));

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

  it('крайняя строка списка: стрелка вверх у первой строки задизейблена', () => {
    renderList();
    fireEvent.click(screen.getByText('Настроить'));
    const matches = screen.getAllByText('Критик или забота?');
    const switchEl = matches[matches.length - 1].closest(
      '[role="switch"]',
    ) as HTMLElement;
    const moveArrows = (switchEl.parentElement as HTMLElement)
      .nextElementSibling as HTMLElement;
    expect(
      within(moveArrows).getByLabelText('Выше').getAttribute('aria-disabled'),
    ).toBe('true');
  });
});
