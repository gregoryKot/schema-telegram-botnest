// DTO/типы ответов API мини-аппа. Общие с webapp типы — в shared/src/apiTypes
// (правило №3): единый источник; ре-экспортируются из api.ts.
import type { ClientConceptualizationBase } from '../../shared/src/therapy/clientConceptualization';
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

// В мини-аппе БЕЗ mode-map (фича только в webapp) — это общая часть как есть.
export type ClientConceptualization = ClientConceptualizationBase;
