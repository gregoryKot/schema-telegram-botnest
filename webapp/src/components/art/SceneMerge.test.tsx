// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import SceneMerge from './SceneMerge';
import { expectSceneContract } from './sceneContract.test-helpers';

afterEach(cleanup);

describe('SceneMerge — два веера листов сходятся в одну стопку', () => {
  it('контракт сцены: декор, токены, тень сдвинутым слоем, равные поля', () => {
    expectSceneContract(<SceneMerge />);
  });

  it('два веера по три листа и стопка из трёх; лист неба по умолчанию', () => {
    const { container } = render(<SceneMerge />);
    const svg = container.querySelector('svg.scn') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--h')).toBe('240');
    // Верхний слой (прямые дети svg, не тень): веер слева, веер справа, стопка посередине.
    expect(svg.querySelectorAll(':scope > [data-fan="left"] > g')).toHaveLength(3);
    expect(svg.querySelectorAll(':scope > [data-fan="right"] > g')).toHaveLength(3);
    expect(svg.querySelectorAll(':scope > [data-stack]')).toHaveLength(3);
  });
});
