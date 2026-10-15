import type { ConceptModeLink, ConceptSnapshot } from '../apiTypes';
import type { UserId } from '../userId';

/**
 * Концептуализация клиента без карты режимов (mode-map): общая часть сайта и
 * мини-аппа. Мини-апп берёт её как есть, сайт расширяет узлами и рёбрами карты
 * своим ClientConceptualization (webapp/src/api.types.ts) — поля не пишутся
 * дважды, иначе новое поле (как modeLinks) доезжает копипастой.
 */
export interface ClientConceptualizationBase {
  id: number;
  therapistId: UserId;
  clientId: UserId;
  schemaIds: string[];
  modeIds: string[];
  earlyExperience: string | null;
  unmetNeeds: string | null;
  triggers: string | null;
  copingStyles: string | null;
  goals: string | null;
  currentProblems: string | null;
  modeTransitions: string | null;
  /** Связи режимов графической концептуализации (legacy-строки — []). */
  modeLinks: ConceptModeLink[];
  history: ConceptSnapshot[];
  updatedAt: string;
}
