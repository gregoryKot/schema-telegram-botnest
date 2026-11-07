// «Дать заданием» из подсказок терапевту (#995): пункт «Между сессиями» → тип
// и текст листа «Новое задание».
import { describe, it, expect } from 'vitest';
import type { GuideTaskType } from '../../../../../shared/src/schemaTherapy/guide';
import { TASK_OPTIONS } from '../../taskCreate/taskOptions';
import { guideAssignPreset } from './guideAssign';

// Все типы, которые подсказка умеет дать упражнением (Record — исчерпывающий список).
const GUIDE_TYPES: Record<GuideTaskType, true> = {
  belief_check: true,
  letter_to_self: true,
  safe_place: true,
  flashcard: true,
  schema_intro: true,
  mode_intro: true,
  diary_streak: true,
};

describe('guideAssignPreset', () => {
  it('упражнение из «Практик» — его тип, без текста', () => {
    expect(
      guideAssignPreset({ kind: 'task', type: 'safe_place', title: 'Безопасное место', note: 'перечитывать вечером' }),
    ).toEqual({ type: 'safe_place' });
  });

  it('упражнение без экрана — «Своё задание»: название, перевод строки, инструкция', () => {
    expect(
      guideAssignPreset({ kind: 'custom', title: 'Встреча со своим маленьким Я', text: 'Пять минут в день' }),
    ).toEqual({ type: 'custom', text: 'Встреча со своим маленьким Я\nПять минут в день' });
  });

  it('каждый тип подсказки есть в листе назначения — лист откроется с ним, а не с первым', () => {
    const types = new Set(TASK_OPTIONS.map((o) => o.type));
    for (const t of Object.keys(GUIDE_TYPES) as GuideTaskType[]) {
      expect(types.has(guideAssignPreset({ kind: 'task', type: t, title: t }).type), t).toBe(true);
    }
  });
});
