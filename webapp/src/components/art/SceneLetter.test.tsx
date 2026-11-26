// @vitest-environment jsdom
// Сцены партии b18 «письмо» и «Критик или забота?»: контракт сцены (декор, тень слоем, без фильтров,
// токены, равные поля); у письма строки — только написанные, пустое письмо — без строк; запечатанное —
// конверт с печатью ChildCare; у разбора фразы — два знака голосов на одной земле.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { expectEmptyScene, expectSceneContract } from './sceneContract.test-helpers';
import { SceneLetter } from './SceneLetter';
import { ScenePhrase } from './ScenePhrase';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

const lines = (n: number) => render(<SceneLetter lines={n} />).container.querySelectorAll('[data-line]').length;

describe('SceneLetter', () => {
  it('контракт сцены — лист и конверт', () => {
    expectSceneContract(<SceneLetter lines={3} />);
    expectSceneContract(<SceneLetter sealed />);
  });

  it('пустое письмо — чистый лист без строк', () => expectEmptyScene(<SceneLetter lines={0} />, '[data-line]'));

  it('строк столько, сколько написано, но не больше листа', () => {
    expect(lines(2)).toBe(2);
    expect(lines(99)).toBe(6); // строк на листе — шесть
    expect(lines(-3)).toBe(0);
  });

  it('бумага — письмо; запечатанное — без строк, печать ChildCare лежит на клапане', () => {
    const { container } = render(<SceneLetter sealed lines={5} />);
    expect((container.querySelector('svg.scn') as SVGSVGElement).style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.letter.hue));
    expect(container.querySelectorAll('[data-line]')).toHaveLength(0);
    expect(container.querySelectorAll('svg.scn svg.pp-art').length).toBeGreaterThan(0);
  });
});

describe('ScenePhrase', () => {
  it('контракт сцены', () => expectSceneContract(<ScenePhrase />));

  it('бумага — разбор фразы, два голоса (по знаку и его тени)', () => {
    const { container } = render(<ScenePhrase />);
    expect((container.querySelector('svg.scn') as SVGSVGElement).style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.phrase_check.hue));
    expect(container.querySelectorAll('svg.scn svg.pp-art')).toHaveLength(4);
  });
});
