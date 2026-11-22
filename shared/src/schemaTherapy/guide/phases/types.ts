import type { GuideVoiceFields, TechniqueId, Tr } from '../types';

/**
 * Лист вкладки «Путь терапии»: условная фаза схема-терапии. Порядок листов —
 * порядок фаз (PHASE_BUILDERS), он и есть содержание вкладки; первый лист —
 * обзор пути. Пустой раздел лист не рисует.
 */
export interface PhaseGuide extends GuideVoiceFields {
  /** Латиница, уникален: ключ листа и адрес раздела. */
  id: string;
  name: string;
  /** Суть фазы одной строкой: под названием в ленте. */
  goal: string;
  /** Что происходит в этой фазе, одним абзацем — под заголовком листа. */
  essence: string;
  /** Сколько длится и от чего это зависит. */
  timing?: string;
  /** Задачи фазы. */
  tasks?: string[];
  /** Позиция терапевта и ограниченное родительство в этой фазе. */
  stance?: string;
  /** Режимы в фокусе (id из modeGroups.ts). */
  modeIds?: string[];
  /** Типичные техники фазы, по важности. */
  techniques?: TechniqueId[];
  /** Листы «Для терапевта» по теме фазы (id заметок PracticeNote). */
  noteIds?: string[];
  /** Признаки, что пора к следующей фазе. */
  transition?: string[];
  /** Где книги расходятся. */
  variants?: string[];
  /** Где застревают. */
  stuck?: string;
  sources: string;
}

export type PhaseGuideBuilder = (tr: Tr) => PhaseGuide;
