// Версия концептуализации → поля для «Восстановить»: одна функция на оба
// фронтенда (раньше девять полей перечислялись инлайном в ConceptHistoryPanel
// мини-аппа). Пустые поля становятся '' — как в форме; связи графа
// переносятся только если снимок их хранил (старые снимки их не несли, и
// затирать текущий граф пустотой «восстановление» не должно).
import type {
  ConceptModeLink,
  ConceptSchemaLink,
  ConceptSnapshot,
} from '../apiTypes';

export interface RestoredConceptFields {
  schemaIds: string[];
  modeIds: string[];
  earlyExperience: string;
  unmetNeeds: string;
  triggers: string;
  copingStyles: string;
  goals: string;
  currentProblems: string;
  modeTransitions: string;
  modeLinks?: ConceptModeLink[];
  schemaLinks?: ConceptSchemaLink[];
}

export function snapshotToConceptFields(
  snap: ConceptSnapshot,
): RestoredConceptFields {
  return {
    schemaIds: snap.schemaIds ?? [],
    modeIds: snap.modeIds ?? [],
    earlyExperience: snap.earlyExperience ?? '',
    unmetNeeds: snap.unmetNeeds ?? '',
    triggers: snap.triggers ?? '',
    copingStyles: snap.copingStyles ?? '',
    goals: snap.goals ?? '',
    currentProblems: snap.currentProblems ?? '',
    modeTransitions: snap.modeTransitions ?? '',
    ...(snap.modeLinks ? { modeLinks: snap.modeLinks } : {}),
    ...(snap.schemaLinks ? { schemaLinks: snap.schemaLinks } : {}),
  };
}
