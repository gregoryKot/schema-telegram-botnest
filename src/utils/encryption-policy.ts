// ЕДИНСТВЕННЫЙ реестр решений о шифровании (правило №4 CLAUDE.md: два места,
// обязанные совпадать, — в одно). Раньше жил внутри encryption-coverage.spec.ts
// и был недоступен рантайму; экспорту (data-export.service.ts) нужно знать в
// рантайме, какое поле расшифровывать — вынесено сюда, спек импортирует
// реестр обратно и продолжает падать на неклассифицированном поле так же,
// как раньше (поведение спека не изменилось, изменился только адрес импорта).
const BOT = 'src/bot';
const TH = 'src/therapy';

export type Policy = { enc: string } | { plain: string };
export const enc = (file: string): Policy => ({ enc: file });
export const plain = (reason: string): Policy => ({ plain: reason });

export const ID = plain('идентификатор/enum/дата — не свободный текст');
export const DATE = plain('дата YYYY-MM-DD, не контент');
export const TOKEN = plain('криптографический токен/хэш, PII не содержит');

export const FIELD_POLICY: Record<string, Record<string, Policy>> = {
  Rating: { date: DATE, needId: ID },
  YsqProgress: { answers: enc(`${BOT}/ysq.service.ts`) },
  User: {
    firstName: plain('имя из Telegram-профиля; публично в Telegram'),
    notifyTimezone: ID,
    notifyNextRemindDate: DATE,
    notifySkipAckDate: DATE,
    notifyLastEvalDate: DATE,
    addressForm: plain("'ty'|'vy' — настройка обращения"),
    mySchemaIds: enc(`${BOT}/bot.service.ts`),
    myModeIds: enc(`${BOT}/bot.service.ts`),
    themePref: ID,
    onboardingSkipped: plain('id шагов онбординга'),
    lastCelebrationDate: DATE,
    lastYesterdayBannerDate: DATE,
    lastWeeklyQuestionWeek: DATE,
    schemaIntrosShown: plain('id просмотренных интро (не выбор «моих» схем)'),
    modeIntrosShown: plain('id просмотренных интро (не выбор «моих» режимов)'),
    defaultSection: ID,
    totpSecret: enc('src/auth/totp.service.ts'),
    totpRecoveryCodes: enc('src/auth/totp.service.ts'),
    recoveryEmail: plain(
      '@unique + WHERE-лукап при восстановлении — недетерминированное ' +
        'шифрование сломает поиск; осознанный компромисс',
    ),
    uiPrefs: plain(
      'серверное зеркало кастомизации мини-аппа — плоский объект флагов/id ' +
        'из фиксированных реестров (SYNCED_PREF_KEYS: видимость/порядок ' +
        'блоков, фокус-практика), свободный текст отсекает sanitizeUiPrefs ' +
        '(src/api/ui-prefs.sanitize.ts)',
    ),
  },
  EmailToken: {
    id: ID,
    tokenHash: TOKEN,
    email: enc('src/auth/email.service.ts'),
    purpose: ID,
  },
  TherapistRequest: {
    fullName: enc(`${TH}/therapist-request.service.ts`),
    qualification: enc(`${TH}/therapist-request.service.ts`),
    contacts: enc(`${TH}/therapist-request.service.ts`),
    message: enc(`${TH}/therapist-request.service.ts`),
    rejectReason: plain('текст админа, не PII заявителя'),
  },
  DiaryDraft: { type: ID, data: enc('src/api/api.controller.ts') },
  AuthProvider: {
    provider: ID,
    providerId: plain(
      'лукап-ключ OAuth (для email-провайдера равен адресу) — ' +
        'шифрование сломает findUnique; осознанный компромисс',
    ),
    email: plain('дублирует providerId/OAuth-профиль — см. providerId'),
    displayName: plain('имя из OAuth-профиля, показывается в /account'),
  },
  LoginTicket: {
    id: ID,
    deviceCodeHash: TOKEN,
    userCodeHash: TOKEN,
    provider: ID,
    intent: ID,
    hostId: ID,
    // Класс устройства и браузер («iPhone · Safari»), собранные из User-Agent
    // без версий и сборок (device-label.ts). Живут пять минут и показываются
    // самому человеку при сверке — шифровать нечего, свободного текста нет.
    deviceLabel: plain(
      'класс устройства для сверки входа, без версий и сборок',
    ),
  },
  WebSession: {
    id: ID,
    tokenHash: TOKEN,
    // Хеш токена-наследника: по нему видно, пользовался ли им кто-нибудь.
    // Такой же непрозрачный хеш, как tokenHash, — шифровать нечего.
    replacedByHash: TOKEN,
    family: TOKEN,
    ipAddress: plain('security-телеметрия сессий («активные устройства»)'),
    userAgent: plain('security-телеметрия сессий («активные устройства»)'),
  },
  Note: {
    date: DATE,
    text: enc(`${BOT}/bot.service.ts`),
    tags: enc(`${BOT}/bot.service.ts`),
  },
  Pair: { code: TOKEN },
  UserPractice: { needId: ID, text: enc(`${BOT}/practices.service.ts`) },
  PracticeSession: {
    tool: plain(
      'перечислимый идентификатор быстрой практики (breathing|grounding|stop), ' +
        'не PII/не свободный текст',
    ),
  },
  PracticePlan: {
    needId: ID,
    practiceText: enc(`${BOT}/practices.service.ts`),
    scheduledDate: DATE,
  },
  YsqResult: { answers: enc(`${BOT}/ysq.service.ts`) },
  YsqResultHistory: { answers: enc(`${BOT}/ysq.service.ts`) },
  ChildhoodRating: { needId: ID },
  SchemaDiaryEntry: {
    trigger: enc(`${BOT}/diary.service.ts`),
    emotions: enc(`${BOT}/diary.service.ts`),
    thoughts: enc(`${BOT}/diary.service.ts`),
    bodyFeelings: enc(`${BOT}/diary.service.ts`),
    actualBehavior: enc(`${BOT}/diary.service.ts`),
    schemaIds: enc(`${BOT}/diary.service.ts`),
    schemaOrigin: enc(`${BOT}/diary.service.ts`),
    healthyView: enc(`${BOT}/diary.service.ts`),
    realProblems: enc(`${BOT}/diary.service.ts`),
    excessiveReactions: enc(`${BOT}/diary.service.ts`),
    healthyBehavior: enc(`${BOT}/diary.service.ts`),
  },
  ModeDiaryEntry: {
    modeId: enc(`${BOT}/diary.service.ts`),
    situation: enc(`${BOT}/diary.service.ts`),
    thoughts: enc(`${BOT}/diary.service.ts`),
    feelings: enc(`${BOT}/diary.service.ts`),
    bodyFeelings: enc(`${BOT}/diary.service.ts`),
    actions: enc(`${BOT}/diary.service.ts`),
    actualNeed: enc(`${BOT}/diary.service.ts`),
    childhoodMemories: enc(`${BOT}/diary.service.ts`),
    healthyResponse: enc(`${BOT}/diary.service.ts`),
  },
  GratitudeDiaryEntry: { date: DATE, items: enc(`${BOT}/diary.service.ts`) },
  AppActivity: { date: DATE },
  AnalyticsEvent: {
    name: plain('allow-list имён событий (правило №8)'),
    meta: plain(
      'санитизируется allow-list полей, свободный текст/PII запрещены',
    ),
  },
  TherapyRelation: {
    code: TOKEN,
    clientAlias: enc(`${TH}/therapy-relations.service.ts`),
    virtualClientName: enc(`${TH}/therapy-relations.service.ts`),
    therapyStartDate: DATE,
    nextSession: DATE,
    meetingDays: plain('номера дней недели'),
  },
  UserTask: {
    type: ID,
    text: enc(`${TH}/therapy-tasks.service.ts`),
    needId: ID,
    dueDate: DATE,
  },
  TherapistNote: { date: DATE, text: enc(`${TH}/therapy-notes.service.ts`) },
  ClientConceptualization: {
    schemaIds: enc(`${TH}/therapy-notes.service.ts`),
    modeIds: enc(`${TH}/therapy-notes.service.ts`),
    earlyExperience: enc(`${TH}/therapy-notes.service.ts`),
    unmetNeeds: enc(`${TH}/therapy-notes.service.ts`),
    triggers: enc(`${TH}/therapy-notes.service.ts`),
    copingStyles: enc(`${TH}/therapy-notes.service.ts`),
    goals: enc(`${TH}/therapy-notes.service.ts`),
    currentProblems: enc(`${TH}/therapy-notes.service.ts`),
    modeTransitions: enc(`${TH}/therapy-notes.service.ts`),
    modeMapNodes: enc(`${TH}/therapy-notes.service.ts`),
    modeMapEdges: enc(`${TH}/therapy-notes.service.ts`),
    history: plain(
      'контейнер снапшотов; чувствительные поля каждого снапшота ' +
        'шифруются попольно (encryptConceptFields)',
    ),
  },
  TherapistCustomMode: {
    name: enc(`${TH}/mode-maps.service.ts`),
    emoji: ID,
    nodeType: ID,
  },
  ModeMap: {
    title: enc(`${TH}/mode-maps.service.ts`),
    kind: ID,
    nodes: enc(`${TH}/mode-maps.service.ts`),
    edges: enc(`${TH}/mode-maps.service.ts`),
  },
  UserSchemaNote: {
    schemaId: plain('лукап-ключ карточки (@@unique userId+schemaId)'),
    triggers: enc(`${BOT}/notes.service.ts`),
    feelings: enc(`${BOT}/notes.service.ts`),
    thoughts: enc(`${BOT}/notes.service.ts`),
    origins: enc(`${BOT}/notes.service.ts`),
    reality: enc(`${BOT}/notes.service.ts`),
    healthyView: enc(`${BOT}/notes.service.ts`),
    behavior: enc(`${BOT}/notes.service.ts`),
  },
  UserModeNote: {
    modeId: plain('лукап-ключ карточки (@@unique userId+modeId)'),
    triggers: enc(`${BOT}/notes.service.ts`),
    feelings: enc(`${BOT}/notes.service.ts`),
    thoughts: enc(`${BOT}/notes.service.ts`),
    needs: enc(`${BOT}/notes.service.ts`),
    origins: enc(`${BOT}/notes.service.ts`),
    healthyView: enc(`${BOT}/notes.service.ts`),
    behavior: enc(`${BOT}/notes.service.ts`),
    modeFunction: enc(`${BOT}/notes.service.ts`),
    needsMet: enc(`${BOT}/notes.service.ts`),
    alias: enc(`${BOT}/notes.service.ts`),
    fear: enc(`${BOT}/notes.service.ts`),
  },
  UserBeliefCheck: {
    belief: enc(`${BOT}/exercises.service.ts`),
    evidenceFor: enc(`${BOT}/exercises.service.ts`),
    evidenceAgainst: enc(`${BOT}/exercises.service.ts`),
    reframe: enc(`${BOT}/exercises.service.ts`),
  },
  UserPhraseCheck: {
    phrase: enc(`${BOT}/phrase-check.service.ts`),
    marks: plain(
      'перечисление id примет (PHRASE_MARK_IDS), свободного текста нет',
    ),
    rewrite: enc(`${BOT}/phrase-check.service.ts`),
  },
  UserLetter: { text: enc(`${BOT}/exercises.service.ts`) },
  UserSafePlace: { description: enc(`${BOT}/exercises.service.ts`) },
  UserFlashcard: {
    modeId: ID,
    needId: ID,
    reflection: enc(`${BOT}/exercises.service.ts`),
    action: enc(`${BOT}/exercises.service.ts`),
  },
  ScheduledNotification: {
    type: ID,
    payload: plain(
      'числовые агрегаты/needId для шаблонов, свободного текста нет',
    ),
  },
  AvailabilityRule: { timezone: ID },
  Booking: {
    clientName: enc('src/booking/booking.service.ts'),
    clientContact: enc('src/booking/booking.service.ts'),
    message: enc('src/booking/booking.service.ts'),
    cancelToken: TOKEN,
    meetingUrl: plain('ссылка на Zoom/Телемост, задаётся терапевтом'),
    calDavUid: ID,
    source: plain(
      'страница + referrer при брони — структурная атрибуция лида, не PII',
    ),
  },
  ClientMeeting: {
    clientKey: plain('sha256 от контакта — уже псевдонимизирован'),
    meetingUrl: plain('переиспользуемая ссылка на встречу'),
    zoomMeetingId: ID,
  },
  BookingSetting: {
    key: ID,
    value: plain('настройки модуля записи (цены и т.п.)'),
  },
  Donation: {
    source: ID,
    email: enc('src/donation/donation.service.ts'),
    comment: enc('src/donation/donation.service.ts'),
  },
  Subscription: {
    period: ID,
    email: enc('src/subscription/subscription.service.ts'),
    cancelToken: TOKEN,
  },
  Article: {
    slug: ID,
    title: plain('публичный контент сайта'),
    description: plain('публичный контент сайта'),
    content: plain('публичный контент сайта'),
    heroImage: ID,
    diagramKey: ID,
  },
  HealthyAdultPhrase: { text: plain('контент проекта, не данные юзера') },
  HealthyAdultPost: {
    text: plain('контент проекта, не данные юзера'),
    source: plain('контент проекта, не данные юзера'),
  },
  ChannelDelivery: {
    source: plain('слот публикации: утро/вечер/вручную/проверка'),
    platform: plain('ключ площадки: telegram/vk/max'),
    destination: plain('id канала проекта, не пользовательские данные'),
    reason: plain(
      'текст ошибки площадки — техническая диагностика, не данные юзера',
    ),
    text: plain('фраза канала — контент проекта, не данные юзера'),
  },
  CronLease: {
    name: plain('имя расписания (midnightPlanner и т.п.), не данные юзера'),
    instanceId: plain(
      'имя процесса-лидера из HOSTNAME — нужно, чтобы по строке было видно, ' +
        'какой инстанс забрал прогон; пользователя в ней нет',
    ),
  },
};
