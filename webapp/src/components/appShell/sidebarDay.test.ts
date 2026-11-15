// Карточка дня в меню (SidebarFoot): индекс — та же формула, что на плитке; бумага — солома трекера до
// полной оценки и шалфей листа «Готово» после. Полоски — общая dayStrokeValues (её тест —
// shared/src/needs/dayStrokes.test.ts), здесь только то, что она подключена.
import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, OUTCOME_LOOK } from '../../../../shared/src/theme/entityLook';
import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { dayStrokeValues } from '../../../../shared/src/needs/dayStrokes';
import { DAY_DONE_HUE, DAY_OPEN_HUE, sidebarDay } from './sidebarDay';

const IDS = [...NEED_COLOR_ORDER];
const FULL = { attachment: 6, autonomy: 7, expression: 5, play: 6, limits: 6 };

describe('sidebarDay', () => {
  it('бумага: до полной оценки — солома трекера, после — шалфей исхода «Готово» (таблицы вида)', () => {
    expect(DAY_OPEN_HUE).toBe(ENTITY_LOOK.tracker.hue);
    expect(DAY_DONE_HUE).toBe(OUTCOME_LOOK.done.hue);
  });

  it('пустой и частичный день: индекса нет, солома', () => {
    const partial: Record<string, number>[] = [{}, { autonomy: 7, limits: 3 }];
    for (const r of partial) {
      expect(sidebarDay(IDS, r)).toMatchObject({ index: null, hue: DAY_OPEN_HUE });
    }
  });

  it('день оценён целиком: индекс с запятой, шалфей; 0 — «не оценено», индекса нет', () => {
    expect(sidebarDay(IDS, FULL)).toMatchObject({ index: '6,0', hue: DAY_DONE_HUE });
    expect(sidebarDay(IDS, { ...FULL, play: 0 })).toMatchObject({ index: null, hue: DAY_OPEN_HUE });
  });

  it('полоски — те же значения, что на главной', () => {
    expect(sidebarDay(IDS, { autonomy: 7 }).values).toEqual(dayStrokeValues({ autonomy: 7 }));
  });
});
