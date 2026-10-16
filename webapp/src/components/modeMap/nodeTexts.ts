import type { NodeType } from '../modeMapData';

interface NodeTexts {
  /** Заголовок панели редактора. */
  title: string;
  /** Подпись поля заметки. */
  note: string;
  /** Подсказка в пустом поле заметки. */
  notePlaceholder: string;
  /** Строка под полем: откуда текст и куда он не уходит. */
  hint?: string;
}

const MODE_TEXTS: NodeTexts = { title: 'Режим', note: 'Заметка', notePlaceholder: 'Как этот режим проявляется у клиента' };

// У фигур схемы случая заметка — это убеждение схемы или текст опыта, а не «проявление режима».
// Источник правды — поля концептуализации: холст их копия для доработки, обратно
// текст не уходит (решение 2026-10-16), и подсказка говорит об этом прямо в редакторе.
const CANVAS_ONLY = 'Текст меняется только на этой карте: концептуализацию клиента правят в виде «Схема».';
const CONCEPT_TEXTS: Partial<Record<NodeType, NodeTexts>> = {
  schema: { title: 'Схема', note: 'Во что человек верит', notePlaceholder: 'Убеждение, на котором держится схема', hint: CANVAS_ONLY },
  origin: { title: 'Опыт детства', note: 'Как нарушалась потребность', notePlaceholder: 'Что происходило в детстве', hint: CANVAS_ONLY },
  need: { ...MODE_TEXTS, title: 'Потребность', notePlaceholder: 'Что с этой потребностью у клиента' },
  needs: { ...MODE_TEXTS, title: 'Круг потребностей', notePlaceholder: 'Что с этими потребностями у клиента' },
};

/** Тексты панели редактора по типу ноды; для режимов — прежние. */
export const nodeTexts = (type: NodeType): NodeTexts => CONCEPT_TEXTS[type] ?? MODE_TEXTS;
