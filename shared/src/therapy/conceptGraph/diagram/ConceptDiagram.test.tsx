// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { buildConceptGraph } from '../conceptGraphModel';
import type { ConceptGraphSource } from '../conceptGraphTypes';
import { emptyModeLink } from '../modeLinks';
import { ConceptDiagram } from './ConceptDiagram';
import { FALLBACK_WIDTH } from './useContainerWidth';

const source: ConceptGraphSource = {
  modeIds: ['vulnerable_child', 'punitive_critic', 'detached_protector'],
  schemaIds: ['abandonment'],
  modeLinks: [
    {
      ...emptyModeLink('vulnerable_child'),
      schemaIds: ['abandonment'],
      needIds: ['attachment'],
    },
  ],
  currentProblems: 'выгорание',
};
const graph = buildConceptGraph(source, (ty) => ty);

const mount = (props: Partial<Parameters<typeof ConceptDiagram>[0]> = {}) =>
  render(
    <ConceptDiagram
      graph={graph}
      openModeId={null}
      onToggleMode={() => {}}
      onPickLane={() => {}}
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

  it('измеренная ширина контейнера перераскладывает диаграмму, изменение размера — тоже', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    let width = 358;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      () => width,
    );
    mount();
    expect(svg().getAttribute('width')).toBe('358');
    const narrowHeight = Number(svg().getAttribute('height'));

    width = 1000;
    act(() => observers.forEach((cb) => cb()));
    expect(svg().getAttribute('width')).toBe('1000');
    expect(Number(svg().getAttribute('height'))).toBeLessThan(narrowHeight);
  });
});

describe('ConceptDiagram: фигуры и линии', () => {
  it('подписи стрелок и заголовки зон нарисованы', () => {
    mount();
    for (const t of [
      'давит',
      'боль включает копинг',
      'За кулисами',
      'Копинги',
      'Цена',
    ]) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(
      document.querySelector(
        '[data-edge-label$="mode:punitive_critic>mode:vulnerable_child"]',
      ),
    ).toBeTruthy();
  });

  it('у каждой линии стрелка ссылается на существующий marker', () => {
    mount();
    const paths = document.querySelectorAll<SVGPathElement>('path[data-edge]');
    expect(paths.length).toBeGreaterThan(3);
    for (const p of paths) {
      const id = /url\(#(.+)\)/.exec(p.getAttribute('marker-end') ?? '')?.[1];
      expect(id, p.dataset.edge).toBeTruthy();
      expect(
        document.getElementById(id as string),
        p.dataset.edge,
      ).toBeTruthy();
    }
  });

  it('две диаграммы на странице не делят id стрелок', () => {
    mount();
    mount();
    const ids = Array.from(document.querySelectorAll('marker')).map(
      (m) => m.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('зона нажатия схемы и потребности не меньше 44, хотя сама фигура ниже', () => {
    mount();
    for (const name of [/Покинутость/, 'Привязанность']) {
      const btn = screen.getByRole('button', { name });
      expect(Number.parseFloat(btn.style.height)).toBeGreaterThanOrEqual(44);
    }
    expect(
      Number.parseFloat(
        screen.getByRole('button', { name: 'Уязвимый Ребёнок: связи' }).style
          .height,
      ),
    ).toBeGreaterThanOrEqual(44);
  });

  it('текстовые поля концептуализации не кнопки: нажимать там нечего', () => {
    mount();
    const problems = screen.getByText('выгорание').closest('[data-node]')!;
    expect(problems.tagName).toBe('DIV');
  });
});

describe('ConceptDiagram: нажатия', () => {
  it('режим зовёт onToggleMode с id, открытый режим помечен aria-expanded', () => {
    const onToggleMode = vi.fn();
    const { rerender } = mount({ onToggleMode });
    const btn = screen.getByRole('button', { name: 'Карающий Критик: связи' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(onToggleMode).toHaveBeenCalledWith('punitive_critic');
    rerender(
      <ConceptDiagram
        graph={graph}
        openModeId="punitive_critic"
        onToggleMode={onToggleMode}
        onPickLane={() => {}}
      />,
    );
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('заготовка зовёт onPickLane с клеткой, схема onToggleMode не зовёт', () => {
    const onPickLane = vi.fn();
    const onToggleMode = vi.fn();
    mount({ onPickLane, onToggleMode });
    fireEvent.click(screen.getByTitle(/Пусто\. Здорового Взрослого/));
    expect(onPickLane).toHaveBeenCalledWith('healthy');
    fireEvent.click(screen.getByRole('button', { name: /Покинутость/ }));
    expect(onToggleMode).not.toHaveBeenCalled();
    expect(onPickLane).toHaveBeenCalledTimes(1);
  });
});
