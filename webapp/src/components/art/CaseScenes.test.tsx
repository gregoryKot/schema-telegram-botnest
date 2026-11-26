// @vitest-environment jsdom
// Сцены разбора (b09): итог «Похоже на режим» и «Карта себя» — контракт сцены и «только реальные данные».
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { expectEmptyScene, expectSceneContract } from './sceneContract.test-helpers';
import { SceneCaseFound } from './SceneCaseFound';
import { SceneStage } from './SceneStage';
import type { StageModel, StagePart } from '../selfMap/selfMapStage';

const part = (modeId: string, over: Partial<StagePart> = {}): StagePart => ({ modeId, r: 20, ink: 'slate', dormant: false, ...over });
const EMPTY: StageModel = { holding: [], stage: [], backstage: [] };
const FULL: StageModel = {
  holding: [part('healthy_adult', { ink: 'moss' })],
  stage: [part('punitive_critic', { ink: 'plum', r: 28 }), part('detached_protector'), part('compliant_surrenderer', { dormant: true })],
  backstage: [part('vulnerable_child', { ink: 'clay' })],
};

describe('SceneCaseFound', () => {
  it('держит контракт сцены: декор, тень слоем, цвета токенами', () => {
    expectSceneContract(<SceneCaseFound sign="shelter" hue={240} />);
  });
  it('знак группы режима — тот же мотив по ключу внутри сцены, лента — рядом', () => {
    const { container } = render(<SceneCaseFound sign="looming" hue={310} />);
    expect(container.querySelector('svg.scn')?.getAttribute('style')).toContain('--h: 310');
    expect(container.querySelectorAll('[data-ribbon]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('svg.scn svg.pp-art').length).toBeGreaterThan(0);
  });
});

describe('SceneStage', () => {
  it('держит контракт сцены', () => {
    expectSceneContract(<SceneStage model={FULL} />);
  });
  it('пустая карта — без кругов частей, одно место-ожидание', () => {
    expectEmptyScene(<SceneStage model={EMPTY} />, '[data-part]');
    const { container } = render(<SceneStage model={EMPTY} />);
    expect(container.querySelectorAll('[data-hollow]')).toHaveLength(1);
  });
  it('круги — ровно по меткам: на сцене, за кулисами, сверху; дуга мха — только когда кто-то держит', () => {
    const { container } = render(<SceneStage model={FULL} />);
    const lit = (zone: string) => new Set([...container.querySelectorAll(`[data-part="${zone}"]`)].map((c) => c.getAttribute('data-mode')));
    expect(lit('stage')).toEqual(new Set(['punitive_critic', 'detached_protector', 'compliant_surrenderer']));
    expect(lit('backstage')).toEqual(new Set(['vulnerable_child']));
    expect(lit('holding')).toEqual(new Set(['healthy_adult']));
    expect(container.querySelector('[data-hollow]')).toBeNull();
    const noHold = render(<SceneStage model={{ ...FULL, holding: [] }} />).container;
    expect(noHold.querySelector('[data-part="holding"]')).toBeNull();
    expect(noHold.querySelector('path[stroke="var(--c-moss)"]')).toBeNull();
  });
  it('затихшая часть гаснет и не отбрасывает тени', () => {
    const { container } = render(<SceneStage model={FULL} />);
    const shade = container.querySelector('.scn-shade');
    expect(shade?.querySelector('[data-mode="compliant_surrenderer"]')).toBeNull();
    expect(shade?.querySelector('[data-mode="punitive_critic"]')).not.toBeNull();
  });
});
