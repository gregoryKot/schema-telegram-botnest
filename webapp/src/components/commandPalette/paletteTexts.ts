// Тексты общего поиска: подсказка в поле, строка «что ищется» и примеры запросов.
import { EXERCISES } from '../../../../shared/src/exercises/exerciseCatalog';
import { ALL_MODES, ALL_SCHEMAS } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { PaletteGuide, PaletteInput } from './paletteInput';

type Mode = Pick<PaletteInput, 'therapist' | 'therapistMode' | 'screenShare'>;

/** Подсказка в поле; на втором шаге — вопрос шага. */
export function palettePlaceholder({ therapist, therapistMode, screenShare }: Mode, assigning: boolean): string {
  if (assigning) return 'Кому дать задание?';
  if (therapist && therapistMode) return screenShare ? 'Лист справочника, раздел…' : 'Клиент, вкладка, задание, лист справочника…';
  return therapist && !screenShare ? 'Клиент, схема, упражнение, раздел…' : 'Схема, упражнение, задание, раздел…';
}

/** Примеры запросов из настоящих названий. Кабинет: первая схема, режим и техника справочника; клиент — первая схема, режим и упражнение. */
export function paletteExamples(guide: PaletteGuide | null, cabinet: boolean): string[] {
  if (!cabinet) return [ALL_SCHEMAS[0].name, ALL_MODES[0].name, EXERCISES[0].title];
  if (!guide) return [];
  return [guide.ref.schemas, guide.ref.modes, guide.ref.techniques].flatMap((groups) => groups[0]?.items[0]?.name ?? []);
}

/** Строка «что ищется»: под полем при пустом запросе и в «Ничего не нашлось». */
export function paletteHelp({ therapist, therapistMode, screenShare }: Mode): string {
  const cabinet = therapist && therapistMode;
  const parts = [
    therapist && !screenShare && (cabinet ? 'клиенты и их вкладки' : 'клиенты'),
    cabinet && !screenShare && 'задания',
    cabinet ? 'листы справочника' : 'схемы и режимы, упражнения, свои планы и задания',
    'разделы и действия, статьи и настройки',
  ].filter(Boolean).join(', ');
  return parts[0].toUpperCase() + parts.slice(1);
}
