import type {
  ConceptModeLink,
  ConceptSchemaLink,
  ConceptSnapshot,
} from '../apiTypes';
import type { ConceptNeedLink } from './conceptGraph/needLinks';
import type { UserId } from '../userId';

/**
 * Концептуализация клиента без карты режимов: сайт расширяет её узлами и рёбрами
 * карты (webapp/src/api.types.ts) — поля не пишутся дважды.
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
  /** Тексты схем графической концептуализации (legacy-строки — []). */
  schemaLinks: ConceptSchemaLink[];
  needLinks?: ConceptNeedLink[]; // колесо потребностей (needLinks.ts); нет у старого кэша
  history: ConceptSnapshot[];
  /** Когда терапевт показал клиенту схему случая; null — не показана (нет у старого кэша). */
  sharedWithClientAt?: string | null;
  updatedAt: string;
}

/**
 * Схема случая глазами клиента (GET /api/therapy/my-concept): только вид
 * «Схема» — без истоков (`origin`), задач терапии (`strategy`), рабочих полей
 * и истории. Белый список режет сервер (src/therapy/client-concept-view.ts).
 */
export interface ClientSharedConcept {
  schemaIds: string[];
  modeIds: string[];
  modeTransitions: string | null;
  modeLinks: Omit<ConceptModeLink, 'origin' | 'strategy'>[];
  schemaLinks: Omit<ConceptSchemaLink, 'origin'>[];
  sharedWithClientAt: string;
  updatedAt: string;
}
