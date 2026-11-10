// @vitest-environment jsdom
// Сцена «Мне плохо» (b12): контракт сцены — декор, тень слоем, без фильтров, токены, равные поля;
// бумага по умолчанию — бережная роза ENTITY_LOOK.sos; сердце — глина, как знак Heart.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { expectSceneContract } from './sceneContract.test-helpers';
import { SceneSos } from './SceneSos';
import { INK } from './scenePaper';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

describe('SceneSos', () => {
  it('контракт сцены', () => expectSceneContract(<SceneSos />));

  it('бумага — «Мне плохо», сердце глины над землёй между двумя дугами', () => {
    const { container } = render(<SceneSos />);
    const svg = container.querySelector('svg.scn') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.sos.hue));
    const top = [...svg.querySelectorAll('path')].filter((p) => !p.closest('.scn-shade'));
    expect(top.filter((p) => p.getAttribute('fill') === INK.clay)).toHaveLength(1);
    expect(top.filter((p) => p.getAttribute('d')?.includes(' A'))).toHaveLength(2);
  });
});
