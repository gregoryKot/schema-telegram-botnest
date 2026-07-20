// Форматтеры продуктовых метрик для /stats (правило №8). Чистые функции —
// покрыты тестом (включая пустую БД: отчёт не должен показывать NaN/мусор).
// Язык — простой, без терминов: понятно даже ребёнку.

export interface ProductMetrics {
  // Новички за месяц: сколько дошло до конца обучающего онбординга.
  onboarding: { cohort30: number; completed30: number };
  // Воронка обучения: сколько человек увидело каждый шаг (в порядке показа).
  onboardingSteps: Array<{ step: string; count: number }>;
  // Кто чем пользовался хоть раз (за всё время), число разных людей.
  adoption: {
    diaries: number;
    ysqDone: number;
    exercises: number;
    practices: number;
    childhood: number;
  };
  // Тест схем (YSQ): начали → дошли до конца.
  ysq: { started: number; completed: number };
  // Как просят обращаться.
  addressForm: { ty: number; vy: number; notChosen: number };
  // С каким экраном заходят (defaultSection): today/help/schemas/profile.
  sections: Array<{ key: string; count: number }>;
  // Оформление (themePref): светлое/тёмное/как в телефоне (null).
  themes: { light: number; dark: number; system: number };
  // Событийные метрики (таблица AnalyticsEvent, за месяц).
  // Делятся карточками: всего за неделю/месяц + разбивка по виду карточки.
  shareCard: {
    total7: number;
    total30: number;
    byKind30: Array<{ kind: string; count: number }>;
  };
  crisis: { shown: number; hotlineTapped: number };
  shareResult: { ok: number; fallback: number };
  outbox: { flushes: number; recovered: number };
  // Настройка экрана «Сегодня» и дыхание «Здесь и сейчас» (за месяц).
  today: {
    focusChanged: number;
    // Сколько раз прятали каждый блок (цитата, счётчик серии и т.д.).
    blocksHidden: Array<{ block: string; count: number }>;
    // Как открывали «Настроить экран»: шестерёнкой и долгим нажатием.
    customizeGear: number;
    customizeLongpress: number;
  };
  breath: { started: number };
  // Значок на экране телефона (за месяц): предлагали / что ответили.
  homeScreen: {
    shown: number;
    add: number;
    later: number;
    never: number;
    added: number;
  };
}

const pct = (part: number, whole: number): string =>
  whole === 0 ? '' : ` (${Math.round((part / whole) * 100)}%)`;

const SECTION_LABELS: Record<string, string> = {
  today: 'Сегодня',
  help: 'Помощь',
  schemas: 'Схемы',
  profile: 'Профиль',
};

// Понятные подписи видов карточек (meta.kind) — без англицизмов.
const SHARE_KIND_LABELS: Record<string, string> = {
  streak: '🔥 сколько дней подряд',
  weekly: '📅 итоги недели',
  day: '☀️ карточка дня',
  achievement: '🏆 награда',
  schema: '🧩 схема',
  diary: '📔 дневник',
  ysq: '📋 тест схем',
  mode: '🎭 режим',
  pair_invite: '🤝 приглашение в пару',
  month: '🗓 итоги месяца',
  achievements: '🏅 все награды разом',
  phrase: '💬 фраза поддержки',
  gratitude: '🌱 благодарность',
};

// Подписи блоков главного экрана — словами пользователя, не ключами.
const TODAY_BLOCK_LABELS: Record<string, string> = {
  streak: '🔥 счётчик дней подряд',
  phrase: '💬 цитата',
  secondary: '🗂 «что ещё можно сегодня»',
  therapist_banner: '🧑‍⚕️ баннер кабинета',
};

// Подписи шагов обучения — тем же простым языком, каким шаг звучит для юзера.
const ONBOARDING_STEP_LABELS: Record<string, string> = {
  welcome: 'поздоровались',
  privacy: 'что будет с записями',
  not_therapy: 'это не терапия',
  needs_what: 'что за пять потребностей',
  needs_why: 'зачем отмечать',
  needs_result: 'что увидят через 3–5 дней',
  today_screen: 'главный экран под себя',
  author: 'об авторе',
  home_screen: 'значок на телефон',
  done: 'дошли до конца',
};

/** Собирает все продуктовые блоки /stats простыми словами. Чистая функция. */
export function formatProductMetrics(m: ProductMetrics): string {
  const sections =
    m.sections.length === 0
      ? 'пока нет данных'
      : m.sections
          .map((s) => `${SECTION_LABELS[s.key] ?? s.key}: ${s.count}`)
          .join(' · ');

  return [
    `🎓 <b>Новички проходят обучение</b> (за месяц)`,
    `Дошли до конца: ${m.onboarding.completed30} из ${m.onboarding.cohort30}${pct(
      m.onboarding.completed30,
      m.onboarding.cohort30,
    )}`,
    m.onboardingSteps.length === 0
      ? 'Пока обучение никто не открывал'
      : 'Сколько человек увидело каждый экран: ' +
        m.onboardingSteps
          .map(
            (s) => `${ONBOARDING_STEP_LABELS[s.step] ?? s.step} — ${s.count}`,
          )
          .join(' · '),
    '',
    `🧩 <b>Кто чем пользуется</b> (за всё время, число людей)`,
    `Дневники: ${m.adoption.diaries} · Тест схем: ${m.adoption.ysqDone} · ` +
      `Упражнения: ${m.adoption.exercises} · Практики: ${m.adoption.practices} · ` +
      `Колесо детства: ${m.adoption.childhood}`,
    '',
    `📋 <b>Тест схем: доходят ли до конца</b>`,
    `Начали: ${m.ysq.started} · дошли до конца: ${m.ysq.completed}${pct(
      m.ysq.completed,
      m.ysq.started,
    )}`,
    '',
    `📱 <b>С каким экраном заходят</b>`,
    sections,
    '',
    `🗣 <b>Как просят обращаться</b>`,
    `На «ты»: ${m.addressForm.ty} · на «вы»: ${m.addressForm.vy} · ` +
      `ещё не выбрали: ${m.addressForm.notChosen}`,
    '',
    `🎨 <b>Оформление</b>`,
    `Светлое: ${m.themes.light} · тёмное: ${m.themes.dark} · ` +
      `как в телефоне: ${m.themes.system}`,
    '',
    `📣 <b>Делятся карточками</b> (за неделю: ${m.shareCard.total7}, за месяц: ${m.shareCard.total30})`,
    m.shareCard.byKind30.length === 0
      ? 'Пока никто не делился — это только начало 🙂'
      : 'Чем делятся (за месяц): ' +
        m.shareCard.byKind30
          .map((k) => `${SHARE_KIND_LABELS[k.kind] ?? k.kind} — ${k.count}`)
          .join(' · '),
    '',
    `💛 <b>Карточка помощи в трудный момент</b> (за месяц)`,
    `Показали: ${m.crisis.shown} · позвонили по телефону доверия: ${m.crisis.hotlineTapped}`,
    '',
    `📤 <b>Получилось ли поделиться картинкой</b> (за месяц)`,
    `Отправили картинку: ${m.shareResult.ok} · сохранили текстом: ${m.shareResult.fallback}`,
    '',
    `📦 <b>Спасли записи, сделанные без интернета</b> (за месяц)`,
    `Случаев: ${m.outbox.flushes} · записей вернули: ${m.outbox.recovered}`,
    '',
    `🎛 <b>Настраивают главный экран</b> (за месяц)`,
    `Сменили главную практику: ${m.today.focusChanged}`,
    `Заходили в настройку экрана: шестерёнкой ${m.today.customizeGear} · ` +
      `долгим нажатием ${m.today.customizeLongpress}`,
    m.today.blocksHidden.length === 0
      ? 'Блоки с главного пока не прятали'
      : 'Что прятали: ' +
        m.today.blocksHidden
          .map((b) => `${TODAY_BLOCK_LABELS[b.block] ?? b.block} — ${b.count}`)
          .join(' · '),
    '',
    `🌬 <b>Дыхание «Здесь и сейчас»</b> (за месяц)`,
    `Запускали: ${m.breath.started} раз`,
    '',
    `📲 <b>Значок приложения на экране телефона</b> (за месяц)`,
    m.homeScreen.shown === 0
      ? 'Пока никому не предлагали'
      : `Предложили: ${m.homeScreen.shown} · нажали «добавить»: ${m.homeScreen.add}` +
        `${pct(m.homeScreen.add, m.homeScreen.shown)}`,
    m.homeScreen.shown === 0
      ? ''
      : `Значок реально появился: ${m.homeScreen.added} · отложили: ${m.homeScreen.later} · ` +
        `попросили не предлагать: ${m.homeScreen.never}`,
  ].join('\n');
}
