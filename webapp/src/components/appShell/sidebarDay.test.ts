// Карточка дня в меню (SidebarFoot): индекс — та же формула, что на плитке; полоски — оценки дня по
// порядку NEED_ORDER, без оценки — null (пустой тон бумаги), ничего выдуманного; бумага — солома
// трекера до полной оценки и шалфей листа «Готово» после. Литералы сверяются с таблицей вида.
import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, OUTCOME_LOOK } from '../../../../shared/src/theme/entityLook';
import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { DAY_DONE_HUE, DAY_OPEN_HUE, sidebarDay } from './sidebarDay';

const IDS = [...NEED_COLOR_ORDER];

describe('sidebarDay', () => {
  it('бумага — солома трекера и шалфей «Готово» из таблицы вида', () => {
    expect(DAY_OPEN_HUE).toBe(ENTITY_LOOK.tracker.hue);
    expect(DAY_DONE_HUE).toBe(OUTCOME_LOOK.done.hue);
  });

  it('пустой день: индекса нет, все пять полосок пустые, солома', () => {
    expect(sidebarDay(IDS, {})).toEqual({ index: null, hue: DAY_OPEN_HUE, values: [null, null, null, null, null] });
  });

  it('день оценён частично: индекса нет, оценённые — своими значениями по порядку NEED_ORDER', () => {
    const day = sidebarDay(IDS, { autonomy: 7, limits: 3 });
    expect(day.index).toBeNull();
    expect(day.values).toEqual([null, 7, null, null, 3]);
    expect(day.hue).toBe(DAY_OPEN_HUE);
  });

  it('день оценён целиком: индекс с запятой, шалфей; 0 — «не оценено», не данные', () => {
    const full = { attachment: 6, autonomy: 7, expression: 5, play: 6, limits: 6 };
    expect(sidebarDay(IDS, full)).toEqual({ index: '6,0', hue: DAY_DONE_HUE, values: [6, 7, 5, 6, 6] });
    expect(sidebarDay(IDS, { ...full, play: 0 }).values[3]).toBeNull();
  });
});
