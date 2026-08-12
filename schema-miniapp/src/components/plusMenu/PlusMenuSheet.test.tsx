// @vitest-environment jsdom
// PlusMenuSheet — меню кнопки «плюс», собранное из utils/quickActions.ts.
// Проверяем: группы рендерятся, скрытые пункты не рендерятся, клик шлёт
// plus_action и зовёт onAction, «Изменить» открывает настройку, пустое
// состояние (всё скрыто) показывает подсказку вместо групп.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlusMenuSheet } from './PlusMenuSheet';
import { QUICK_ACTION_IDS } from '../../utils/quickActions';
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

  it('клавиша ArrowUp на ручке в листе настройки двигает пункт внутри его группы, шлёт quick_action_move и меняет меню', () => {
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Изменить'));

    // На экране два «Заземление 5-4-3-2-1»: строка меню (ActionRow) и строка
    // листа настройки (CustomizeRow, портал BottomSheet монтируется позже —
    // последнее вхождение и есть строка листа, тот же паттерн, что в
    // ToolsList.test.tsx «toggle в листе прячет строку»).
    const matches = screen.getAllByLabelText(
      'Переставить: Заземление 5-4-3-2-1',
    );
    const handle = matches[matches.length - 1];
    fireEvent.keyDown(handle, { key: 'ArrowUp' });

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

  it('группы «плюса»: жест ручки за границу своей группы прижимается к её краю, соседняя группа не задета', () => {
    // Группа «Успокоиться» (breathing, grounding, stop) — последняя строка
    // «Техника «Стоп»» не должна перепрыгнуть в следующую группу «Разобраться»
    // (belief_check первая) даже при большом смещении вниз.
    render(<PlusMenuSheet onAction={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Изменить'));
    const matches = screen.getAllByLabelText('Переставить: Техника «Стоп»');
    const handle = matches[matches.length - 1] as HTMLElement & {
      setPointerCapture: () => void;
    };
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 5000, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(handle, { clientY: 5000, pointerId: 1 });

    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'quick_action_move',
      expect.anything(),
    );
    // Порядок «плюса» не тронут — прижатие к границе своей группы, а не запись.
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([]);
  });
});
