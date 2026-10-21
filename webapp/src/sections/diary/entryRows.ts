import type { SchemaDiaryEntry, ModeDiaryEntry, EmotionEntry } from '../../types';
import { EMOTIONS, getSchemaById } from '../../schemaTherapyData';

export type FieldRow = [label: string, text: string | null | undefined, accent?: boolean];

// Все поля формы записи — как в мини-аппе (SchemaCard/ModeCard), порядок тот же.
export function schemaEntryRows(entry: SchemaDiaryEntry): FieldRow[] {
  const emotions = EMOTIONS.filter(e => entry.emotions.some((em: EmotionEntry) => em.id === e.id));
  const schemas = entry.schemaIds.map(id => getSchemaById(id)).filter(Boolean);
  return [
    ['Чувства', emotions.map(e => e.label).join(', ')],
    ['Мысли', entry.thoughts],
    ['Тело', entry.bodyFeelings],
    ['Реакция', entry.actualBehavior],
    ['Схемы', schemas.map(s => s!.name).join(', ')],
    ['Происхождение', entry.schemaOrigin],
    ['Здоровый взгляд', entry.healthyView, true],
    ['Реальные проблемы', entry.realProblems],
    ['Чрезмерные реакции', entry.excessiveReactions],
    ['Здоровое поведение', entry.healthyBehavior],
  ];
}

export function modeEntryRows(entry: ModeDiaryEntry): FieldRow[] {
  return [
    ['Мысли режима', entry.thoughts],
    ['Чувства', entry.feelings],
    ['Тело', entry.bodyFeelings],
    ['Действия', entry.actions],
    ['Что было нужно', entry.actualNeed, true],
    ['Откуда знакомо', entry.childhoodMemories],
    ['Здоровый Взрослый', entry.healthyResponse],
  ];
}
