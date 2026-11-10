// @vitest-environment jsdom
// Колесо потребностей на холсте (владелец 2026-11-10: «как круг потребностей, где можно
// выставить процент и показать, насколько был заполнен»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, act } from '@testing-library/react';
import { installFlowTestPolyfills, renderWithFlow } from '../../test-support/renderWithFlow';
import { NodeActionsContext, type NodeActions } from '../modeMapActions';
import { NeedWheelNode } from './NeedWheelNode';
import { WHEEL_NEED_EVENT } from './needWheel';

const actions = (): NodeActions => ({ duplicate: vi.fn(), remove: vi.fn(), edit: vi.fn(), rename: vi.fn(), patchData: vi.fn() });
const data = {
  label: 'Базовые эмоциональные потребности',
  wheel: { period: 'now' as const, compare: true, ratings: { child: { attachment: 2 }, now: { attachment: 5, autonomy: 6, expression: 4, play: 3, limits: 7 } } },
};
function renderNode(d = data, a = actions(), selected = false) {
  const r = renderWithFlow(<NodeActionsContext.Provider value={a}><NeedWheelNode id="w" data={d} selected={selected} /></NodeActionsContext.Provider>);
  return { ...r, a };
}

beforeEach(() => { installFlowTestPolyfills(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('NeedWheelNode', () => {
  it('легенда — проценты выбранного периода; в центре период и средний процент', () => {
    const { container } = renderNode();
    expect(container.querySelector('[data-need="attachment"]')?.textContent).toContain('50%');
    expect(container.querySelector('[data-need="limits"]')?.textContent).toContain('70%');
    expect(container.textContent).toContain('сейчас');
    expect(container.textContent).toContain('50%');
  });

  it('контур детства поверх: слой детства на колесе и подпись под ним; на «Детстве» — нет', () => {
    const { container, unmount } = renderNode();
    expect(container.querySelector('[data-layer="childhood"]')).not.toBeNull();
    expect(container.textContent).toContain('контур — детство');
    unmount();
    const child = renderNode({ ...data, wheel: { ...data.wheel, period: 'child' } });
    expect(child.container.querySelector('[data-layer="childhood"]')).toBeNull();
    expect(child.container.querySelector('[data-need="attachment"]')?.textContent).toContain('20%');
  });

  it('неоценённые потребности — «—», а не ноль', () => {
    const { container } = renderNode({ label: 'К', wheel: { period: 'teen' } } as typeof data);
    expect(container.querySelector('[data-need="play"]')?.textContent).toContain('—');
  });

  it('у каждой потребности — ручка сектора для линий ✗/✓', () => {
    const { container } = renderNode();
    for (const id of ['attachment', 'autonomy', 'expression', 'play', 'limits']) {
      expect(container.querySelectorAll(`[data-handleid="need:${id}"]`)).toHaveLength(2);
    }
  });

  it('клик по сектору открывает колесо в панели и сообщает, какая потребность', () => {
    const { container, a } = renderNode();
    const heard = vi.fn();
    window.addEventListener(WHEEL_NEED_EVENT, heard);
    fireEvent.click(container.querySelectorAll('path[fill="transparent"]')[3]);
    act(() => { vi.advanceTimersByTime(60); });
    window.removeEventListener(WHEEL_NEED_EVENT, heard);
    expect(a.edit).toHaveBeenCalledWith('w');
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toBe('play');
  });
});
