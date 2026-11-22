import type { TechniqueId } from '../../../schemaTherapy/guide/techniqueIds';
import type { Tr } from '../../../needs/types';
import type { PhaseLookKey } from '../../../theme/pathLook';

/**
 * Шаблон пути клиента: упорядоченные фазы со сроками. Из шаблона собирается путь клиента (#1522) и лист
 * вкладки «Путь терапии» справочника — данные одни. Новый шаблон — файл рядом и строка в index.ts.
 */
export interface PathTemplatePhase {
  /** Латиница, уникален внутри шаблона. */
  id: string;
  name: string;
  goal: string;
  /** Что делает терапевт. */
  therapist: string;
  /** Позиция терапевта в этой фазе. */
  stance: string;
  /** Срок по умолчанию, недель: в пути клиента его правят. */
  weeks: number;
  /** Откуда срок: назван источником или условный ориентир шаблона. */
  weeksFrom: 'source' | 'estimate';
  /** Подсказка в сессиях, как в источнике: «сессии 1–6», «5–8 сессий». */
  sessionsHint?: string;
  /** Критерии перехода дальше: чек-лист, пункты без точки. */
  transition: string[];
  /** Частые ошибки фазы, пункты без точки. */
  mistakes: string[];
  /** Рекомендуемое из справочника: адреса разделов (`technique:…`, `mode:…`, `phase:…`, `note:…`). */
  recommended: string[];
  /** Этапы справочника (id листов вкладки «Путь терапии»), которым фаза соответствует. */
  guidePhaseIds: string[];
  /** Вид фазы: знак и оттенок стадии пути; в шаблоне ключи не повторяются и идут в порядке пути. */
  look: PhaseLookKey;
}

export interface PathTemplate {
  /** Латиница, уникален в реестре; хранится в пути клиента. */
  id: string;
  name: string;
  /** Для кого и на сколько — одной строкой. */
  summary: string;
  /** Откуда раскладка и как её читать. */
  essence: string;
  /** Общий срок и частота встреч. */
  timing: string;
  phases: PathTemplatePhase[];
  /** Оговорки: что в шаблоне практический вывод, а не слова источника. */
  caveats?: string[];
  sources: string;
}

export type PathTemplateBuilder = (tr: Tr) => PathTemplate;

/** Адрес главного раздела техники, режима, этапа справочника: чтобы id проверял tsc, а не глаз. */
export const techniqueRef = (id: TechniqueId): string =>
  `technique:${id}/summary`;
export const modeRef = (id: string): string => `mode:${id}/goal`;
export const phaseRef = (id: string, field = 'tasks'): string =>
  `phase:${id}/${field}`;
