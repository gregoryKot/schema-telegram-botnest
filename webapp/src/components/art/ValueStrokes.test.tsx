// @vitest-environment jsdom
// Полоски-оценки дня: цвет данных — только у оценённых; неоценённая — нейтральный атрибут PAPER.hollow и
// data-rated="no" (бледный тон с кромкой даёт правило .pp-strokes-values). Ревью g2 r5: сцена дня красила
// неоценённую «пеньком» цвета данных, и он читался очень низкой оценкой.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ValueStrokes } from './ValueStrokes';
import { NEED_DATA_PAPER, PAPER } from './paper';
import { CHECK_IN_GEOM, strokeLen } from './strokeLen';

const draw = (values: (number | null)[]) => {
  const { container } = render(<svg><ValueStrokes values={values} at="checkIn" /></svg>);
  return [...container.querySelectorAll('.pp-strokes-values > rect')];
};

describe('ValueStrokes', () => {
  it('у неоценённой — нейтральный пустой тон, у оценённой — цвет данных своей потребности', () => {
    const r = draw([null, 6, null, null, null]);
    expect(r.map((x) => x.getAttribute('fill'))).toEqual([PAPER.hollow, NEED_DATA_PAPER[1], PAPER.hollow, PAPER.hollow, PAPER.hollow]);
    expect(r.map((x) => x.getAttribute('data-rated'))).toEqual(['no', 'yes', 'no', 'no', 'no']);
    expect(r[0].getAttribute('color')).toBe(NEED_DATA_PAPER[0]); // бледный тон берёт оттенок своей потребности
    expect(Number(r[1].getAttribute('height'))).toBe(strokeLen(6, CHECK_IN_GEOM));
    expect(r.every((x) => Number(x.getAttribute('y')) + Number(x.getAttribute('height')) === CHECK_IN_GEOM.foot)).toBe(true);
    expect(r.every((x) => !x.hasAttribute('transform'))).toBe(true); // лист сцены — без наклона
  });

  it('знак Strokes: наклон вокруг низа своей полоски', () => {
    const { container } = render(<svg><ValueStrokes values={[3, null]} at="strokes" tilt={[-6, 3]} /></svg>);
    const r = [...container.querySelectorAll('.pp-strokes-values > rect')];
    expect(r.map((x) => x.getAttribute('transform'))).toEqual(['rotate(-6 16 92)', 'rotate(3 38 92)']);
  });

  it('пустое место красит одно правило .pp-strokes-values: бледный тон своей потребности с кромкой', () => {
    const css = readFileSync(join(__dirname, '../../styles/paper.css'), 'utf8');
    expect(css).toMatch(/\.pp-strokes-values > \[data-rated="no"\] \{ fill: color-mix\(in srgb, currentColor \d+%, var\(--bg\)\); stroke: var\(--strokes-edge\)/);
  });
});
