// @vitest-environment jsdom
// Сцена пустого кабинета (b29): контракт сцены; бумага — небо терапевта (ENTITY_LOOK.therapist);
// веер из трёх карточек, круг глины «вместо фото» — только на верхней; Talk — один, перед веером.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { expectSceneContract } from './sceneContract.test-helpers';
import { SceneCabinet } from './SceneCabinet';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

describe('SceneCabinet', () => {
  it('контракт сцены', () => expectSceneContract(<SceneCabinet />));

  it('лист неба, веер из трёх карточек, фото только на верхней', () => {
    const { container } = render(<SceneCabinet />);
    const svg = container.querySelector('svg.scn') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.therapist.hue));
    const cards = [...svg.querySelectorAll(':scope > [data-card]')];
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.querySelectorAll('[data-photo]').length)).toEqual([0, 0, 1]);
  });
});
