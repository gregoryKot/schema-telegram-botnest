// @vitest-environment jsdom
// Ревью r1, L1: полоса вкладок расширяется после эффекта смены вкладки (счётчики, шрифт) — на 390 последняя
// вкладка стояла обрезанной без маски. ResizeObserver на полосе и её детях снова ставит полосу к активной и
// пересчитывает маску. jsdom размеров не считает — задаём их свойствами и зовём колбэк наблюдателя руками.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useTabsBar } from './useTabsBar';

let fire: () => void = () => {};
const observed: Element[] = [];
class FakeRO {
  constructor(cb: () => void) { fire = cb; }
  observe(el: Element) { observed.push(el); }
  disconnect() {}
}

function Bar() {
  const { ref, onScroll, fadeClassName } = useTabsBar('c');
  return (
    <div ref={ref} onScroll={onScroll} data-testid="bar" role="tablist" className={`bar${fadeClassName}`}>
      <button role="tab" aria-selected="false">a</button><button role="tab" aria-selected="false">b</button><button role="tab" aria-selected="true">c</button>
    </div>
  );
}

function size(el: HTMLElement, props: Record<string, number>) {
  for (const [k, v] of Object.entries(props)) Object.defineProperty(el, k, { configurable: true, value: v });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); observed.length = 0; });

describe('useTabsBar: ширина содержимого выросла после эффекта', () => {
  it('полоса снова встаёт к активной (последней) и маска у конца снимается', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const { getByTestId, getAllByRole } = render(<Bar />);
    const bar = getByTestId('bar');
    expect(observed).toContain(bar);
    expect(observed.length).toBe(4); // полоса и три вкладки
    // Счётчики приехали: содержимое 770 при полосе 390, активная — последняя у правого края.
    size(bar, { clientWidth: 390, scrollWidth: 770 });
    size(getAllByRole('tab')[2], { offsetLeft: 650, offsetWidth: 120 });
    act(() => fire());
    expect(bar.scrollLeft).toBe(380);
    expect(bar.className).toContain('is-fade-start');
    expect(bar.className).not.toContain('is-fade-end');
  });

  it('без ResizeObserver хук не падает', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    expect(() => render(<Bar />)).not.toThrow();
  });
});
