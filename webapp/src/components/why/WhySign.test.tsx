// @vitest-environment jsdom
// «Зачем это всё»: полоски трекера — палитрой потребностей, как заполненный день на главной (лист объясняет
// главную), остальные знаки — по ключу, как везде.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NEED_DATA_PAPER } from '../art/paper';
import { SignArt } from '../art/SignArt';
import { WhySign } from './WhySign';
import { WhyThree } from './WhyThree';
import { WhyLegend } from './WhyLegend';

const fills = (root: Element | null) => [...(root?.querySelectorAll('rect') ?? [])].map((r) => r.getAttribute('fill'));

describe('WhySign', () => {
  it('полоски — пять цветов потребностей во всю высоту, ни одного пустого места', () => {
    const { container } = render(<WhySign sign="strokes" size="square" />);
    expect(fills(container)).toEqual([...NEED_DATA_PAPER]);
    expect(container.querySelectorAll('[data-rated="no"]')).toHaveLength(0);
    expect(new Set([...container.querySelectorAll('rect')].map((r) => r.getAttribute('height')))).toEqual(new Set(['84']));
  });
  it('другой знак — тот же рисунок, что SignArt по ключу', () => {
    const own = render(<WhySign sign="ribbon" size="row" />).container.innerHTML;
    expect(own).toBe(render(<SignArt sign="ribbon" size="row" />).container.innerHTML);
  });
  it('лист «Трекер» и строка «Полоска» легенды рисуют полоски палитрой потребностей', () => {
    const three = render(<WhyThree />).container;
    expect(fills(three.querySelector('li'))).toEqual([...NEED_DATA_PAPER]);
    const legend = render(<WhyLegend />).container;
    expect(fills(legend.querySelector('.cw-legend-row'))).toEqual([...NEED_DATA_PAPER]);
  });
});
