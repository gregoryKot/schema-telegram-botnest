// @vitest-environment jsdom
// QuickActionCustomizeSheet — generic лист «что показывать» (переиспользует
// CustomizeRow = ToggleRow + DragHandle, не проверяем их внутреннюю разметку
// — только текст строки, aria-label ручки и колбэки). Проверяем: toggle шлёт
// quick_action_toggle, «Готово» закрывает, ручка (клавиатура + жест) двигает
// порядок и шлёт quick_action_move только при успехе, диапазон группы
// (rangeMin/rangeMax) прижимает к границе, жест по ручке не переключает тумблер.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickActionCustomizeSheet } from './QuickActionCustomizeSheet';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const actions = [
  {
    id: 'tracker',
    label: 'Трекер потребностей',
    sub: 'sub-1',
    rangeMin: 0,
    rangeMax: 1,
  },
  {
    id: 'warm_words',
    label: 'Тёплые слова',
    sub: 'sub-2',
    rangeMin: 0,
    rangeMax: 1,
  },
];

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('QuickActionCustomizeSheet', () => {
  it('рендерит заголовок и все переданные действия', () => {
    render(
      <QuickActionCustomizeSheet
        title="Что показывать в «плюсе»"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onReorder={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Что показывать в «плюсе»')).toBeTruthy();
    expect(screen.getByText('Трекер потребностей')).toBeTruthy();
    expect(screen.getByText('Тёплые слова')).toBeTruthy();
  });

  it('клик по видимому пункту скрывает его: quick_action_toggle(hidden:true, surface)', () => {
    const onToggle = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={onToggle}
        onReorder={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Тёплые слова'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_toggle', {
      action: 'warm_words',
      hidden: true,
      surface: 'plus',
    });
    expect(onToggle).toHaveBeenCalledWith('warm_words', true);
  });

  it('«Готово» закрывает лист', () => {
    const onClose = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onReorder={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalled();
  });

  it('клавиша ArrowDown на ручке первой строки: onReorder(id, toIndex=1), при успехе шлёт quick_action_move', () => {
    const onReorder = vi.fn().mockReturnValue('down');
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onReorder={onReorder}
        onClose={vi.fn()}
      />,
    );
    const handle = screen.getByLabelText('Переставить: Трекер потребностей');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledWith('tracker', 1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'tracker',
      surface: 'plus',
      dir: 'down',
    });
  });

  it('onReorder вернул false (no-op) — quick_action_move не отправлен', () => {
    const onReorder = vi.fn().mockReturnValue(false);
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="tools"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onReorder={onReorder}
        onClose={vi.fn()}
      />,
    );
    const handle = screen.getByLabelText('Переставить: Трекер потребностей');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledWith('tracker', 1);
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'quick_action_move',
      expect.anything(),
    );
  });

  it('ArrowUp на границе диапазона строки (rangeMin=0) — onReorder не вызывается', () => {
    const onReorder = vi.fn().mockReturnValue('up');
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onReorder={onReorder}
        onClose={vi.fn()}
      />,
    );
    const handle = screen.getByLabelText('Переставить: Трекер потребностей');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('жест ручки (pointerdown→move→up) вниз через одну строку — один quick_action_move c dir="down"', () => {
    const onReorder = vi.fn().mockReturnValue('down');
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onReorder={onReorder}
        onClose={vi.fn()}
      />,
    );
    const handle = screen.getByLabelText('Переставить: Трекер потребностей');
    (
      handle as HTMLElement & { setPointerCapture: () => void }
    ).setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 60, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(handle, { clientY: 60, pointerId: 1 });
    expect(onReorder).toHaveBeenCalledWith('tracker', 1);
    expect(mockApi.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'tracker',
      surface: 'plus',
      dir: 'down',
    });
  });

  it('жест ручки — вернулся на исходное место перед отпусканием — событие не отправлено', () => {
    const onReorder = vi.fn().mockReturnValue('down');
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={vi.fn()}
        onReorder={onReorder}
        onClose={vi.fn()}
      />,
    );
    const handle = screen.getByLabelText('Переставить: Трекер потребностей');
    (
      handle as HTMLElement & { setPointerCapture: () => void }
    ).setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 60, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(handle, { clientY: 0, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(handle, { clientY: 0, pointerId: 1 });
    expect(onReorder).not.toHaveBeenCalled();
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('клавиша на ручке не переключает тумблер строки', () => {
    const onToggle = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={onToggle}
        onReorder={vi.fn().mockReturnValue('down')}
        onClose={vi.fn()}
      />,
    );
    const handle = screen.getByLabelText('Переставить: Трекер потребностей');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('касание/жест ручки (pointerdown→move→up) не переключает тумблер строки', () => {
    const onToggle = vi.fn();
    render(
      <QuickActionCustomizeSheet
        title="t"
        surface="plus"
        actions={actions}
        hidden={[]}
        onToggle={onToggle}
        onReorder={vi.fn().mockReturnValue('down')}
        onClose={vi.fn()}
      />,
    );
    const handle = screen.getByLabelText('Переставить: Трекер потребностей');
    (
      handle as HTMLElement & { setPointerCapture: () => void }
    ).setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 60, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(handle, { clientY: 60, pointerId: 1 });
    expect(onToggle).not.toHaveBeenCalled();
  });
});
