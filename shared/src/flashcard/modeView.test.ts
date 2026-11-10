// Подпись режима сохранённой карточки «Мне плохо»: свой режим, режим из общего словаря и
// неизвестный id (аудит 2026-11: «История карточек» показывала сырой «punitive_critic»).
import { describe, it, expect } from 'vitest';
import { buildModes } from './modes';
import { FLASHCARD_MODE_GROUP, flashcardModeView } from './modeView';
import { MODE_GROUPS } from '../schemaTherapy/schemaTherapyData';

const modes = buildModes((ty) => ty);

describe('flashcardModeView', () => {
  it('свой режим карточки — своя подпись и группа', () => {
    expect(flashcardModeView('detached', modes)).toEqual({
      label: 'Отстранённый Защитник',
      groupId: 'coping_avoidance',
    });
    expect(flashcardModeView('angry_child', modes)).toEqual({
      label: 'Сердитый Ребёнок',
      groupId: 'child',
    });
  });

  it('режим не из карточки — подпись и группа из общего словаря, а не сырой id', () => {
    const view = flashcardModeView('punitive_critic', modes);
    expect(view).toEqual({ label: 'Карающий Критик', groupId: 'critic' });
    expect(view.label).not.toBe('punitive_critic');
  });

  it('неизвестный id — без подписи и без группы (режим не выдумывается)', () => {
    expect(flashcardModeView('no_such_mode', modes)).toEqual({
      label: null,
      groupId: undefined,
    });
  });

  it('у каждого режима карточки есть группа из MODE_GROUPS', () => {
    const groups = new Set(MODE_GROUPS.map((g) => g.id));
    for (const m of modes)
      expect(groups.has(FLASHCARD_MODE_GROUP[m.id]), m.id).toBe(true);
  });
});
