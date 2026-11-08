// @vitest-environment jsdom
// Сцены приложения (AppScenes*.tsx) и варианты сцен лендинга для кабинета (SceneChildhood
// values, SceneCheckIn days, SceneQuizMini, HeroCollage compact): контракт сцены
// (sceneContract.test-helpers.ts), данные — только реальные, пусто — без выдуманных фигур,
// значения по умолчанию — вид лендинга.
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { expectSceneContract, expectEmptyScene } from './sceneContract.test-helpers';
import { Sprout, SceneBreath, ScenePebbleLaid, SignInScene, type BreathScenePhase } from './AppScenes';
import { SceneJourney, ScenePathStart, SceneConceptStart, DoneScene } from './AppScenesMore';
import { SceneChildhood } from './LandingScenes';
import { SceneCheckIn, SceneQuiz, SceneQuizMini } from './LandingScenesMore';
import { HeroCollage } from './HeroCollage';
import { INK } from './scenePaper';
import { SignArt } from './SignArt';

const outside = (el: Element) => !el.closest('.scn-shade');

describe('контракт сцены: декор, тень слоем, без фильтров, токены, равные поля', () => {
  it.each([
    ['Sprout', <Sprout sign="scales" hue={70} />],
    ['SceneBreath', <SceneBreath />],
    ['ScenePebbleLaid', <ScenePebbleLaid />],
    ['SceneJourney', <SceneJourney count={12} />],
    ['ScenePathStart', <ScenePathStart />],
    ['SceneConceptStart', <SceneConceptStart />],
    ['SceneQuizMini', <SceneQuizMini hue={240} />],
    ['HeroCollage compact', <HeroCollage compact />],
    ['SceneCheckIn days', <SceneCheckIn days={4} />],
    ['SceneChildhood values', <SceneChildhood values={[8, 3, null, 6, 10]} />],
  ])('%s', (_, ui) => expectSceneContract(ui));
});

describe('Sprout и знак в сцене', () => {
  it('знак сущности — тот же мотив по ключу, вложенным svg; рядом лист; оттенок — бумага сущности', () => {
    const { container } = render(<Sprout sign="grounded" hue={135} />);
    const scene = container.querySelector('svg.scn') as SVGSVGElement;
    expect(scene.style.getPropertyValue('--h')).toBe('135');
    const signs = [...scene.querySelectorAll('svg.pp-art')];
    expect(signs).toHaveLength(2); // знак и его тень-слой
    const { container: alone } = render(<SignArt sign="grounded" />);
    expect(signs[1].innerHTML).toBe(alone.querySelector('svg')!.innerHTML);
  });

  it('SignInScene кладёт знак в рамку холста', () => {
    const { container } = render(<svg><SignInScene sign="leaf" x={1} y={2} w={3} h={4} /></svg>);
    expect(container.querySelector('svg svg')?.getAttribute('width')).toBe('3');
  });

  it('верхний слой знака в сцене непрозрачен — правило в paper-scenes.css', () => {
    const css = readFileSync(join(__dirname, '../../styles/paper-scenes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.scn svg\.pp-art \[fill-opacity\]\s*\{\s*fill-opacity:\s*1;?\s*\}/);
  });
});

describe('SceneBreath: фаза → положение дуг', () => {
  const arcs = (phase: BreathScenePhase, seconds?: number) => {
    const { container, unmount } = render(<SceneBreath phase={phase} seconds={seconds} />);
    const g = container.querySelector('.scn-breath-arcs') as SVGGElement;
    const out = { transform: g.style.transform, duration: g.style.transitionDuration, leaf: container.querySelectorAll('path[d^="M178 206"]').length };
    unmount();
    return out;
  };

  it('вдох — дуги расходятся, задержка — стоят там же, выдох — возвращаются', () => {
    expect(arcs('in').transform).toBe('scale(1.08)');
    expect(arcs('hold').transform).toBe(arcs('in').transform);
    expect(arcs('out').transform).toBe('scale(1)');
  });

  it('улеглось — дуги осели ниже обычного, у основания полоски вырос лист (с тенью)', () => {
    const rest = arcs('rest');
    expect(rest.transform).toBe('scale(0.94, 0.86)');
    expect(rest.leaf).toBe(2);
    expect(arcs('in').leaf).toBe(0);
  });

  it('длина перехода — длина фазы; reduced-motion снимает движение; бесконечной анимации нет', () => {
    expect(arcs('out', 6).duration).toBe('6s');
    const css = readFileSync(join(__dirname, '../../styles/paper-scenes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.scn-breath-arcs\s*\{\s*transition:\s*none;?\s*\}/);
    expect(css).not.toMatch(/infinite/);
  });
});

describe('ScenePebbleLaid, SceneJourney, ScenePathStart, SceneConceptStart', () => {
  it('пустой лист: ни один камешек не лёг, все три ждут на земле пустым тоном и без тени', () => {
    expectEmptyScene(<ScenePebbleLaid filled={0} />, 'ellipse[data-laid="yes"]');
    const waiting = [...render(<ScenePebbleLaid filled={0} />).container.querySelectorAll('ellipse[data-laid="no"]')];
    expect(waiting).toHaveLength(3);
    expect(waiting.every(outside)).toBe(true);
    expect(waiting.every((e) => e.getAttribute('fill') === INK.hollow)).toBe(true);
  });

  it('пустая лента: один камешек на листе, два ждут на земле', () => {
    const { container } = render(<ScenePebbleLaid filled={1} />);
    expect([...container.querySelectorAll('ellipse[data-laid="yes"]')].filter(outside)).toHaveLength(1);
    expect(container.querySelectorAll('ellipse[data-laid="no"]')).toHaveLength(2);
  });

  it('последний камешек только лёг: своя тень выше остальных', () => {
    const { container } = render(<ScenePebbleLaid filled={3} />);
    const shades = [...container.querySelectorAll('.scn-shade')].filter((g) => g.querySelector('ellipse'));
    expect(shades.map((g) => g.getAttribute('transform'))).toEqual(['translate(3 4)', 'translate(8 9)']);
    expect(container.querySelectorAll('ellipse[data-laid="yes"]').length).toBe(6);
    expect(container.querySelectorAll('ellipse[data-laid="no"]').length).toBe(0);
  });

  it('стопка пути по числу шагов; ноль шагов — пустая земля', () => {
    const sheets = (count: number) => render(<SceneJourney count={count} />).container.querySelectorAll('[data-sheet]').length / 2;
    expect([1, 3, 4, 100].map(sheets)).toEqual([1, 2, 3, 6]);
    expectEmptyScene(<SceneJourney count={0} />, '[data-sheet]');
  });

  it('начало пути: одна полоска, пустые листы-силуэты бледные и без тени', () => {
    const { container } = render(<ScenePathStart />);
    const blanks = [...container.querySelectorAll('rect[fill-opacity]')];
    expect(blanks).toHaveLength(3);
    expect(blanks.every(outside)).toBe(true);
  });

  it('пустая схема случая: потребность и два слоя легли с тенью, третий бледный и без тени', () => {
    const { container } = render(<SceneConceptStart />);
    const pale = [...container.querySelectorAll('rect[fill-opacity]')];
    expect(pale).toHaveLength(1);
    expect(outside(pale[0])).toBe(true);
    const laid = [...container.querySelectorAll('rect[height="26"]:not([fill-opacity])')];
    expect(laid.filter(outside)).toHaveLength(3);
    expect(laid.filter((r) => !outside(r))).toHaveLength(3);
  });
});

describe('варианты сцен лендинга для кабинета', () => {
  it('SceneChildhood values: длина — оценка, ниже 5 — бледная и без тени, без оценки — нет полоски', () => {
    const { container } = render(<SceneChildhood values={[10, 3, null, 5, 0]} />);
    const bars = [...container.querySelectorAll('rect[data-value]')].filter(outside);
    expect(bars.map((b) => [b.getAttribute('data-value'), b.getAttribute('height'), b.hasAttribute('fill-opacity')])).toEqual([
      ['3', '30', true], ['0', '30', true], ['10', '72', false], ['5', '36', false],
    ]);
  });

  it('SceneChildhood без values — композиция лендинга', () => {
    const { container } = render(<SceneChildhood />);
    expect(container.querySelectorAll('rect[data-value]')).toHaveLength(0);
    expect([...container.querySelectorAll('rect[fill-opacity]')]).toHaveLength(1);
  });

  it('SceneCheckIn days: за сегодняшним листом — дни серии (до четырёх); 0 — пустой лист; по умолчанию — вид лендинга', () => {
    const look = (days?: number) => {
      const { container, unmount } = render(<SceneCheckIn days={days} />);
      const behind = [...container.querySelectorAll('.scn-shade > rect')].length;
      const bars = [...container.querySelectorAll('.scn-shade g rect[rx="10"]')].length;
      const box = container.querySelector('svg')!.getAttribute('viewBox');
      unmount();
      return { behind, bars, box };
    };
    expect([0, 1, 2, 4, 5, 30].map((d) => look(d).behind)).toEqual([0, 0, 1, 3, 4, 4]);
    expect(look(0).bars).toBe(0);
    expect(look(1).bars).toBe(5);
    expect(look()).toEqual({ behind: 2, bars: 5, box: '34 31 259 218' });
    expect(look(3)).toEqual(look());
  });

  it('SceneQuizMini: тот же веер без листа-подложки, окно по карточкам', () => {
    const { container: mini } = render(<SceneQuizMini hue={135} />);
    const { container: full } = render(<SceneQuiz hue={135} />);
    expect(mini.querySelector('.scn-sheet')).toBeNull();
    expect(full.querySelector('.scn-sheet')).not.toBeNull();
    expect(mini.querySelector('svg')!.getAttribute('viewBox')).not.toBe('0 0 320 260');
  });

  it('HeroCollage compact — один холст 320×140 без лендинговых классов', () => {
    const { container } = render(<HeroCollage compact />);
    const svgs = container.querySelectorAll('svg.scn');
    expect(svgs).toHaveLength(1);
    expect(svgs[0].getAttribute('viewBox')).toBe('0 0 320 140');
    expect(svgs[0].getAttribute('class')).not.toMatch(/pl2-hero-collage/);
  });
});

describe('DoneScene: сцена «готово» по ENTITY_LOOK', () => {
  it('разбор — знак с ростком, дневник — камешек лёг, дыхание — улеглось, трекер — лист дня без выдуманной серии', () => {
    const scene = (ui: ReactElement) => render(ui).container;
    expect(scene(<DoneScene entity="case" />).querySelector('svg.pp-art')).not.toBeNull();
    expect(scene(<DoneScene entity="diary" />).querySelectorAll('ellipse').length).toBeGreaterThan(0);
    expect(scene(<DoneScene entity="breathing" />).querySelector('.scn-breath--rest')).not.toBeNull();
    const tracker = scene(<DoneScene entity="tracker" />);
    expect(tracker.querySelectorAll('.scn-shade > rect')).toHaveLength(0);
    expect(tracker.querySelectorAll('.scn-shade g rect[rx="10"]')).toHaveLength(5);
    expect(scene(<DoneScene entity="journey" />).innerHTML).toBe('');
    expect(scene(<DoneScene entity="sos" />).querySelector('svg.scn')?.getAttribute('style')).toContain('--h: 25');
  });
});
