// @vitest-environment jsdom
// Сцена входа (b26): контракт сцены и состав по строке PAPER_2026-11.md — лист персика, знак
// продукта на земле с тенью слоем, полоски, петля ленты, камешки.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { expectSceneContract } from './sceneContract.test-helpers';
import { SceneEntry } from './SceneEntry';

describe('SceneEntry', () => {
  it('контракт сцены: декор, тень слоем, без фильтров, токены, равные поля', () => {
    expectSceneContract(<SceneEntry />);
  });

  it('лист персика; знак продукта, три полоски, лента и три камешка — и в тени тоже', () => {
    const { container } = render(<SceneEntry />);
    const svg = container.querySelector('svg.scn') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--h')).toBe('45');
    const shade = container.querySelector('.scn-shade') as Element;
    const top = (sel: string) => [...container.querySelectorAll(sel)].filter((el) => !el.closest('.scn-shade'));
    expect(top('[data-brand-mark="scene"]')).toHaveLength(1);
    expect(top('[data-entry="stroke"]')).toHaveLength(3);
    expect(top('[data-entry="ribbon"]')).toHaveLength(1);
    expect(top('[data-entry="pebble"]')).toHaveLength(3);
    expect(shade.querySelector('[data-brand-mark="scene"]'), 'знак приподнят над листом').not.toBeNull();
  });
});
