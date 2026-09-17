// Реестр решений о выгрузке данных (право на переносимость, 152-ФЗ / GDPR
// art.15,20). Парный к src/bot/user-data-tables.ts (удаление) и
// src/auth/merge.service.ts (merge) — но с ДРУГИМ разрезом: не «какую таблицу
// зачистить», а «что человек ДОЛЖЕН увидеть в файле, а что осознанно
// withhold». Гейт (export-policy.spec.ts) требует классификации КАЖДОЙ модели
// с userId (то же множество, что в auth/table-registry.spec.ts), а не ищет
// признак — новая модель молча не проскочит ни экспортом, ни тишиной.
//
// `schema` — какие ИЗ enc-полей модели (по FIELD_POLICY, src/utils/
// encryption-policy.ts) реально расшифровываются перед выдачей; используется
// export-policy.spec.ts для сверки с FIELD_POLICY (правило №4: два места,
// обязанные совпадать, — под тестом) и data-export.service.ts для decryptRecord.
import type { EncryptSchema } from '../utils/crypto';
import { FIELD_POLICY } from '../utils/encryption-policy';

export type ExportDecision =
  | { status: 'export'; schema?: EncryptSchema }
  | { status: 'withhold'; reason: string };

export const EXPORT_POLICY: Record<string, ExportDecision> = {
  // ── Ядро: потребности/заметки/дневники/инструменты ────────────────────────
  Rating: { status: 'export' },
  ChildhoodRating: { status: 'export' },
  AppActivity: { status: 'export' },
  Note: { status: 'export', schema: { strings: ['text', 'tags'] } },
  UserSchemaNote: {
    status: 'export',
    schema: {
      strings: [
        'triggers',
        'feelings',
        'thoughts',
        'origins',
        'reality',
        'healthyView',
        'behavior',
      ],
    },
  },
  UserModeNote: {
    status: 'export',
    schema: {
      strings: [
        'triggers',
        'feelings',
        'thoughts',
        'needs',
        'origins',
        'healthyView',
        'behavior',
        'modeFunction',
        'needsMet',
        'alias',
        'fear',
      ],
    },
  },
  UserBeliefCheck: {
    status: 'export',
    schema: {
      strings: ['belief', 'evidenceFor', 'evidenceAgainst', 'reframe'],
    },
  },
  UserPhraseCheck: {
    status: 'export',
    schema: { strings: ['phrase', 'rewrite'] },
  },
  UserLetter: { status: 'export', schema: { strings: ['text'] } },
  UserSafePlace: { status: 'export', schema: { strings: ['description'] } },
  UserFlashcard: {
    status: 'export',
    schema: { strings: ['reflection', 'action'] },
  },
  UserPractice: { status: 'export', schema: { strings: ['text'] } },
  PracticePlan: { status: 'export', schema: { strings: ['practiceText'] } },
  PracticeSession: { status: 'export' },
  UserTask: { status: 'export', schema: { strings: ['text'] } },
  ScheduledNotification: { status: 'export' },
  // ── YSQ (тест схем) — ответы лежат зашифрованным JSON-блобом ──────────────
  YsqProgress: { status: 'export', schema: { jsonArrays: ['answers'] } },
  YsqResult: { status: 'export', schema: { jsonArrays: ['answers'] } },
  YsqResultHistory: { status: 'export', schema: { jsonArrays: ['answers'] } },
  // ── Дневники ───────────────────────────────────────────────────────────
  SchemaDiaryEntry: {
    status: 'export',
    schema: {
      strings: [
        'trigger',
        'thoughts',
        'bodyFeelings',
        'actualBehavior',
        'schemaOrigin',
        'healthyView',
        'realProblems',
        'excessiveReactions',
        'healthyBehavior',
      ],
      jsonArrays: ['emotions', 'schemaIds'],
    },
  },
  ModeDiaryEntry: {
    status: 'export',
    schema: {
      strings: [
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
  },
  GratitudeDiaryEntry: {
    status: 'export',
    schema: { jsonArrays: ['items'] },
  },
  DiaryDraft: { status: 'export', schema: { jsonArrays: ['data'] } },
  // ── Аналитика о собственных действиях (не путать с /stats-агрегатами) ────
  AnalyticsEvent: { status: 'export' },
  // ── Входы: какие способы входа привязаны (НЕ токены/сессии — см. withhold) ─
  AuthProvider: { status: 'export' },
  // Заявка на роль терапевта — собственный текст заявителя о себе, не секрет
  // входа. rejectReason — комментарий админа, оставляем как есть (не PII заявителя).
  TherapistRequest: {
    status: 'export',
    schema: {
      strings: ['fullName', 'qualification', 'contacts', 'message'],
    },
  },

  // ── WITHHOLD: секреты входа — файл выгрузки утекает легче, чем БД ─────────
  EmailToken: {
    status: 'withhold',
    reason:
      'токен входа по magic-link (email/подтверждение) — выдача его в файле ' +
      'экспорта была бы равносильна выдаче одноразового пароля от аккаунта',
  },
  LoginTicket: {
    status: 'withhold',
    reason:
      'код входа/привязки устройства (device-code) — короткоживущий секрет ' +
      'входа, попадание в файл экспорта = угон сессии входа',
  },
  WebSession: {
    status: 'withhold',
    reason:
      'refresh-токены веб-сессий (хеши) — выдача в экспорте позволила бы ' +
      'восстановить/угадать активную сессию входа на другом устройстве',
  },
};

// Модели вне EXPORT_POLICY, но упомянутые здесь ОСОЗНАННО — не userId-модели
// (см. src/auth/table-registry.spec.ts, раздел OTHER_MODELS), поэтому вне
// гейта этого файла: субъект (User, свои безопасные поля собирает
// data-export.service.ts явным select) и данные, у которых нет связи с User
// (Booking/Donation/ClientMeeting — см. withheld-список в самом экспорте).

// ── Поля самого субъекта (модель User) ─────────────────────────────────────
// Явный список, а не «все колонки минус секреты»: новая колонка не попадёт в
// файл, пока её сюда не внесли, поэтому молчаливая утечка нового секрета
// невозможна. Обратная сторона — новая ОБЫЧНАЯ настройка так же молча не
// попадёт, и человек недосчитается своих данных, не узнав об этом. Поэтому
// список под сверкой: export-policy.spec.ts требует, чтобы каждое скалярное
// поле User было либо здесь, либо в WITHHELD_USER_FIELDS с причиной.
export const USER_EXPORT_SELECT = {
  id: true,
  createdAt: true,
  firstName: true,
  role: true,
  disclaimerAccepted: true,
  addressForm: true,
  // Настройки уведомлений вместе со счётчиками движка: по ним видно, почему
  // сообщения приходят с такой частотой — это тоже данные о человеке.
  notifyEnabled: true,
  notifyLocalHour: true,
  notifyTimezone: true,
  notifyReminderEnabled: true,
  notifyFrequency: true,
  notifyAdaptiveLevel: true,
  notifyIgnoredCount: true,
  notifyNextRemindDate: true,
  notifySkipAckDate: true,
  notifyLastEvalDate: true,
  notifyReminderSeq: true,
  notifyQuietStart: true,
  notifyQuietEnd: true,
  notifyGamified: true,
  notifyPausedUntil: true,
  pairCardDismissed: true,
  mySchemaIds: true,
  myModeIds: true,
  therapistShareCards: true,
  therapistShareProfile: true,
  therapistMode: true,
  themePref: true,
  defaultSection: true,
  uiPrefs: true,
  // Пройденные шаги и закрытые подсказки — состояние интерфейса человека.
  onboardingV1Done: true,
  onboardingV2Done: true,
  onboardingSkipped: true,
  practicesOnboardingDone: true,
  childhoodWheelDone: true,
  trackerOnboardingDone: true,
  ysqBannerDismissed: true,
  hintSheetCloseShown: true,
  hintHistoryDismissed: true,
  schemaIntrosShown: true,
  modeIntrosShown: true,
  lastCelebrationDate: true,
  lastYesterdayBannerDate: true,
  lastWeeklyQuestionWeek: true,
  recoveryEmail: true,
  recoveryEmailVerifiedAt: true,
  totpEnabledAt: true,
  botBlockedAt: true,
  deletedAt: true,
} as const;

/** Поля User, которых в файле нет, и почему. Причина уезжает в сам экспорт. */
export const WITHHELD_USER_FIELDS: Record<string, string> = {
  totpSecret: 'секрет второго фактора — пускает в аккаунт в обход пароля',
  totpRecoveryCodes:
    'запасные коды второго фактора — то же самое, только на несколько входов',
  totpLastStep:
    'служебный счётчик защиты от повтора кода TOTP — не данные человека',
};

// ── Самопроверка перед выдачей (правило №4 CLAUDE.md) ──────────────────────
// Набор полей, которые export-policy расшифровывает, обязан СОВПАДАТЬ с
// enc-полями модели по FIELD_POLICY (единственный источник правды о
// шифровании). Рассинхрон — это зашифрованный мусор вместо дневника в файле
// человека, поэтому проверка живёт и в рантайме, а не только в спеке.
//
// Зовётся сервисом на каждую выгрузку, а НЕ при загрузке модуля: расхождение
// определяется одним лишь исходником, CI ловит его детерминированно, и ронять
// из-за него весь процесс — значит гасить бота, уведомления и сайт целиком
// ради одной фичи. Радиус отказа равен сломанному месту: падает выгрузка.
export function assertSyncedWithEncryptionPolicy(): void {
  const broken: string[] = [];
  for (const [model, decision] of Object.entries(EXPORT_POLICY)) {
    if (decision.status !== 'export') continue;
    const declared = new Set([
      ...(decision.schema?.strings ?? []),
      ...(decision.schema?.jsonArrays ?? []),
    ]);
    const encFields = Object.entries(FIELD_POLICY[model] ?? {})
      .filter(([, p]) => 'enc' in p)
      .map(([f]) => f);
    for (const f of encFields) {
      if (!declared.has(f)) broken.push(`${model}.${f}`);
    }
  }
  if (broken.length) {
    throw new Error(
      'export-policy рассинхронизирован с FIELD_POLICY (шифруется, но не ' +
        `расшифровывается при экспорте): ${broken.join(', ')}`,
    );
  }
}
