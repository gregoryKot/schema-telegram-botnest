// @vitest-environment jsdom
// Сцены лендинга и мини-тестов (LandingScenes*.tsx, HeroCollage.tsx, sceneKit.tsx):
// декор языка знаков. Сверяем то, что ломается молча: сцена скрыта от чтения с
// экрана; оттенок бумаги уходит в --h, клочок второй бумаги рисуется только с `patch`;
// «тень» — копия фигур в слое .scn-shade, а не фильтр; цвета — только токены.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SceneChildhood, SceneTrigger, SceneNotice, SceneTogether } from './LandingScenes';
import { SceneCheckIn, SceneDiary, SceneQuiz } from './LandingScenesMore';
import { HeroCollage } from './HeroCollage';
import { SceneSvg, Lift } from './sceneKit';
import { INK } from './scenePaper';

afterEach(() => cleanup());

const ALL = { SceneChildhood, SceneTrigger, SceneNotice, SceneTogether, SceneCheckIn, SceneDiary, SceneQuiz, HeroCollage };

describe('сцены: декор языка знаков', () => {
  it.each(Object.entries(ALL))('%s — скрыта от чтения с экрана, с подложкой и слоем тени, без фильтров', (_, Scene) => {
    const { container } = render(<Scene />);
    const svg = container.querySelector('svg.scn') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.style.getPropertyValue('--h')).not.toBe('');
    const shade = svg.querySelector('.scn-shade');
    expect(shade?.children.length).toBeGreaterThan(0);
    expect(svg.querySelector('filter, [filter]')).toBeNull();
  });

  it('SceneSvg: клочок второй бумаги только с patch, пятно можно снять (сцена на цветной карточке)', () => {
    const { container, rerender } = render(<SceneSvg hue={45}><circle r="1" /></SceneSvg>);
    expect(container.querySelector('.scn-patch')).toBeNull();
    expect(container.querySelector('.scn-blob')).not.toBeNull();
    rerender(<SceneSvg hue={45} patch={135} blob={null}><circle r="1" /></SceneSvg>);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.querySelector('.scn-patch')).not.toBeNull();
    expect(svg.querySelector('.scn-blob')).toBeNull();
    expect(svg.style.getPropertyValue('--h2')).toBe('135');
  });

  it('Lift: тень — та же фигура со сдвигом под ней', () => {
    const { container } = render(<svg><Lift by={4}><rect className="x" /></Lift></svg>);
    const rects = container.querySelectorAll('rect.x');
    expect(rects).toHaveLength(2);
    expect(rects[0].parentElement?.getAttribute('class')).toBe('scn-shade');
    expect(rects[0].parentElement?.getAttribute('transform')).toBe('translate(4 5)');
  });

  it('палитра сцен — только токены (var / color-mix от var), без литералов', () => {
    for (const [name, value] of Object.entries(INK)) {
      expect(value, name).toMatch(/var\(--[a-z-]+\)/);
      expect(value, name).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });
});
