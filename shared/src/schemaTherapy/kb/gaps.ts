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
  'техника для депрессии, а запроса «Депрессия» во вкладке «Запросы» нет';

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
    kind: 'theory',
    why: 'нет подтверждения в тексте справочника: разделы Критиков дефузию не называют, связь — только в описании самой техники (Рёдигер и соавт., 2018)',
  },
  behavioral_activation: {
    kind: 'theory',
    why: DEPRESSION + '; у Отстранённого Защитника все 5 техник подтверждены его текстом',
  },
  need_now_question: {
    kind: 'theory',
    why: DEPRESSION + ' [Кембридж, гл. 13]',
  },
  chain_analysis: {
    kind: 'theory',
    why: 'нет подтверждения в тексте справочника: ни статья о ПРЛ, ни разделы режимов не называют разбор поступка по звеньям',
  },
  stop_rewind_explore: {
    kind: 'theory',
    why: 'нет подтверждения в тексте справочника: ментализацию не называет ни статья о ПРЛ, ни раздел Агрессора',
  },
  current_role_play: {
    kind: 'theory',
    why: 'нет подтверждения в тексте справочника: разделы называют историческую ролевую игру и репетицию, а разбор недавней ссоры в трёх фазах — ни один',
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
