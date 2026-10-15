// Список колонок, которые ротация ENCRYPTION_KEY перешифровывает общим циклом
// (rotate-all.ts). Пары (модель, поле) сверяет с реестром шифрования и со
// schema.prisma спек encryption-rotation-coverage.spec.ts (правило №4).
//
// `pk` — колонка(и) первичного ключа, если это не `id`. Составной ключ
// (@@id([userId, type])) задаётся массивом: ротация обновляет строку через
// updateMany с условием по всем колонкам ключа, поэтому от того, как Prisma
// называет составной аргумент (`userId_type`), она не зависит.
export interface RotationTarget {
  name: string;
  fields: string[];
  pk?: string | string[];
}

// (имя делегата Prisma, поля). Полноту проверяет спек по реестру FIELD_POLICY:
// зашифрованное поле, которого тут нет, осталось бы под старым ключом →
// потеря данных при удалении ENCRYPTION_KEY_OLD.
export const TARGETS: RotationTarget[] = [
  { name: 'note', fields: ['text', 'tags'] },
  {
    name: 'userSchemaNote',
    fields: [
      'triggers',
      'feelings',
      'thoughts',
      'origins',
      'reality',
      'healthyView',
      'behavior',
    ],
  },
  {
    name: 'userModeNote',
    fields: [
      'triggers',
      'feelings',
      'thoughts',
      'needs',
      'behavior',
      'modeFunction',
      'needsMet',
      'alias',
      'fear',
      'origins',
      'healthyView',
    ],
  },
  {
    name: 'userBeliefCheck',
    fields: ['belief', 'evidenceFor', 'evidenceAgainst', 'reframe'],
  },
  { name: 'userPhraseCheck', fields: ['phrase', 'rewrite'] },
  { name: 'userLetter', fields: ['text'] },
  { name: 'userSafePlace', fields: ['description'], pk: 'userId' },
  { name: 'userFlashcard', fields: ['reflection', 'action'] },
  { name: 'userPractice', fields: ['text'] },
  { name: 'practicePlan', fields: ['practiceText'] },
  {
    name: 'schemaDiaryEntry',
    fields: [
      'trigger',
      'emotions',
      'thoughts',
      'bodyFeelings',
      'actualBehavior',
      'schemaOrigin',
      'healthyView',
      'realProblems',
      'excessiveReactions',
      'healthyBehavior',
      'schemaIds',
    ],
  },
  {
    name: 'modeDiaryEntry',
    fields: [
      'modeId',
      'situation',
      'thoughts',
      'feelings',
      'bodyFeelings',
      'actions',
      'actualNeed',
      'childhoodMemories',
      'healthyResponse',
    ],
  },
  { name: 'gratitudeDiaryEntry', fields: ['items'] },
  // DiaryDraft.data — черновик дневника (тот же клинический текст, что запись).
  // Ключ составной: один черновик на тип дневника у пользователя.
  { name: 'diaryDraft', fields: ['data'], pk: ['userId', 'type'] },
  { name: 'userTask', fields: ['text'] },
  { name: 'therapistNote', fields: ['text'] },
  {
    name: 'clientConceptualization',
    // history — вложенный JSON-массив снапшотов, ротируется отдельным блоком
    // ниже (общий цикл трогает только строковые колонки).
    fields: [
      'earlyExperience',
      'unmetNeeds',
      'triggers',
      'copingStyles',
      'goals',
      'currentProblems',
      'modeTransitions',
      'schemaIds',
      'modeIds',
      'modeMapNodes',
      'modeMapEdges',
    ],
  },
  // ── Достроено аудитом 2026-07-20 (H4): целые модели, которые ротация
  //    пропускала → при удалении ENCRYPTION_KEY_OLD их данные превращались бы
  //    в мусор. Все перечисленные поля хранятся как зашифрованные строки
  //    (encrypt / encryptJson), поэтому общий строковый цикл их покрывает.
  {
    name: 'booking',
    // meetingUrl — Zoom-ссылка с `?pwd=` (D-9, аудит 2026-10).
    fields: ['clientName', 'clientContact', 'message', 'meetingUrl'],
  },
  { name: 'introLead', fields: ['clientName', 'clientContact', 'message'] },
  { name: 'clientMeeting', fields: ['meetingUrl'], pk: 'clientKey' },
  // AuthProvider.email/displayName — PII из OAuth-профиля (D-9, аудит 2026-10).
  { name: 'authProvider', fields: ['email', 'displayName'] },
  { name: 'donation', fields: ['email', 'comment'] },
  { name: 'subscription', fields: ['email'] },
  { name: 'modeMap', fields: ['title', 'nodes', 'edges'] },
  { name: 'therapistCustomMode', fields: ['name'] },
  {
    name: 'therapistRequest',
    fields: ['fullName', 'qualification', 'contacts', 'message'],
  },
  { name: 'therapyRelation', fields: ['virtualClientName', 'clientAlias'] },
  // ScheduledNotification.payload — целиком зашифрованная JSON-строка
  // (notification-payload.crypto.ts, аудит 2026-10, T1). Без этой строки после
  // удаления ENCRYPTION_KEY_OLD неотправленные уведомления не расшифровались бы,
  // а decryptPayload молча вернул бы null → «нечего слать». Старые строки с
  // объектом в payload общий цикл пропускает (typeof !== 'string').
  { name: 'scheduledNotification', fields: ['payload'] },
  // ── Добавлено ротацией 2026-10 (r2-0#2): эти поля шифровались, но в списке
  //    их не было. Ответы теста схем — Json-колонка, в которой лежит строка
  //    шифротекста (encryptJson), поэтому общий строковый цикл их покрывает.
  { name: 'ysqProgress', fields: ['answers'], pk: 'userId' },
  { name: 'ysqResult', fields: ['answers'], pk: 'userId' },
  { name: 'ysqResultHistory', fields: ['answers'] },
  { name: 'emailToken', fields: ['email'] },
  // User: клинические ярлыки (mySchemaIds/myModeIds) и 2FA-секреты. Раньше жили
  // отдельным блоком скрипта, который общий цикл дублировал; теперь это обычная
  // запись (H4, аудит 2026-07-20: без неё 2FA осталась бы под старым ключом).
  {
    name: 'user',
    fields: ['mySchemaIds', 'myModeIds', 'totpSecret', 'totpRecoveryCodes'],
  },
];
