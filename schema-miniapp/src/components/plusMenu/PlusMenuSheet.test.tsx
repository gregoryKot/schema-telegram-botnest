// @vitest-environment jsdom
// PlusMenuSheet — меню кнопки «плюс», собранное из utils/quickActions.ts.
// Проверяем: группы рендерятся, скрытые пункты не рендерятся, клик шлёт
// plus_action и зовёт onAction, «Изменить» открывает настройку, пустое
// состояние (всё скрыто) показывает подсказку вместо групп.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import { PlusMenuSheet } from './PlusMenuSheet';
import { QUICK_ACTION_IDS, buildPlusActions } from '../../utils/quickActions';
import {
  PLUS_ACTIONS_HIDDEN_KEY,
  serializeHiddenActions,
} from '../../utils/quickActionPrefs';
import {
  PLUS_ACTIONS_ORDER_KEY,
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

describe('PlusMenuSheet — группы', () => {
  it('рендерит все группы и пункты по умолчанию (ничего не скрыто)', () => {
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Записать момент')).toBeTruthy();
    expect(screen.getByText('Оценить день')).toBeTruthy();
    expect(screen.getByText('Успокоиться')).toBeTruthy();
    expect(screen.getByText('Разобраться')).toBeTruthy();
    expect(screen.getByText('Поддержать себя')).toBeTruthy();
    expect(screen.getByText('Схема')).toBeTruthy();
    expect(screen.getByText('Трекер потребностей')).toBeTruthy();
    expect(screen.getByText('Дыхание 4-4-6')).toBeTruthy();
    expect(screen.getByText('Проверка убеждений')).toBeTruthy();
    expect(screen.getByText('Безопасное место')).toBeTruthy();
  });

  it('строки меню — без эмодзи: выбирают по смыслу (правило из FloatingPill)', () => {
    // Регресс на правило «название и подпись, без иконки»: эмодзи реестра
    // живут только в листах настройки, в самом меню их быть не должно.
    const { container } = render(
      <PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />,
    );
    for (const g of buildPlusActions((ty) => ty)) {
      for (const a of g.actions) {
        expect(container.textContent).not.toContain(a.emoji);
      }
    }
  });

  it('скрытый пункт не рендерится, остальные пункты его группы видны', () => {
    localStorage.setItem(
      PLUS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions(['diary_gratitude']),
    );
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('Благодарность')).toBeNull();
    expect(screen.getByText('Схема')).toBeTruthy();
    expect(screen.getByText('Режим')).toBeTruthy();
  });

  it('скрытие всех пунктов группы убирает и заголовок группы', () => {
    localStorage.setItem(
      PLUS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions(['tracker']),
    );
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('Оценить день')).toBeNull();
  });

  it('всё скрыто — вместо групп короткая подсказка про «Изменить»', () => {
    localStorage.setItem(
      PLUS_ACTIONS_HIDDEN_KEY,
      serializeHiddenActions([...QUICK_ACTION_IDS]),
    );
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('Записать момент')).toBeNull();
    expect(
      screen.getByText(
        'Все пункты скрыты. Вернуть их можно через «Изменить» выше.',
      ),
    ).toBeTruthy();
  });
});

describe('PlusMenuSheet — выбор действия', () => {
  it('клик по пункту шлёт plus_action, зовёт onAction и закрывает меню', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<PlusMenuSheet onAction={onAction} onClose={onClose} />);
    fireEvent.click(screen.getByText('Техника «Стоп»'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('plus_action', {
      action: 'stop',
    });
    expect(onAction).toHaveBeenCalledWith('stop');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PlusMenuSheet — «Изменить»', () => {
  it('открывает лист настройки', () => {
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Изменить'));
    expect(screen.getByText('Что показывать в «плюсе»')).toBeTruthy();
  });
});

describe('PlusMenuSheet — порядок пунктов', () => {
  it('сохранённый порядок применяется внутри группы: поднятый пункт рендерится первым', () => {
    // Группа «Успокоиться»: breathing, grounding, stop (порядок реестра).
    localStorage.setItem(
      PLUS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['stop']),
    );
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    // BottomSheet рендерится в document.body через портал (createPortal) —
    // не потомок container, поэтому берём весь body.
    const html = document.body.textContent ?? '';
    const stopIdx = html.indexOf('Техника «Стоп»');
    expect(stopIdx).toBeGreaterThan(-1);
    expect(stopIdx).toBeLessThan(html.indexOf('Дыхание 4-4-6'));
    expect(stopIdx).toBeLessThan(html.indexOf('Заземление 5-4-3-2-1'));
  });

  it('пункты, которых нет в сохранённом порядке, не пропадают', () => {
    localStorage.setItem(
      PLUS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['diary_gratitude']),
    );
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Схема')).toBeTruthy();
    expect(screen.getByText('Режим')).toBeTruthy();
    expect(screen.getByText('Благодарность')).toBeTruthy();
    expect(screen.getByText('Трекер потребностей')).toBeTruthy();
  });

  it('стрелка в листе настройки двигает пункт внутри его группы, шлёт quick_action_move и меняет меню', () => {
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Изменить'));

    // На экране два «Заземление 5-4-3-2-1»: строка меню (ActionRow) и строка
    // листа настройки (CustomizeRow, портал BottomSheet монтируется позже —
    // последнее вхождение и есть строка листа, тот же паттерн, что в
    // ToolsList.test.tsx «toggle в листе прячет строку»).
    const matches = screen.getAllByText('Заземление 5-4-3-2-1');
    const switchEl = matches[matches.length - 1].closest(
      '[role="switch"]',
    ) as HTMLElement;
    const moveArrows = (switchEl.parentElement as HTMLElement)
      .nextElementSibling as HTMLElement;
    fireEvent.click(within(moveArrows).getByLabelText('Выше'));

    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'grounding',
      surface: 'plus',
      dir: 'up',
    });
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([
      'grounding',
      'breathing',
      'stop',
    ]);

    fireEvent.click(screen.getByText('Готово'));
    const html = document.body.textContent ?? '';
    expect(html.indexOf('Заземление 5-4-3-2-1')).toBeLessThan(
      html.indexOf('Дыхание 4-4-6'),
    );
  });
});
