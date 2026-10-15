// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { buildConceptGraph } from '../conceptGraphModel';
import { RICH, source } from './diagram.test-helpers';
import { ConceptDiagram } from './ConceptDiagram';
import { FALLBACK_WIDTH } from './useContainerWidth';

const graph = buildConceptGraph(source(RICH), (ty) => ty);

const mount = (props: Partial<Parameters<typeof ConceptDiagram>[0]> = {}) =>
  render(
    <ConceptDiagram
      graph={graph}
      openId={null}
      addOpen={null}
      panel={null}
      onOpenMode={() => {}}
      onOpenSchema={() => {}}
      onAdd={() => {}}
      {...props}
    />,
  );

const svg = () => document.querySelector('[data-concept-diagram] > svg')!;

type RoCallback = () => void;
const observers: RoCallback[] = [];
class FakeResizeObserver {
  constructor(cb: RoCallback) {
    observers.push(cb);
  }
  observe() {}
  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  observers.length = 0;
});

describe('ConceptDiagram: ширина', () => {
  it('без замера (jsdom: ширина нулевая) раскладка берёт запасную ширину', () => {
    mount();
    expect(svg().getAttribute('width')).toBe(String(FALLBACK_WIDTH));
    const box = document.querySelector<HTMLElement>('[data-concept-diagram]')!;
    expect(box.style.height).toBe(`${svg().getAttribute('height')}px`);
  });

  it('измеренная ширина перераскладывает диаграмму, изменение размера — тоже: узкая выше широкой', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    let width = 358;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      () => width,
    );
    mount();
    expect(svg().getAttribute('width')).toBe('358');
    const narrowHeight = Number(svg().getAttribute('height'));
    width = 1200;
    act(() => observers.forEach((cb) => cb()));
    expect(svg().getAttribute('width')).toBe('1200');
    expect(Number(svg().getAttribute('height'))).toBeLessThan(narrowHeight);
  });
});

describe('ConceptDiagram: нажатия', () => {
  it('режим, схема и овал опыта зовут свои колбэки, заготовка — выбор своей секции', () => {
    const onOpenMode = vi.fn();
    const onOpenSchema = vi.fn();
    const onAdd = vi.fn();
    const { unmount } = mount({ onOpenMode, onOpenSchema, onAdd });
    fireEvent.click(
      screen.getByRole('button', { name: 'Внушающий Вину Критик: связи' }),
    );
    expect(onOpenMode).toHaveBeenCalledWith('guilt_critic');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Схема Эмоциональная депривация: убеждение и опыт',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Как нарушалась потребность: схема Эмоциональная скованность',
      }),
    );
    expect(onOpenSchema.mock.calls).toEqual([
      ['emotional_deprivation'],
      ['emotional_inhibition'],
    ]);
    expect(onAdd).not.toHaveBeenCalled();
    unmount();

    const empty = buildConceptGraph(source(), (ty) => ty);
    mount({ graph: empty, onAdd });
    fireEvent.click(screen.getByRole('button', { name: 'Схема не отмечена' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Здоровый Взрослый не отмечен' }),
    );
    expect(onAdd.mock.calls).toEqual([['schemas'], ['healthy']]);
  });

  it('открытая фигура помечена aria-expanded, овал опыта открытой схемы — тоже', () => {
    mount({ openId: 'schema:emotional_deprivation' });
    expect(
      screen
        .getByRole('button', {
          name: 'Схема Эмоциональная депривация: убеждение и опыт',
        })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', {
          name: 'Как нарушалась потребность: схема Эмоциональная депривация',
        })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', {
          name: 'Схема Эмоциональная скованность: убеждение и опыт',
        })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('тап по потребности подсвечивает линии и не зовёт колбэки', () => {
    const onOpenMode = vi.fn();
    const onOpenSchema = vi.fn();
    const onAdd = vi.fn();
    mount({ onOpenMode, onOpenSchema, onAdd });
    fireEvent.click(screen.getByRole('button', { name: 'Привязанность' }));
    expect(onOpenMode).not.toHaveBeenCalled();
    expect(onOpenSchema).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'Привязанность' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('ConceptDiagram: выбор у заголовка секции', () => {
  it('панель рисуется только у открытой секции и под её заголовком', () => {
    mount({ addOpen: 'schemas', panel: <div>выбор схем</div> });
    const header = document.querySelector<HTMLElement>(
      '[data-section="schemas"]',
    )!;
    const panel = screen.getByText('выбор схем').parentElement!;
    expect(panel.hasAttribute('data-export-skip')).toBe(true);
    expect(parseFloat(panel.style.top)).toBeGreaterThan(
      parseFloat(header.style.top),
    );
    expect(parseFloat(panel.style.left)).toBeGreaterThanOrEqual(
      parseFloat(header.style.left) - 1,
    );
    expect(screen.queryByText('выбор режимов')).toBeNull();
  });

  it('у правого края панель не уезжает за контейнер', () => {
    mount({ addOpen: 'healthy', panel: <div>выбор</div> });
    const panel = screen.getByText('выбор').parentElement!;
    expect(
      parseFloat(panel.style.left) + parseFloat(panel.style.width),
    ).toBeLessThanOrEqual(FALLBACK_WIDTH);
  });

  it('узкий вид: панель на всю ширину с полем', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(358);
    mount({ addOpen: 'modes', panel: <div>выбор</div> });
    const panel = screen.getByText('выбор').parentElement!;
    expect(panel.style.left).toBe('8px');
    expect(panel.style.width).toBe('342px');
  });
});
