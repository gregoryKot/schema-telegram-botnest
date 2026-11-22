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
    kind: 'todo',
    why: 'нужна глава о криминальной модели режимов: на полке источников её нет, решает владелец',
  },
};

const NO_SECTION =
  'ни один раздел режима, схемы или запроса не зовёт технику — связать по книге';

/** Техники, которых нет ни в одном поле techniques раздела. */
export const TECHNIQUES_WITHOUT_SECTION: Readonly<Record<string, KbGap>> =
  Object.fromEntries(
    [
      'limited_reparenting',
      'limit_setting',
      'anger_expression',
      'diagnostic_imagery',
      'safe_place_imagery',
      'mode_dialogue_imagery',
      'mode_map',
      'schema_diary',
      'positive_data_log',
      'behavioral_experiment',
      'transitional_objects',
      'play_and_joy',
      'body_grounding',
      'values_overview',
      'couple_mode_cycle',
      'online_chairwork',
      'schema_attunement',
      'healthy_adult_three_chairs',
      'need_now_question',
      'downward_arrow',
      'responsibility_pie',
      'courtroom',
      'schema_dialogue',
      'current_role_play',
      'two_axis_check',
      'need_cycle',
      'guess_the_mode',
      'behavioral_activation',
      'socratic_dialogue',
      'exposure',
      'chain_analysis',
      'distress_tolerance',
      'validation_levels',
      'defusion',
      'compassionate_self',
      'motivational_interviewing',
      'window_of_tolerance',
      'stop_rewind_explore',
      'life_line',
    ].map((id) => [id, { kind: 'todo', why: NO_SECTION } satisfies KbGap]),
  );

/**
 * Названия режимов в тексте раздела схемы без режима в её modeIds: `схема→режим`.
 * Здоровые режимы (theory в MODES_WITHOUT_SCHEMA) не ищутся: цель работы называют везде.
 */
export const TEXT_MENTIONS_WITHOUT_LINK: Readonly<Record<string, KbGap>> = {
  'entitlement→vulnerable_child': {
    kind: 'theory',
    why: 'текст объясняет, что при «чистой» схеме режима нет, а при вторичной он принадлежит исходной схеме',
  },
  'unrelenting_standards→vulnerable_child': {
    kind: 'todo',
    why: 'режим назван, когда планка компенсирует Дефективность: характерен ли он для самой схемы — решает владелец по книге',
  },
};
