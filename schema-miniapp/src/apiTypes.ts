// DTO/типы ответов API мини-аппа. Общие с webapp типы — в shared/src/apiTypes
// (правило №3): единый источник; ре-экспортируются из api.ts.
import type { ConceptSnapshot, UserId } from '../../shared/src/apiTypes';
export type {
  UserId,
  UserSettings,
  StreakData,
  Achievement,
  UserPractice,
  PartnerInfo,
  PairsData,
  PracticePlan,
  UserTask,
  TherapyRelationInfo,
  TherapistNote,
  ConceptSnapshot,
  YsqHistoryEntry,
  ClientData,
} from '../../shared/src/apiTypes';

// Единственная фронтовая копия — в shared (правило №3).
export type { TherapyClientSummary } from '../../shared/src/types';

// В мини-аппе БЕЗ mode-map (фича только в webapp) — поэтому остаётся локальным.
export interface ClientConceptualization {
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
  history: ConceptSnapshot[];
  updatedAt: string;
}
