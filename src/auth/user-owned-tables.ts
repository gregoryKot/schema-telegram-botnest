// Реестр таблиц, которые переносятся на новый userId при merge аккаунтов.
// Вынесен из merge.service.ts (правило №10 — сервис в долге по размеру, а
// реестр правится почти каждым PR с новой user-owned таблицей; отдельный
// файл ещё и разводит правки параллельных агентов, правило №13).
//
// Tables where a userId column points to User.id (BigInt).
// Discovered via grep on schema.prisma; if a new user-owned model is added,
// register its table name here. Order matters for FK dependencies on delete.
export const USER_OWNED_TABLES = [
  'Rating',
  'YsqProgress',
  'YsqResult',
  'YsqResultHistory',
  'Note',
  'UserSchemaNote',
  'UserModeNote',
  'UserBeliefCheck',
  'UserPhraseCheck',
  'UserLetter',
  'UserSafePlace',
  'UserFlashcard',
  'UserPractice',
  'PracticePlan',
  'PracticeSession',
  'ChildhoodRating',
  'ScheduledNotification',
  'SchemaDiaryEntry',
  'ModeDiaryEntry',
  'GratitudeDiaryEntry',
  'AppActivity',
  'UserTask',
  'DiaryDraft',
  'AnalyticsEvent',
  'TherapistRequest',
  'AuthProvider',
] as const;
// Note: Pair / TherapyRelation / TherapistNote / ClientConceptualization
// handled separately below — multi-column refs (therapistId/clientId/userId1/userId2).
