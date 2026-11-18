// Тексты общего поиска: подсказка в поле, строка «что ищется» и примеры запросов.
import type { PaletteGuide, PaletteInput } from './paletteRows';

type Mode = Pick<PaletteInput, 'therapist' | 'therapistMode' | 'screenShare'>;

/** Подсказка в поле; на втором шаге — вопрос шага. */
export function palettePlaceholder({ therapist, therapistMode, screenShare }: Mode, assigning: boolean): string {
  if (assigning) return 'Кому дать задание?';
  if (therapist && therapistMode) return screenShare ? 'Лист справочника, раздел…' : 'Клиент, вкладка, задание, лист справочника…';
  return therapist && !screenShare ? 'Клиент, страница, действие…' : 'Найти страницу или действие…';
}

/** Примеры запросов из настоящих названий листов: первая схема, первый режим, первая техника. */
export function paletteExamples(guide: PaletteGuide | null): string[] {
  if (!guide) return [];
  return [guide.ref.schemas, guide.ref.modes, guide.ref.techniques].flatMap((groups) => groups[0]?.items[0]?.name ?? []);
}

/** Строка «что ищется»: под полем при пустом запросе и в «Ничего не нашлось». */
export function paletteHelp({ therapist, therapistMode, screenShare }: Mode): string {
  const cabinet = therapist && therapistMode;
  const parts = [
    therapist && !screenShare && (cabinet ? 'клиенты и их вкладки' : 'клиенты'),
    cabinet && !screenShare && 'задания',
    cabinet && 'листы справочника',
    'разделы и действия',
  ].filter(Boolean).join(', ');
  return parts[0].toUpperCase() + parts.slice(1);
}
