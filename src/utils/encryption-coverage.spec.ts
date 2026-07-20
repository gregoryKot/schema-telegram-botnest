// Принудитель покрытия шифрования (аудит 2026-07-20, парный к
// auth/table-registry.spec.ts, который так же принуждает реестры удаления/merge).
//
// Правило CLAUDE.md «Шифрование» держалось на честном слове — и дало течь:
// черновики дневников (DiaryDraft.data), ответы YSQ, заявки терапевтов,
// алиасы клиентов и email в magic-link токенах лежали plaintext, хотя весь
// остальной свободный текст шифруется. Правило без механизма принуждения
// не работает.
//
// Механизм: каждое String/Json-поле каждой модели schema.prisma обязано быть
// явно классифицировано здесь — либо `enc` (шифруется; значение — файл
// сервиса, где живёт encrypt, наличие проверяется), либо `plain` (осознанный
// plaintext; значение — причина). Новое неклассифицированное поле роняет
// этот тест → добавление колонки со свободным текстом без решения о
// шифровании невозможно.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

type Policy = { enc: string } | { plain: string };
const e = (file: string): Policy => ({ enc: file });
const p = (reason: string): Policy => ({ plain: reason });

const BOT = 'src/bot';
const TH = 'src/therapy';
const ID = p('идентификатор/enum/дата — не свободный текст');
const DATE = p('дата YYYY-MM-DD, не контент');
const TOKEN = p('криптографический токен/хэш, PII не содержит');

// ЕДИНСТВЕННЫЙ реестр решений о шифровании. Меняешь схему — обнови и его.
const FIELD_POLICY: Record<string, Record<string, Policy>> = {
  Rating: { date: DATE, needId: ID },
  YsqProgress: { answers: e(`${BOT}/ysq.service.ts`) },
  User: {
    firstName: p('имя из Telegram-профиля; публично в Telegram'),
    notifyTimezone: ID,
    notifyNextRemindDate: DATE,
    notifySkipAckDate: DATE,
    notifyLastEvalDate: DATE,
    addressForm: p("'ty'|'vy' — настройка обращения"),
    mySchemaIds: e(`${BOT}/bot.service.ts`),
    myModeIds: e(`${BOT}/bot.service.ts`),
    themePref: ID,
    onboardingSkipped: p('id шагов онбординга'),
    lastCelebrationDate: DATE,
    lastYesterdayBannerDate: DATE,
    lastWeeklyQuestionWeek: DATE,
    schemaIntrosShown: p('id просмотренных интро (не выбор «моих» схем)'),
    modeIntrosShown: p('id просмотренных интро (не выбор «моих» режимов)'),
    defaultSection: ID,
    totpSecret: e('src/auth/totp.service.ts'),
    totpRecoveryCodes: e('src/auth/totp.service.ts'),
    recoveryEmail: p(
      '@unique + WHERE-лукап при восстановлении — недетерминированное ' +
        'шифрование сломает поиск; осознанный компромисс',
    ),
  },
  EmailToken: {
    id: ID,
    tokenHash: TOKEN,
    email: e('src/auth/email.service.ts'),
    purpose: ID,
  },
  TherapistRequest: {
    fullName: e(`${TH}/therapist-request.service.ts`),
    qualification: e(`${TH}/therapist-request.service.ts`),
    contacts: e(`${TH}/therapist-request.service.ts`),
    message: e(`${TH}/therapist-request.service.ts`),
    rejectReason: p('текст админа, не PII заявителя'),
  },
  DiaryDraft: { type: ID, data: e('src/api/api.controller.ts') },
  AuthProvider: {
    provider: ID,
    providerId: p(
      'лукап-ключ OAuth (для email-провайдера равен адресу) — ' +
        'шифрование сломает findUnique; осознанный компромисс',
    ),
    email: p('дублирует providerId/OAuth-профиль — см. providerId'),
    displayName: p('имя из OAuth-профиля, показывается в /account'),
  },
  WebSession: {
    id: ID,
    tokenHash: TOKEN,
    family: TOKEN,
    ipAddress: p('security-телеметрия сессий («активные устройства»)'),
    userAgent: p('security-телеметрия сессий («активные устройства»)'),
  },
  Note: {
    date: DATE,
    text: e(`${BOT}/bot.service.ts`),
    tags: e(`${BOT}/bot.service.ts`),
  },
  Pair: { code: TOKEN },
  UserPractice: { needId: ID, text: e(`${BOT}/practices.service.ts`) },
  PracticePlan: {
    needId: ID,
    practiceText: e(`${BOT}/practices.service.ts`),
    scheduledDate: DATE,
  },
  YsqResult: { answers: e(`${BOT}/ysq.service.ts`) },
  YsqResultHistory: { answers: e(`${BOT}/ysq.service.ts`) },
  ChildhoodRating: { needId: ID },
  SchemaDiaryEntry: {
    trigger: e(`${BOT}/diary.service.ts`),
    emotions: e(`${BOT}/diary.service.ts`),
    thoughts: e(`${BOT}/diary.service.ts`),
    bodyFeelings: e(`${BOT}/diary.service.ts`),
    actualBehavior: e(`${BOT}/diary.service.ts`),
    schemaIds: e(`${BOT}/diary.service.ts`),
    schemaOrigin: e(`${BOT}/diary.service.ts`),
    healthyView: e(`${BOT}/diary.service.ts`),
    realProblems: e(`${BOT}/diary.service.ts`),
    excessiveReactions: e(`${BOT}/diary.service.ts`),
    healthyBehavior: e(`${BOT}/diary.service.ts`),
  },
  ModeDiaryEntry: {
    modeId: e(`${BOT}/diary.service.ts`),
    situation: e(`${BOT}/diary.service.ts`),
    thoughts: e(`${BOT}/diary.service.ts`),
    feelings: e(`${BOT}/diary.service.ts`),
    bodyFeelings: e(`${BOT}/diary.service.ts`),
    actions: e(`${BOT}/diary.service.ts`),
    actualNeed: e(`${BOT}/diary.service.ts`),
    childhoodMemories: e(`${BOT}/diary.service.ts`),
  },
  GratitudeDiaryEntry: { date: DATE, items: e(`${BOT}/diary.service.ts`) },
  AppActivity: { date: DATE },
  AnalyticsEvent: {
    name: p('allow-list имён событий (правило №8)'),
    meta: p('санитизируется allow-list полей, свободный текст/PII запрещены'),
  },
  TherapyRelation: {
    code: TOKEN,
    clientAlias: e(`${TH}/therapy-relations.service.ts`),
    virtualClientName: e(`${TH}/therapy-relations.service.ts`),
    therapyStartDate: DATE,
    nextSession: DATE,
    meetingDays: p('номера дней недели'),
  },
  UserTask: {
    type: ID,
    text: e(`${TH}/therapy-tasks.service.ts`),
    needId: ID,
    dueDate: DATE,
  },
  TherapistNote: { date: DATE, text: e(`${TH}/therapy-notes.service.ts`) },
  ClientConceptualization: {
    schemaIds: e(`${TH}/therapy-notes.service.ts`),
    modeIds: e(`${TH}/therapy-notes.service.ts`),
    earlyExperience: e(`${TH}/therapy-notes.service.ts`),
    unmetNeeds: e(`${TH}/therapy-notes.service.ts`),
    triggers: e(`${TH}/therapy-notes.service.ts`),
    copingStyles: e(`${TH}/therapy-notes.service.ts`),
    goals: e(`${TH}/therapy-notes.service.ts`),
    currentProblems: e(`${TH}/therapy-notes.service.ts`),
    modeTransitions: e(`${TH}/therapy-notes.service.ts`),
    modeMapNodes: e(`${TH}/therapy-notes.service.ts`),
    modeMapEdges: e(`${TH}/therapy-notes.service.ts`),
    history: p(
      'контейнер снапшотов; чувствительные поля каждого снапшота ' +
        'шифруются попольно (encryptConceptFields)',
    ),
  },
  TherapistCustomMode: {
    name: e(`${TH}/mode-maps.service.ts`),
    emoji: ID,
    nodeType: ID,
  },
  ModeMap: {
    title: e(`${TH}/mode-maps.service.ts`),
    kind: ID,
    nodes: e(`${TH}/mode-maps.service.ts`),
    edges: e(`${TH}/mode-maps.service.ts`),
  },
  UserSchemaNote: {
    schemaId: p('лукап-ключ карточки (@@unique userId+schemaId)'),
    triggers: e(`${BOT}/notes.service.ts`),
    feelings: e(`${BOT}/notes.service.ts`),
    thoughts: e(`${BOT}/notes.service.ts`),
    origins: e(`${BOT}/notes.service.ts`),
    reality: e(`${BOT}/notes.service.ts`),
    healthyView: e(`${BOT}/notes.service.ts`),
    behavior: e(`${BOT}/notes.service.ts`),
  },
  UserModeNote: {
    modeId: p('лукап-ключ карточки (@@unique userId+modeId)'),
    triggers: e(`${BOT}/notes.service.ts`),
    feelings: e(`${BOT}/notes.service.ts`),
    thoughts: e(`${BOT}/notes.service.ts`),
    needs: e(`${BOT}/notes.service.ts`),
    behavior: e(`${BOT}/notes.service.ts`),
  },
  UserBeliefCheck: {
    belief: e(`${BOT}/exercises.service.ts`),
    evidenceFor: e(`${BOT}/exercises.service.ts`),
    evidenceAgainst: e(`${BOT}/exercises.service.ts`),
    reframe: e(`${BOT}/exercises.service.ts`),
  },
  UserLetter: { text: e(`${BOT}/exercises.service.ts`) },
  UserSafePlace: { description: e(`${BOT}/exercises.service.ts`) },
  UserFlashcard: {
    modeId: ID,
    needId: ID,
    reflection: e(`${BOT}/exercises.service.ts`),
    action: e(`${BOT}/exercises.service.ts`),
  },
  ScheduledNotification: {
    type: ID,
    payload: p('числовые агрегаты/needId для шаблонов, свободного текста нет'),
  },
  AvailabilityRule: { timezone: ID },
  Booking: {
    clientName: e('src/booking/booking.service.ts'),
    clientContact: e('src/booking/booking.service.ts'),
    message: e('src/booking/booking.service.ts'),
    cancelToken: TOKEN,
    meetingUrl: p('ссылка на Zoom/Телемост, задаётся терапевтом'),
    calDavUid: ID,
  },
  ClientMeeting: {
    clientKey: p('sha256 от контакта — уже псевдонимизирован'),
    meetingUrl: p('переиспользуемая ссылка на встречу'),
    zoomMeetingId: ID,
  },
  BookingSetting: {
    key: ID,
    value: p('настройки модуля записи (цены и т.п.)'),
  },
  Donation: {
    source: ID,
    email: e('src/donation/donation.service.ts'),
    comment: e('src/donation/donation.service.ts'),
  },
  Subscription: {
    period: ID,
    email: e('src/subscription/subscription.service.ts'),
    cancelToken: TOKEN,
  },
  Article: {
    slug: ID,
    title: p('публичный контент сайта'),
    description: p('публичный контент сайта'),
    content: p('публичный контент сайта'),
    heroImage: ID,
    diagramKey: ID,
  },
  HealthyAdultPhrase: { text: p('контент проекта, не данные юзера') },
  HealthyAdultPost: {
    text: p('контент проекта, не данные юзера'),
    source: p('контент проекта, не данные юзера'),
  },
};

// ── Парсер schema.prisma: все String/Json-поля всех моделей ────────────────
function schemaFields(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema)) !== null) {
    const fields = [...m[2].matchAll(/^\s*(\w+)\s+(String|Json)\??(\s|$)/gm)];
    if (fields.length) out[m[1]] = fields.map((f) => f[1]);
  }
  return out;
}

describe('Реестр шифрования ↔ schema.prisma', () => {
  const models = schemaFields();

  it('sanity: парсер находит модели и текстовые поля', () => {
    expect(Object.keys(models).length).toBeGreaterThanOrEqual(35);
    expect(models.UserLetter).toEqual(['text']);
  });

  it('каждое String/Json-поле классифицировано (enc или plain с причиной)', () => {
    const missing: string[] = [];
    for (const [model, fields] of Object.entries(models)) {
      for (const f of fields) {
        if (!FIELD_POLICY[model]?.[f]) missing.push(`${model}.${f}`);
      }
    }
    // Новое поле → внеси в FIELD_POLICY: либо шифруй (enc + файл сервиса),
    // либо объясни, почему plaintext допустим. Молча — нельзя.
    expect(missing).toEqual([]);
  });

  it('реестр не содержит устаревших полей', () => {
    const stale: string[] = [];
    for (const [model, fields] of Object.entries(FIELD_POLICY)) {
      for (const f of Object.keys(fields)) {
        if (!models[model]?.includes(f)) stale.push(`${model}.${f}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('каждое enc-поле реально шифруется в указанном файле', () => {
    const broken: string[] = [];
    for (const [model, fields] of Object.entries(FIELD_POLICY)) {
      for (const [f, policy] of Object.entries(fields)) {
        if (!('enc' in policy)) continue;
        let src: string;
        try {
          src = readFileSync(join(ROOT, policy.enc), 'utf8');
        } catch {
          broken.push(`${model}.${f}: файла ${policy.enc} нет`);
          continue;
        }
        const quoted = src.includes(`'${f}'`) || src.includes(`"${f}"`);
        const assigned = new RegExp(`\\b${f}\\s*[:=]\\s*\\(?\\s*enc`).test(src);
        if (!/encrypt/.test(src) || (!quoted && !assigned))
          broken.push(`${model}.${f}: в ${policy.enc} не видно шифрования`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('каждое plain-поле имеет осмысленную причину', () => {
    const vague: string[] = [];
    for (const [model, fields] of Object.entries(FIELD_POLICY)) {
      for (const [f, policy] of Object.entries(fields)) {
        if ('plain' in policy && policy.plain.length < 10)
          vague.push(`${model}.${f}`);
      }
    }
    expect(vague).toEqual([]);
  });
});
