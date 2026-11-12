// @vitest-environment jsdom
// Сцена «Безопасное место» (b18): контракт сцены; пусто — пустая рамка без своей части и элементов
// чувств; каждый элемент — только у описанного чувства; чувства сцены — те же и в том же порядке, что
// поля формы (SENSES, одна таблица); метка у поля — цветом, пока поле пусто — пустым тоном.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { expectEmptyScene, expectSceneContract } from './sceneContract.test-helpers';
import { HavenSenseMark, SceneHaven } from './SceneHaven';
import { PAPER } from './paper';
import { SENSES } from '../exercises/safePlaceText';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

const top = (c: HTMLElement, sel: string) => [...c.querySelectorAll(sel)].filter((el) => !el.closest('.scn-shade'));

describe('SceneHaven', () => {
  it('контракт сцены', () => expectSceneContract(<SceneHaven place senses={{ see: true, hear: true, feel: true, smell: true }} />));

  it('пусто — пустая рамка: ни своей части, ни элементов чувств', () =>
    expectEmptyScene(<SceneHaven place={false} senses={{}} />, '[data-sense], [data-place]'));

  it('элемент проявляется только у описанного чувства, круг — когда место названо', () => {
    const { container } = render(<SceneHaven place senses={{ hear: true, smell: true }} />);
    expect(top(container, '[data-sense]').map((g) => g.getAttribute('data-sense'))).toEqual(['hear', 'smell']);
    expect(top(container, '[data-place]')).toHaveLength(1);
    expect((container.querySelector('svg.scn') as SVGSVGElement).style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.safe_place.hue));
  });

  it('у каждого поля формы есть свой элемент сцены', () => {
    const all = Object.fromEntries(SENSES.map((s) => [s.k, true]));
    const { container } = render(<SceneHaven place={false} senses={all} />);
    expect(top(container, '[data-sense]').map((g) => g.getAttribute('data-sense'))).toEqual(SENSES.map((s) => s.k));
  });

  it('метка чувства: пустое поле — пустой тон, заполненное — цвет элемента', () => {
    const off = render(<HavenSenseMark sense="see" on={false} />).container;
    expect(off.querySelector('path')?.getAttribute('fill')).toBe(PAPER.hollow);
    const on = render(<HavenSenseMark sense="see" on />).container;
    expect(on.querySelector('path')?.getAttribute('fill')).toBe(PAPER.moss);
    expect(on.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
