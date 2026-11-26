import type { GuideVoiceFields, TechniqueId, Tr } from '../types';

/**
 * Статья вкладки «Запросы и расстройства»: с чем приходят клиенты. Обязательны
 * только ключ, название, цель, суть и источники — у следующих запросов книга
 * может не дать курса, кризиса или форматов, и пустой раздел лист не рисует.
 */
export interface ConcernGuide extends GuideVoiceFields {
  /** Латиница, уникален: ключ листа, адрес раздела и знак. */
  id: string;
  name: string;
  /** Цель работы одной строкой: под названием в списке. */
  goal: string;
  /** Что это и как выглядит в жизни. */
  essence: string;
  /** Критерии диагноза своими словами (не таблицей из книги). */
  criteria?: string[];
  /** Откуда берётся: темперамент, детский опыт, привязанность. */
  origins?: string;
  /** Распространённость, спутники, что лечить первым. */
  comorbidity?: string[];
  /** С чем путают и когда диагноз другой. */
  differential?: string[];
  /** Типичные режимы (id из modeGroups.ts). */
  modeIds?: string[];
  /** Как режимы сменяют друг друга. */
  modeModel?: string;
  /** Типичные схемы (id из schemaDomains.ts). */
  schemaIds?: string[];
  /** Как выглядит в кабинете. */
  inSession?: string;
  /** Контракт, фазы, структура, завершение. */
  course?: string[];
  /** План на кризис, самоповреждение, связь между сессиями. */
  crisis?: string[];
  /** Терапевтические отношения при этом запросе. */
  relationship?: string[];
  /** Что и как рассказать клиенту. */
  psychoeducation?: string[];
  /** Группа, стационар, пары и другие форматы. */
  formats?: string[];
  /** Исследования: с автором и годом. */
  evidence?: string[];
  /** «На сессии»: 2–6 техник по важности. */
  techniques?: TechniqueId[];
  /** Частые трудности и ошибки терапевта. */
  stuck?: string;
  sources: string;
}

export type ConcernGuideBuilder = (tr: Tr) => ConcernGuide;
