// @vitest-environment jsdom
// Сцены лендинга и мини-тестов (LandingScenes*.tsx, HeroCollage.tsx, SceneParts.tsx,
// sceneKit.tsx): декор языка знаков. Сверяем то, что ломается молча: сцена скрыта от
// чтения с экрана; оттенок бумаги уходит в --h; подложка — вырезанный лист в два слоя,
// а не пятно; квадратик второй бумаги рисуется только с `patch`; «тень» — копия фигур в
// слое .scn-shade, а не фильтр; знак кабинета не перерисован, а взят как есть; цвета —
// только токены.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { SceneChildhood, SceneTrigger, SceneNotice } from './LandingScenes';
import { SceneCheckIn, SceneQuiz, SceneCover, SceneCoverMini, SceneHomeScreen } from './LandingScenesMore';
import { SignScene, FinalCorners } from './SceneParts';
import { HeroCollage } from './HeroCollage';
import { Talk, Cluster } from './PaperArtSigns';
import { SceneSvg, Lift } from './sceneKit';
import { INK } from './scenePaper';

afterEach(() => cleanup());

const ALL = { SceneChildhood, SceneTrigger, SceneNotice, SceneCheckIn, SceneHomeScreen, SceneQuiz, SceneCover, FinalCorners, HeroCollage };

describe('сцены: декор языка знаков', () => {
  it.each(Object.entries(ALL))('%s — скрыта от чтения с экрана, со слоем тени, без фильтров и пятен', (_, Scene) => {
    const { container } = render(<Scene />);
    const svgs = [...container.querySelectorAll('svg.scn')] as SVGElement[];
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.style.getPropertyValue('--h')).not.toBe('');
      expect(svg.querySelector('filter, [filter]')).toBeNull();
    }
    expect(container.querySelector('.scn-shade')?.children.length).toBeGreaterThan(0);
    expect(container.querySelector('.scn-blob')).toBeNull();
  });

  it('SceneSvg: лист-подложка в два слоя; квадратик второй бумаги только с patch; лист можно снять', () => {
    const { container, rerender } = render(<SceneSvg hue={45}><circle r="1" /></SceneSvg>);
    expect(container.querySelector('.scn-patch')).toBeNull();
    expect(container.querySelector('.scn-sheet')).not.toBeNull();
    expect(container.querySelector('.scn-sheet-under')).not.toBeNull();
    rerender(<SceneSvg hue={45} patch={135} sheet={null}><circle r="1" /></SceneSvg>);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.querySelector('.scn-patch')).not.toBeNull();
    expect(svg.querySelector('.scn-sheet')).toBeNull();
    expect(svg.style.getPropertyValue('--h2')).toBe('135');
  });

  it('SceneSvg: лист с нижним слоем лежит внутри холста с равными полями слева и справа', () => {
    for (const sheet of ['a', 'b', 'c'] as const) {
      const { container } = render(<SceneSvg hue={45} sheet={sheet}><circle r="1" /></SceneSvg>);
      const top = container.querySelector('.scn-sheet') as SVGRectElement;
      const under = container.querySelector('.scn-sheet-under') as SVGRectElement;
      const left = Number(top.getAttribute('x'));
      const right = 320 - Number(under.getAttribute('x')) - Number(under.getAttribute('width'));
      expect(left, sheet).toBe(right);
      cleanup();
    }
  });

  it('SceneChildhood: из пяти полосок колеса одна короче и бледнее и лежит без тени', () => {
    const { container } = render(<SceneChildhood />);
    const pale = [...container.querySelectorAll('rect[fill-opacity]')];
    expect(pale).toHaveLength(1);
    expect(pale[0].closest('.scn-shade')).toBeNull();
    const full = [...container.querySelectorAll('rect')].filter((r) => !r.closest('.scn-shade') && r.getAttribute('height') === '72');
    expect(full).toHaveLength(4);
    expect(Number(pale[0].getAttribute('height'))).toBeLessThan(72);
  });

  it('SceneTrigger: лента полтора витка — две лицевые половины поверх полоски, одна изнанка за ней; концы срезаны прямо', () => {
    const { container } = render(<SceneTrigger />);
    const paths = [...container.querySelectorAll('path')].filter((p) => !p.closest('.scn-shade'));
    const clay = paths.filter((p) => p.getAttribute('stroke') === INK.clay);
    const front = clay.filter((p) => p.getAttribute('stroke-linecap') === 'round');
    const cuts = clay.filter((p) => p.getAttribute('stroke-linecap') === 'butt');
    const back = paths.filter((p) => p.getAttribute('stroke') === INK.clayBack);
    expect(front).toHaveLength(2);
    expect(back).toHaveLength(1);
    // два свободных конца — прямой срез поверх скругления, без завитка-«головы»
    expect(cuts).toHaveLength(2);
    expect(cuts.every((p) => /^M[\d. ]+L[\d. ]+$/.test(p.getAttribute('d')!))).toBe(true);
    // изнанка — за полоской, лицо — поверх: порядок в слое
    const pole = [...container.querySelectorAll('rect')].find((r) => !r.closest('.scn-shade') && r.getAttribute('fill') === INK.moss)!;
    expect(back[0].compareDocumentPosition(pole) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pole.compareDocumentPosition(front[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('SceneNotice: лист и квадратик берут переданные оттенки (результат мини-теста — не тон в тон панели)', () => {
    const { container } = render(<SceneNotice hue={70} patch={135} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.style.getPropertyValue('--h')).toBe('70');
    expect(svg.style.getPropertyValue('--h2')).toBe('135');
  });

  it('SceneQuiz: веер на листе оттенка теста, задние карточки не в тон листу; сверху вопрос и плашки ответов или место под знак', () => {
    const look = (hue: number, sign = false) => {
      const { container } = render(<SceneQuiz hue={hue} sign={sign} />);
      const svg = container.querySelector('svg') as SVGElement;
      const out = {
        hue: svg.style.getPropertyValue('--h'),
        sheet: svg.querySelector('.scn-sheet') !== null,
        backs: [...svg.querySelectorAll(':scope > rect[fill]')].map((r) => r.getAttribute('fill')),
        pebbles: [...svg.querySelectorAll('ellipse')].length,
        answers: [...svg.querySelectorAll('rect[height="20"]')].filter((r) => !r.closest('.scn-shade')).length,
      };
      cleanup();
      return out;
    };
    expect(look(135)).toMatchObject({ hue: '135', sheet: true, pebbles: 0, answers: 3 });
    expect(look(135).backs).toEqual([INK.sky, INK.amberSoft]);
    expect(look(240, true)).toMatchObject({ answers: 0 });
    // небесный лист — задняя карточка не небо; соломенный — не солома
    expect(look(240).backs).not.toContain(INK.sky);
    expect(look(195).backs).not.toContain(INK.sky);
    expect(look(70).backs).not.toContain(INK.amberSoft);
  });

  it('SceneCover: соседние обложки — разный набор листов, по кругу', () => {
    const fills = (tone: number) => {
      const { container } = render(<SceneCover tone={tone} />);
      const set = [...container.querySelectorAll('svg > rect')].map((r) => r.getAttribute('fill')).join('|');
      cleanup();
      return set;
    };
    const sets = [0, 1, 2].map(fills);
    expect(new Set(sets).size).toBe(3);
    expect(fills(3)).toBe(sets[0]);
  });

  it('SignScene: знак кабинета дважды — нижняя копия под тень, верхняя как есть', () => {
    const { container } = render(<SignScene Art={Talk} />);
    const box = container.querySelector('.scn-sign') as HTMLElement;
    expect(box.getAttribute('aria-hidden')).toBe('true');
    const signs = box.querySelectorAll(':scope > svg.pp-art');
    expect(signs).toHaveLength(2);
    expect(signs[0].innerHTML).toBe(signs[1].innerHTML);
  });

  // Круг Cluster полупрозрачен (в кабинете он ложится на бумагу); над тенью-вырезкой он её
  // просвечивал и двоился серпом. CSS в jsdom не исполняется — пинаем правило исходника
  // (приём styles/safeTop.test.ts) и то, что без него знак правда полупрозрачен.
  it('SignScene: верхний слой непрозрачен — полупрозрачная заливка знака не просвечивает тень', () => {
    const { container } = render(<SignScene Art={Cluster} />);
    expect(container.querySelector('.scn-sign > svg:last-child [fill-opacity]')).not.toBeNull();
    const css = readFileSync(join(__dirname, '../../styles/paper-scenes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.scn-sign > \.pp-art:last-child \[fill-opacity\]\s*\{\s*fill-opacity:\s*1;?\s*\}/);
  });

  it('сцены без листа обрезаны по фигурам (box), с листом — холст 320×260; мини-обложка — та же обложка', () => {
    const vb = (el: Element | null) => el?.getAttribute('viewBox');
    const { container: a } = render(<SceneCheckIn />);
    expect(vb(a.querySelector('svg.scn'))).not.toBe('0 0 320 260');
    const { container: b } = render(<SceneCover />);
    expect(vb(b.querySelector('svg.scn'))).toBe('0 0 320 260');
    const { container: c } = render(<SceneCoverMini />);
    expect(vb(c.querySelector('svg.scn'))).not.toBe('0 0 320 260');
    expect(c.querySelector('svg.scn')?.innerHTML).toBe(b.querySelector('svg.scn')?.innerHTML);
    // окно игнорируется, если у сцены есть лист: лист рассчитан на полный холст
    const { container: d } = render(<SceneSvg hue={45} box="0 0 10 10"><circle r="1" /></SceneSvg>);
    expect(vb(d.querySelector('svg.scn'))).toBe('0 0 320 260');
  });

  it('HeroCollage: широкий и узкий холст, на узком всё в ширине контента (viewBox 358)', () => {
    const { container } = render(<HeroCollage />);
    expect(container.querySelector('.pl2-hero-collage--wide')).not.toBeNull();
    const narrow = container.querySelector('.pl2-hero-collage--narrow') as SVGElement;
    expect(narrow.getAttribute('viewBox')).toBe('0 0 358 520');
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
