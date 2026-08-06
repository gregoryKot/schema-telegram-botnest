// @vitest-environment jsdom
// PlusMenuSheet — меню кнопки «плюс», собранное из utils/quickActions.ts.
// Проверяем: группы рендерятся, скрытые пункты не рендерятся, клик шлёт
// plus_action и зовёт onAction, «Изменить» открывает настройку, пустое
// состояние (всё скрыто) показывает подсказку вместо групп.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlusMenuSheet } from './PlusMenuSheet';
import { QUICK_ACTION_IDS, buildPlusActions } from '../../utils/quickActions';
import {
  PLUS_ACTIONS_HIDDEN_KEY,
  serializeHiddenActions,
} from '../../utils/quickActionPrefs';

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
