import type { ConceptTextField } from '../../../../../shared/src/therapy/clientSheetHelpers';

// Разделы текстовой части концептуализации: порядок, номер и короткое имя для
// чипа-якоря. Каждый раздел пишет в своё существующее поле модели.
export const CONCEPT_SECTIONS: { key: ConceptTextField; title: string }[] = [
  { key: 'goals', title: 'Цели' },
  { key: 'earlyExperience', title: 'Ранний опыт' },
  { key: 'unmetNeeds', title: 'Потребности' },
  { key: 'triggers', title: 'Триггеры' },
  { key: 'copingStyles', title: 'Совладание' },
  { key: 'modeTransitions', title: 'Режимы' },
  { key: 'currentProblems', title: 'Проблемы' },
];

export type ConceptValues = Partial<Record<ConceptTextField, string | null | undefined>>;

export const sectionNumber = (i: number) => String(i + 1).padStart(2, '0');
export const sectionAnchor = (key: string) => `tcp-sec-${key}`;

/** Какие разделы заполнены (непустой текст после trim) — по реальным полям. */
export function filledSections(values: ConceptValues): boolean[] {
  return CONCEPT_SECTIONS.map((s) => !!values[s.key]?.trim());
}

export function filledCount(values: ConceptValues): number {
  return filledSections(values).filter(Boolean).length;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Тег уже есть в тексте как отдельный элемент списка (запятая/перенос строки). */
export function hasTag(text: string, tag: string): boolean {
  return text.split(/[,\n;]/).some((p) => norm(p) === norm(tag));
}

/** Дописывает тег в конец текста: через «, » к строке или с новой строки. */
export function appendTag(text: string, tag: string): string {
  if (hasTag(text, tag)) return text;
  const t = text.replace(/\s+$/, '');
  if (!t) return tag;
  return /[.!?]$/.test(t) ? `${t}\n${tag}` : `${t}, ${tag}`;
}
