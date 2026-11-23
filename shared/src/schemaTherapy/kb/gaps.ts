// Известные дыры базы знаний (.claude/rules/knowledge-base.md, раздел 4): только убывают.
// Закрыл дыру связью — удали строку здесь; новая строка todo — только с записью в docs/BACKLOG.md.

export interface KbGap {
  /** theory — так устроена теория; todo — контент ещё не связан. */
  kind: 'theory' | 'todo';
  why: string;
}

const HEALTHY = 'здоровый режим — цель работы, а не следствие схемы';

/** Режимы, которых нет ни в одном SchemaGuide.modeIds. */
export const MODES_WITHOUT_SCHEMA: Readonly<Record<string, KbGap>> = {
  healthy_adult: { kind: 'theory', why: HEALTHY },
  happy_child: { kind: 'theory', why: HEALTHY },
  good_parent: { kind: 'theory', why: HEALTHY },
  predator: {
    kind: 'theory',
    why: 'режим из модели для правонарушителей (Bernstein, Arntz & de Vos 2007), литература не выводит его из конкретной схемы',
  },
};

const PHASE =
  'её зовёт только фаза терапии, а фазы разделом не считаются (решение дирижёра)';

const DEPRESSION =
  'нужен запрос «Депрессия» во вкладке «Запросы»: техника для депрессии';

/** Техники, которых нет ни в одном поле techniques раздела. */
export const TECHNIQUES_WITHOUT_SECTION: Readonly<Record<string, KbGap>> = {
  schema_attunement: {
    kind: 'theory',
    why: 'часть структуры любой сессии (разбор триггеров в первой трети), а не ответ на режим или схему',
  },
  online_chairwork: {
    kind: 'theory',
    why: 'формат видеосессии для любой работы со стульями: не зависит от режима или схемы',
  },
  mode_dialogue_imagery: {
    kind: 'theory',
    why: 'тот же диалог режимов, что на стульях, с закрытыми глазами: вариант формы для любого режима',
  },
  life_line: {
    kind: 'theory',
    why: 'сбор истории в начале терапии у любого клиента; ' + PHASE,
  },
  window_of_tolerance: {
    kind: 'theory',
    why: 'модель дозирования любой эмоциональной техники, а не работа с конкретным режимом или схемой',
  },
  validation_levels: {
    kind: 'theory',
    why: 'позиция терапевта на любой сессии, как и ограниченное родительство: конкретного режима у неё нет',
  },
  healthy_adult_three_chairs: {
    kind: 'theory',
    why:
      'шаг средней фазы, где клиент сам отвечает любому своему режиму; ' +
      PHASE,
  },
  motivational_interviewing: {
    kind: 'theory',
    why: 'приём для любого копингового режима, который не готов уступать; конкретного режима полка не называет',
  },
  defusion: {
    kind: 'todo',
    why: 'по [Кембридж, гл. 13] место — Беспокоящийся Гиперконтролёр, но у него уже пять техник (потолок плашки): нужно решение, какую заменить',
  },
  behavioral_activation: {
    kind: 'todo',
    why: DEPRESSION,
  },
  need_now_question: {
    kind: 'todo',
    why: DEPRESSION + ' [Кембридж, гл. 13]',
  },
  chain_analysis: {
    kind: 'todo',
    why: 'нужно упоминание разбора поступка по звеньям в статье о ПРЛ или разделе режима (Линехан, 1993, гл. 9)',
  },
  stop_rewind_explore: {
    kind: 'todo',
    why: 'нужно упоминание ментализации в статье о ПРЛ или разделе Агрессора (Бейтман и Фонаги, 2016, гл. 6)',
  },
  two_axis_check: {
    kind: 'theory',
    why: 'приём против черно-белого мышления у любого клиента [Арнтц ПРЛ, гл. 6]: конкретного режима или схемы книга не называет',
  },
  need_cycle: {
    kind: 'theory',
    why: 'разбор любой расстроившей ситуации от чувства к потребности [Арнтц ПРЛ, гл. 6]: не зависит от режима или схемы',
  },
  guess_the_mode: {
    kind: 'theory',
    why:
      'знакомство с моделью режимов на первой фазе у любого клиента [Арнтц ПРЛ, гл. 3]; ' +
      PHASE,
  },
};

/**
 * Названия режимов в тексте раздела схемы без режима в её modeIds: `схема→режим`.
 * Здоровые режимы (theory в MODES_WITHOUT_SCHEMA) не ищутся: цель работы называют везде.
 */
export const TEXT_MENTIONS_WITHOUT_LINK: Readonly<Record<string, KbGap>> = {
  'entitlement→vulnerable_child': {
    kind: 'theory',
    why: 'текст объясняет, что при «чистой» схеме режима нет, а при вторичной он принадлежит исходной схеме',
  },
};
