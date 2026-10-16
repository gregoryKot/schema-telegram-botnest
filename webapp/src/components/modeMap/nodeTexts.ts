import type { NodeType } from '../modeMapData';

interface NodeTexts {
  /** Заголовок панели редактора. */
  title: string;
  /** Подпись поля заметки. */
  note: string;
  /** Подсказка в пустом поле заметки. */
  notePlaceholder: string;
}

const MODE_TEXTS: NodeTexts = { title: 'Режим', note: 'Заметка', notePlaceholder: 'Как этот режим проявляется у клиента' };

// У фигур схемы случая заметка — это убеждение схемы или текст опыта, а не «проявление режима».
const CONCEPT_TEXTS: Partial<Record<NodeType, NodeTexts>> = {
  schema: { title: 'Схема', note: 'Во что человек верит', notePlaceholder: 'Убеждение, на котором держится схема' },
  origin: { title: 'Опыт детства', note: 'Как нарушалась потребность', notePlaceholder: 'Что происходило в детстве' },
  need: { ...MODE_TEXTS, title: 'Потребность', notePlaceholder: 'Что с этой потребностью у клиента' },
  needs: { ...MODE_TEXTS, title: 'Круг потребностей', notePlaceholder: 'Что с этими потребностями у клиента' },
};

/** Тексты панели редактора по типу ноды; для режимов — прежние. */
export const nodeTexts = (type: NodeType): NodeTexts => CONCEPT_TEXTS[type] ?? MODE_TEXTS;
