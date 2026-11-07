/**
 * Подсказки терапевту (#995): что делать с каждым режимом и каждой схемой.
 * Содержание — переработка справочника владельца «Схемы и режимы:
 * справочник по работе» (2026-11-06), ссылки на книги — метками в квадратных
 * скобках, как в справочнике: [Арнтц, 6.2], [Кембридж, гл. 8].
 *
 * Тексты видит только терапевт. Строки, где есть обращение (реплика
 * терапевта клиенту, фраза репарентинга), собираются через tr — поэтому
 * каждый файл содержания — билдер `(tr) => …`, а не константа.
 */
import type { Tr } from '../../needs/types';

/** Техника из библиотеки (guide/techniques/*). */
export type TechniqueId =
  | 'imagery_rescripting'
  | 'future_imagery'
  | 'chairwork'
  | 'historical_role_play'
  | 'flashcards'
  | 'letters'
  | 'pattern_breaking'
  | 'mindfulness'
  | 'empathic_confrontation'
  | 'pros_cons'
  | 'mode_interview'
  | 'self_compassion'
  | 'healthy_adult_imagery';

/**
 * Типы заданий, которые подсказка умеет выдать упражнением из «Практик».
 * Подмножество TaskType сайта (webapp/src/components/taskCreate/taskOptions.ts);
 * сверка — тестом на стороне сайта.
 */
export type GuideTaskType =
  | 'belief_check'
  | 'letter_to_self'
  | 'safe_place'
  | 'flashcard'
  | 'schema_intro'
  | 'mode_intro'
  | 'diary_streak';

/**
 * Пункт «Между сессиями» — что клиент делает сам между встречами.
 * `task` — упражнение, у которого в приложении есть экран и тип задания;
 * `custom` — упражнение из справочника без экрана: даётся «Своим заданием»,
 * текст задания = `title` + перевод строки + `text`.
 */
export type BetweenSessionsItem =
  | { kind: 'task'; type: GuideTaskType; title: string; note?: string }
  | { kind: 'custom'; title: string; text: string };

/**
 * Пилот живого языка (2026-11): поля переписанного раздела. Необязательные —
 * раздел без них рисуется как раньше, пока его не переписали.
 */
export interface GuideVoiceFields {
  /** «Как это звучит»: 1–2 реплики терапевта клиенту, через tr; кавычки ставит лист. */
  voice?: string[];
  /** То, что лист прячет под «Подробнее» (закрыто по умолчанию), пунктами. */
  more?: string[];
}

export interface ModeGuide extends GuideVoiceFields {
  modeId: string;
  /** Цель работы одной строкой: плашка «Обычно в методе» и «Взять за основу». */
  goal: string;
  /** Что это за режим и чем он отличается от похожих. */
  what: string;
  /** Работа по четырём каналам схема-терапии; пустой канал не показывается. */
  relationship?: string;
  cognitive?: string;
  experiential?: string;
  behavioral?: string;
  /** «На сессии»: 2–5 техник по важности. */
  techniques: TechniqueId[];
  /** «Между сессиями»: 1–4 пункта. */
  betweenSessions: BetweenSessionsItem[];
  /** Где застревают. */
  stuck?: string;
  /** Источники раздела: «[Арнтц, 4.1.1], [Кембридж, гл. 6]». */
  sources: string;
}

export interface TechniqueGuide extends GuideVoiceFields {
  id: TechniqueId;
  name: string;
  /** Одна строка: что это и зачем. */
  summary: string;
  /** Когда применять. */
  when?: string;
  /** Как проводить, по шагам. */
  steps: string[];
  /** Когда не делать и где буксует. */
  cautions?: string;
  /** Доказательность, одной-двумя фразами. */
  evidence?: string;
  sources: string;
}

/** Копинг схемы тремя стилями. */
export interface SchemaCoping {
  /** Капитуляция: живёт так, будто схема права. */
  surrender: string;
  /** Избегание: не допускает активации. */
  avoidance: string;
  /** Гиперкомпенсация: действует так, будто верно обратное. */
  overcompensation: string;
}

export interface SchemaGuide extends GuideVoiceFields {
  /** id из shared/src/schemaTherapy/content/schemaDomains.ts. */
  schemaId: string;
  /** Что строим вместо схемы, одной фразой: плашка «Обычно в методе». */
  goal: string;
  /** Суть: во что верит человек и откуда это. */
  essence: string;
  /** Какая потребность не закрыта. */
  need: string;
  coping: SchemaCoping;
  /** Типичные режимы (id из modeGroups.ts). */
  modeIds: string[];
  /** Как схема выглядит в кабинете: триггеры в отношениях с терапевтом. */
  inSession: string;
  /** Фраза ограниченного репарентинга — реплика терапевта, через tr; на листе это «Как это звучит». */
  reparenting: string;
  /** Интервенции пунктами, 2–6. */
  interventions: string[];
  /** «На сессии»: 2–5 техник по важности. */
  techniques: TechniqueId[];
  /** «Между сессиями»: 1–4 пункта. */
  betweenSessions: BetweenSessionsItem[];
  /** Где застревают. */
  stuck?: string;
  sources: string;
}

/** Домен схем: общее для всех его схем и сами схемы. */
export interface SchemaDomainGuide {
  /** id домена из schemaDomains.ts. */
  domainId: string;
  /** «Общее для домена», 1–3 фразы. */
  note: string;
  schemas: SchemaGuide[];
}

/**
 * Раздел «Для терапевта» в «Справочнике»: частые ошибки, тупики, свои
 * схемы терапевта, групповой формат, намеренная практика.
 */
export interface PracticeNote {
  /** Латиница, уникален: ключ раздела в списке. */
  id: string;
  title: string;
  /** Абзацы или пункты, 1–6, каждый 1–3 фразы. */
  paragraphs: string[];
  sources: string;
}

export type ModeGuideBuilder = (tr: Tr) => ModeGuide[];
export type PracticeNotesBuilder = (tr: Tr) => PracticeNote[];
export type SchemaDomainGuideBuilder = (tr: Tr) => SchemaDomainGuide;
export type TechniqueGuideBuilder = (tr: Tr) => TechniqueGuide[];
export type { Tr };
