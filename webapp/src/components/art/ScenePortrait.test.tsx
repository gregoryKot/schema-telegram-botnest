// @vitest-environment jsdom
// Сцена «Мой портрет» (b21): контракт сцены и слои только из данных.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { expectEmptyScene, expectSceneContract } from './sceneContract.test-helpers';
import { ScenePortrait } from './ScenePortrait';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { needDataColor } from '../needDataColor';

const needs = (counts: number[]) => NEED_ORDER.map((id, i) => ({ id, count: counts[i] ?? 0 }));
/** Слои в рисунке, без копии в тени. */
const layersOf = (c: Element, id: string) =>
  c.querySelectorAll(`svg.scn > [data-need="${id}"] [data-layer]`).length;

describe('ScenePortrait', () => {
  it('держит контракт сцены: декор, тень слоем, цвета токенами', () => {
    expectSceneContract(<ScenePortrait needs={needs([2, 0, 1, 3, 0])} />);
  });

  it('у каждой потребности столько слоёв, сколько её схем; больше пяти стопка не растёт', () => {
    const { container } = render(<ScenePortrait needs={needs([2, 0, 1, 9, 0])} />);
    expect(NEED_ORDER.map((id) => layersOf(container, id))).toEqual([2, 0, 1, 5, 0]);
  });

  it('полоска потребности — её цвет данных (палитра данных, не BAR_PAPER)', () => {
    const { container } = render(<ScenePortrait needs={needs([1, 1, 1, 1, 1])} />);
    for (const id of NEED_ORDER) {
      const strip = container.querySelector(`svg.scn > [data-need="${id}"] > rect:not([data-layer])`);
      expect(strip?.getAttribute('fill')).toBe(needDataColor(id));
    }
  });

  it('пустой портрет — пять полосок на земле без слоёв', () => {
    expectEmptyScene(<ScenePortrait needs={needs([])} />, '[data-layer]');
    const { container } = render(<ScenePortrait needs={needs([])} />);
    expect(container.querySelectorAll('svg.scn > [data-need]').length).toBe(5);
  });
});
