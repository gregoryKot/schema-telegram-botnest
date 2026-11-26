// @vitest-environment jsdom
// Колесо детства сценой вместо радара (b19): оценка → длина и бледность полоски, порядок — NEEDS,
// цвет — цвет данных потребности (палитра данных, решение 7), неоценённая — без полоски. Общая
// механика шага оценки (колесо растёт по мере ответов) и результата.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { needDataColor } from '../../needDataColor';
import { NEEDS } from './needs';
import { WHEEL_FILLS, wheelValues } from './wheelSceneModel';
import { WheelScene } from './WheelScene';

afterEach(() => cleanup());

const RATED = { attachment: 3, autonomy: 8, expression: 5, play: 10, limits: 0 };

describe('wheelValues', () => {
  it('оценки в порядке NEEDS; неоценённая и пропущенная — null, а не ноль или пятёрка', () => {
    expect(wheelValues(RATED)).toEqual([3, 8, 5, 10, 0]);
    expect(wheelValues(RATED, ['limits', 'autonomy'])).toEqual([3, null, 5, 10, null]);
    expect(wheelValues({ play: 7 })).toEqual([null, null, null, 7, null]);
  });

  it('цвет полоски — цвет данных своей потребности', () => {
    expect(WHEEL_FILLS).toEqual(NEEDS.map((n) => needDataColor(n.id)));
  });
});

describe('WheelScene', () => {
  const bars = (container: HTMLElement) =>
    [...container.querySelectorAll('rect[data-value]')].filter((r) => !r.closest('.scn-shade'));

  it('полоска на оценённую потребность её цветом; ниже 5 — бледная и без тени, длина растёт с оценкой', () => {
    const { container } = render(<WheelScene ratings={RATED} unrated={['limits']} />);
    const byFill = new Map(bars(container).map((r) => [r.getAttribute('fill'), r]));
    expect(byFill.size).toBe(4);
    expect(byFill.has(needDataColor('limits')!)).toBe(false);
    const att = byFill.get(needDataColor('attachment')!)!;
    const aut = byFill.get(needDataColor('autonomy')!)!;
    const play = byFill.get(needDataColor('play')!)!;
    expect(att.hasAttribute('fill-opacity')).toBe(true);
    expect(aut.hasAttribute('fill-opacity')).toBe(false);
    expect(Number(play.getAttribute('height'))).toBeGreaterThan(Number(aut.getAttribute('height')));
    expect(container.querySelectorAll('.scn-shade rect[data-value][fill-opacity]')).toHaveLength(0);
  });

  it('ничего не оценено — колесо без полосок (растёт по мере ответов), обёртка несёт класс для листа-героя', () => {
    const { container } = render(<WheelScene ratings={RATED} unrated={NEEDS.map((n) => n.id)} className="chw-scene--strip" />);
    expect(bars(container)).toHaveLength(0);
    expect(container.querySelector('.chw-scene.chw-scene--strip > svg.scn')).not.toBeNull();
  });
});
