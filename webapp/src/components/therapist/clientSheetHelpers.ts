import type { ClientConceptualization } from '../../api';

// Общие с мини-аппом чистые хелперы — в shared (правило №3).
export { DAY_NAMES, calcTherapyDuration, nextSessionLabel } from '../../../../shared/src/therapy/clientSheetHelpers';

// ЛОКАЛЬНО (разошлось с мини-аппом): в webapp токены --c-* и порог 5.
export function indexColor(v: number) {
  if (v >= 7) return 'var(--c-moss)';
  if (v >= 5) return 'var(--text)';
  return 'var(--c-rose)';
}

// ЛОКАЛЬНО: в webapp пропущено поле goals (есть в мини-аппе) — под продуктовое решение.
export const CONCEPT_FIELDS: { key: keyof ClientConceptualization; label: string; placeholder: string }[] = [
  { key: 'earlyExperience', label: 'Ранний дисфункциональный опыт', placeholder: 'Значимые события и паттерны из детства и юности, которые сформировали схемы...' },
  { key: 'unmetNeeds', label: 'Неудовлетворённые базовые потребности', placeholder: 'Привязанность, автономия, свобода выражения, игра/спонтанность, реалистичные границы...' },
  { key: 'triggers', label: 'Схемные триггеры', placeholder: 'Ситуации, слова, интонации, отношения – что запускает схемные реакции...' },
  { key: 'copingStyles', label: 'Стили совладания', placeholder: 'Капитуляция, избегание, гиперкомпенсация – типичные паттерны для каждой схемы...' },
  { key: 'modeTransitions', label: 'Переключение режимов', placeholder: 'Что запускает переход в уязвимого ребёнка? Как активируется карающий критик? Когда появляется здоровый взрослый?...' },
  { key: 'currentProblems', label: 'Актуальные проблемы и симптомы', placeholder: 'С чем обратился клиент, текущие жалобы, симптоматика...' },
];
