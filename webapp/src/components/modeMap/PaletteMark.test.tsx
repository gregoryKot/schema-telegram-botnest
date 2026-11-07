// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PaletteMark } from './PaletteMark';
import type { MarkKind } from './paletteModel';

const KINDS: MarkKind[] = ['mode', 'schema', 'trigger', 'behavior', 'origin', 'need', 'needs'];

describe('PaletteMark — маленькие знаки строк палитры', () => {
  it('у каждого вида свой рисунок, без обводки у режима и схемы', () => {
    const html = KINDS.map(kind => {
      const { container, unmount } = render(<PaletteMark kind={kind} color="var(--c-teal)" />);
      const svg = container.querySelector(`svg[data-mark="${kind}"]`)!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      const s = svg.innerHTML;
      unmount();
      return s;
    });
    expect(new Set(html).size).toBe(KINDS.length);
    expect(html[0]).not.toContain('stroke=');
    expect(html[1]).not.toContain('stroke=');
  });

  it('режим — один круг цвета фигуры; схема — два слоя того же оттенка', () => {
    const mode = render(<PaletteMark kind="mode" color="var(--c-rose)" />).container;
    expect(mode.querySelectorAll('circle')).toHaveLength(1);
    expect(mode.querySelector('circle')!.getAttribute('fill')).toBe('var(--c-rose)');
    const schema = render(<PaletteMark kind="schema" color="var(--accent-red)" />).container;
    const fills = [...schema.querySelectorAll('rect')].map(r => r.getAttribute('fill'));
    expect(fills).toHaveLength(2);
    expect(fills[0]).toBe('var(--accent-red)');
    expect(fills[1]).toContain('var(--accent-red)');
  });
});
