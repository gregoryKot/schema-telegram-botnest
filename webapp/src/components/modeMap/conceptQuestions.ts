import type { NodeType } from '../modeMapData';

// Вопросы терапевту к фигурам схемы случая (панель редактора, «Спросить себя»);
// все ведут в поле заметки. Для обычных режимов вопросы свои — ClinicalHint.tsx.
const QUESTIONS: Partial<Record<NodeType, string[]>> = {
  schema: ['Во что человек верит о себе и о других?', 'В каких ситуациях схема включается?'],
  origin: ['Что происходило в детстве?', 'Кто был рядом и как реагировал?'],
  need: ['Что мешает этой потребности?'],
  needs: ['Какие потребности остались без заботы?'],
};

/** Вопросы фигуры схемы случая; у остальных типов undefined. */
export const conceptQuestions = (type: NodeType): string[] | undefined => QUESTIONS[type];
