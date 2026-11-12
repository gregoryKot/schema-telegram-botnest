// @vitest-environment jsdom
// Колесо потребностей на холсте: сектора по оценкам клиента из концептуализации, подписи с
// процентами у секторов (владелец 2026-11-12: «подписи не только в легенде, но и на колесе»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, act } from '@testing-library/react';
import { installFlowTestPolyfills, renderWithFlow } from '../../test-support/renderWithFlow';
import { NodeActionsContext, type NodeActions } from '../modeMapActions';
import { NeedWheelNode } from './NeedWheelNode';
import { WHEEL_NEED_EVENT } from './needWheel';
import { WheelContext, type WheelState } from './wheelContext';
import type { ConceptNeedLink } from '../../../../shared/src/therapy/conceptGraph/needLinks';

const actions = (): NodeActions => ({ duplicate: vi.fn(), remove: vi.fn(), edit: vi.fn(), rename: vi.fn(), patchData: vi.fn() });
const LINKS: ConceptNeedLink[] = [
  { needId: 'attachment', ratings: { child: 2, now: 5 }, notes: {} },
  { needId: 'autonomy', ratings: { now: 6 }, notes: {} },
  { needId: 'expression', ratings: { now: 4 }, notes: {} },
  { needId: 'play', ratings: { now: 3 }, notes: {} },
  { needId: 'limits', ratings: { now: 7 }, notes: {} },
];
const wheelState = (over: Partial<WheelState> = {}): WheelState => ({ links: LINKS, failed: false, status: 'idle', saved: true, save: vi.fn(), retry: vi.fn(), ...over });
type Data = Parameters<typeof NeedWheelNode>[0]['data'];
const data: Data = { label: 'Базовые эмоциональные потребности', wheel: { period: 'now', compare: true } };

function renderNode(d: Data = data, wheel: WheelState | null = wheelState(), a = actions()) {
  const r = renderWithFlow(
    <WheelContext.Provider value={wheel}><NodeActionsContext.Provider value={a}><NeedWheelNode id="w" data={d} /></NodeActionsContext.Provider></WheelContext.Provider>,
  );
  return { ...r, a, wheel };
}
const label = (c: HTMLElement, id: string) => c.querySelector(`button[data-need="${id}"]`)!;

beforeEach(() => { installFlowTestPolyfills(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('NeedWheelNode', () => {
  it('у каждого сектора — подпись с названием и процентом выбранного периода; в центре период и средний', () => {
    const { container } = renderNode();
    expect(label(container, 'attachment').textContent).toContain('Привязанность');
    expect(label(container, 'attachment').textContent).toContain('50%');
    expect(label(container, 'limits').textContent).toContain('70%');
    expect(label(container, 'attachment').className).toContain('is-top');
    expect(label(container, 'autonomy').className).toContain('is-right');
    expect(label(container, 'play').className).toContain('is-left');
    expect(container.textContent).toContain('сейчас');
  });

  it('контур детства поверх: слой детства на колесе и подпись; на «Детстве» — нет, проценты — детские', () => {
    const { container, unmount } = renderNode();
    expect(container.querySelector('[data-layer="childhood"]')).not.toBeNull();
    expect(container.textContent).toContain('контур — детство');
    unmount();
    const child = renderNode({ ...data, wheel: { period: 'child', compare: true } });
    expect(child.container.querySelector('[data-layer="childhood"]')).toBeNull();
    expect(label(child.container, 'attachment').textContent).toContain('20%');
    expect(label(child.container, 'play').textContent).toContain('—');
  });

  it('без колеса клиента (чужой просмотр, загрузка) — названия есть, процентов нет: «—», не ноль', () => {
    const { container } = renderNode(data, null);
    expect(label(container, 'play').textContent).toContain('Спонтанность');
    expect(label(container, 'play').textContent).toContain('—');
  });

  it('концептуализация не загрузилась — так и сказано на колесе', () => {
    const { container } = renderNode(data, wheelState({ links: null, failed: true }));
    expect(container.textContent).toContain('Концептуализация не загрузилась');
  });

  it('у каждой потребности — ручка сектора для линий ✗/✓', () => {
    const { container } = renderNode();
    for (const id of ['attachment', 'autonomy', 'expression', 'play', 'limits']) {
      expect(container.querySelectorAll(`[data-handleid="need:${id}"]`)).toHaveLength(2);
    }
  });

  it('клик по сектору или по подписи открывает колесо в панели и сообщает, какая потребность', () => {
    const { container, a } = renderNode();
    const heard = vi.fn();
    window.addEventListener(WHEEL_NEED_EVENT, heard);
    fireEvent.click(container.querySelectorAll('path[fill="transparent"]')[3]);
    fireEvent.click(label(container, 'limits'));
    act(() => { vi.advanceTimersByTime(60); });
    window.removeEventListener(WHEEL_NEED_EVENT, heard);
    expect(a.edit).toHaveBeenCalledWith('w');
    expect(heard.mock.calls.map((c) => (c[0] as CustomEvent).detail)).toEqual(['play', 'limits']);
  });
});

// Карты #1065 держали оценки и тексты в узле карты — теперь они в концептуализации клиента.
describe('NeedWheelNode — перенос оценок из карты в концептуализацию', () => {
  const legacy: Data = { label: 'К', wheel: { period: 'now', ratings: { now: { play: 9 } }, notes: { now: { play: 'Мало игры' } } } };

  it('значения узла уходят в колесо клиента (пустое место), карта пока их держит', () => {
    const { a, wheel } = renderNode(legacy, wheelState({ links: [] }));
    // { auto: true } — перенос без действия человека: событие concept_needs_rated за него не уходит
    expect(wheel!.save).toHaveBeenCalledWith([{ needId: 'play', ratings: { now: 9 }, notes: { now: 'Мало игры' } }], { auto: true });
    expect(a.patchData).not.toHaveBeenCalled();
  });

  it('сервер подтвердил (колесо уже содержит значения) — из карты они убираются, вид остаётся', () => {
    const { a, wheel } = renderNode(legacy, wheelState({ links: [{ needId: 'play', ratings: { now: 9 }, notes: { now: 'Мало игры' } }] }));
    expect(wheel!.save).not.toHaveBeenCalled();
    expect(a.patchData).toHaveBeenCalledWith('w', { wheel: { period: 'now' } });
  });

  it('пока запись идёт или упала, карта значения не теряет', () => {
    const confirmed = [{ needId: 'play', ratings: { now: 9 }, notes: { now: 'Мало игры' } }];
    for (const status of ['saving', 'failed'] as const) {
      const { a, unmount } = renderNode(legacy, wheelState({ links: confirmed, status }));
      expect(a.patchData).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('значения уже на экране, но сервер их ещё не подтвердил (черновик) — карта их держит', () => {
    const { a } = renderNode(legacy, wheelState({ links: [{ needId: 'play', ratings: { now: 9 }, notes: { now: 'Мало игры' } }], saved: false }));
    expect(a.patchData).not.toHaveBeenCalled();
  });

  it('концептуализация ещё не пришла — ничего не трогаем', () => {
    const { a, wheel } = renderNode(legacy, wheelState({ links: null }));
    expect(wheel!.save).not.toHaveBeenCalled();
    expect(a.patchData).not.toHaveBeenCalled();
  });
});
