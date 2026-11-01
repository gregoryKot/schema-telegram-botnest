// Текст поля концептуализации длиннее предела сервера (`@MaxLength` в
// ConceptualizationDto = CONCEPT_FIELD_TEXT_MAX) — 400 на всё сохранение.
// Инцидент 2026-10-26: баннер говорил «Не удалось сохранить изменения.
// Попробуй ещё раз», повтор не помогал, и вместе с длинным полем не
// сохранялись остальные. Теперь у полей обоих фронтов `maxLength`, а если
// длинный текст всё же оказался в теле (сохранённый до предела, вставленный
// программно), сообщение называет поле, которое надо сократить.
import { CONCEPT_FIELD_TEXT_MAX } from '../limits/textLimits';
import { CONCEPT_FIELDS, type ConceptTextField } from './clientSheetHelpers';

type Tr = (ty: string, vy: string) => string;

/** Первое текстовое поле длиннее предела — его подпись, иначе `null`. */
export function conceptOverLimitField(
  concept: Partial<Record<ConceptTextField, string | null>>,
): string | null {
  const over = CONCEPT_FIELDS.find(
    (f) => (concept[f.key]?.length ?? 0) > CONCEPT_FIELD_TEXT_MAX,
  );
  return over ? over.label : null;
}

export function conceptOverLimitText(label: string, tr: Tr): string {
  const max = CONCEPT_FIELD_TEXT_MAX.toLocaleString('ru-RU');
  return tr(
    `В поле «${label}» больше ${max} знаков — сократи его, и изменения сохранятся.`,
    `В поле «${label}» больше ${max} знаков — сократите его, и изменения сохранятся.`,
  );
}
