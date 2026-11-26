import { describe, expect, it } from 'vitest';
import { PILE_H, pileFrame, sashaLook, zoneOnScreen, type SashaView } from './look';
import { MONDAY } from './monday';

const run: SashaView = { frozen: false, resting: false, dashing: false, onGround: true, vy: 0, phone: false, speed: 230, load: 0 };

describe('sashaLook — поза Саши по состоянию', () => {
  it('шаг, бег и стойка различаются скоростью', () => {
    expect(sashaLook(run)).toEqual({ anim: 'wk-run' });
    expect(sashaLook({ ...run, speed: 80 })).toEqual({ anim: 'wk-walk' });
    expect(sashaLook({ ...run, speed: 0 })).toEqual({ anim: 'wk-idle' });
  });
  it('в воздухе — кадр взлёта или падения', () => {
    expect(sashaLook({ ...run, onGround: false, vy: -300 })).toEqual({ sheet: 'wk_sasha_air', frame: 0 });
    expect(sashaLook({ ...run, onGround: false, vy: 120 })).toEqual({ sheet: 'wk_sasha_air', frame: 1 });
  });
  it('остановка в ПАУЗЕ важнее всего остального', () => {
    expect(sashaLook({ ...run, frozen: true, dashing: true, phone: true })).toEqual({ sheet: 'wk_sasha_still', frame: 0 });
  });
  it('без сил Саша плетётся, даже если нажат рывок', () => {
    expect(sashaLook({ ...run, resting: true, dashing: true })).toEqual({ anim: 'wk-trudge' });
    expect(sashaLook({ ...run, resting: true, sitting: true })).toEqual({ sheet: 'wk_sasha_still', frame: 1 });
  });
  it('телефон в руке — только на земле; рывок его перебивает', () => {
    expect(sashaLook({ ...run, phone: true })).toEqual({ anim: 'wk-phone' });
    expect(sashaLook({ ...run, phone: true, dashing: true })).toEqual({ anim: 'wk-dash' });
  });
  it('чужое в рюкзаке — тяжёлые листы во всех позах', () => {
    expect(sashaLook({ ...run, load: 1 })).toEqual({ anim: 'wk-run_heavy' });
    expect(sashaLook({ ...run, load: 2, frozen: true })).toEqual({ sheet: 'wk_sasha_still_heavy', frame: 0 });
  });
});

describe('pileFrame — кадр стопки по высоте преграды', () => {
  it('у каждой стопки главы есть кадр своей высоты', () => {
    for (const g of MONDAY.gates.filter(g => g.kind === 'pile')) {
      const drawn = PILE_H[pileFrame(g.h)] * 2; // нечётная высота — арт выше на экранный пиксель
      expect(drawn - g.h).toBeGreaterThanOrEqual(0);
      expect(drawn - g.h).toBeLessThanOrEqual(1);
    }
  });
  it('выше нарисованного — самая высокая', () => {
    expect(pileFrame(999)).toBe(PILE_H.length - 1);
  });
});

describe('zoneOnScreen — кусок фона в кадре', () => {
  it('зона целиком в кадре начинается с нуля плитки', () => {
    expect(zoneOnScreen(100, 300, 0, 640)).toEqual({ left: 100, width: 200, tileX: 0 });
  });
  it('зона ушла влево — плитка сдвинута на прокрутку', () => {
    expect(zoneOnScreen(100, 5000, 500, 640)).toEqual({ left: 0, width: 640, tileX: 200 });
  });
  it('зоны нет в кадре', () => {
    expect(zoneOnScreen(100, 300, 400, 640)).toBeNull();
    expect(zoneOnScreen(2000, 3000, 0, 640)).toBeNull();
  });
});
