// Список колонок, которые ротация ENCRYPTION_KEY перешифровывает общим циклом
// (rotate-encryption-key.ts). Вынесен в отдельный файл (правило №10: скрипт
// упирался в потолок размера).
//
// Поле `pk` — имя ключевой колонки, если оно не `id` (ClientMeeting живёт под
// строковым clientKey).
export interface RotationTarget {
  name: string;
  fields: string[];
  pk?: string;
}

// (table prismaName, fields to rotate)
// ПОЛНОТА этого списка проверяется тестом
// src/utils/encryption-rotation-coverage.spec.ts — он падает, если в src/
// появилось зашифрованное поле, которого тут нет (иначе ротация оставит его
// под старым ключом → потеря данных при удалении ENCRYPTION_KEY_OLD).
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
    ],
  },
  {
    name: 'userBeliefCheck',
    fields: ['belief', 'evidenceFor', 'evidenceAgainst', 'reframe'],
  },
  { name: 'userPhraseCheck', fields: ['phrase', 'rewrite'] },
  { name: 'userLetter', fields: ['text'] },
  { name: 'userSafePlace', fields: ['description'] },
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
  // DiaryDraft.data — черновик дневника (тот же клинический текст, что запись),
  // шифруется encryptJson в api.controller. Присваивание `const data = …`, а не
  // свойство объекта, поэтому авто-сверка его не видит (см. spec).
  { name: 'diaryDraft', fields: ['data'] },
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
];
