// Тест форматтера продуктовых метрик /stats (правило №8): простые слова,
// корректные проценты и — обязательно — пустая БД без NaN/мусора.
import { formatProductMetrics, ProductMetrics } from './product-metrics.format';

const FULL: ProductMetrics = {
  onboarding: { cohort30: 118, completed30: 70 },
  onboardingSteps: [
    { step: 'welcome', count: 100 },
    { step: 'not_therapy', count: 88 },
    { step: 'needs_what', count: 80 },
    { step: 'done', count: 70 },
  ],
  adoption: {
    diaries: 320,
    ysqDone: 210,
    exercises: 140,
    practices: 90,
    childhood: 60,
  },
  ysq: { started: 260, completed: 210 },
  addressForm: { ty: 900, vy: 250, notChosen: 90 },
  sections: [
    { key: 'today', count: 300 },
    { key: 'help', count: 80 },
    { key: 'schemas', count: 40 },
  ],
  themes: { light: 400, dark: 700, system: 140 },
  shareCard: {
    total7: 12,
    total30: 40,
    byKind30: [
      { kind: 'streak', count: 20 },
      { kind: 'schema', count: 3 },
    ],
  },
  crisis: { shown: 12, hotlineTapped: 3 },
  shareResult: { ok: 35, fallback: 5 },
  outbox: { flushes: 8, recovered: 21 },
  today: {
    focusChanged: 15,
    blocksHidden: [
      { block: 'streak', count: 7 },
      { block: 'phrase', count: 4 },
    ],
    customizeGear: 30,
    customizeLongpress: 12,
  },
  breath: { started: 33 },
};

const EMPTY: ProductMetrics = {
  onboarding: { cohort30: 0, completed30: 0 },
  onboardingSteps: [],
  adoption: {
    diaries: 0,
    ysqDone: 0,
    exercises: 0,
    practices: 0,
    childhood: 0,
  },
  ysq: { started: 0, completed: 0 },
  addressForm: { ty: 0, vy: 0, notChosen: 0 },
  sections: [],
  themes: { light: 0, dark: 0, system: 0 },
  shareCard: { total7: 0, total30: 0, byKind30: [] },
  crisis: { shown: 0, hotlineTapped: 0 },
  shareResult: { ok: 0, fallback: 0 },
  outbox: { flushes: 0, recovered: 0 },
  today: {
    focusChanged: 0,
    blocksHidden: [],
    customizeGear: 0,
    customizeLongpress: 0,
  },
  breath: { started: 0 },
};

describe('formatProductMetrics', () => {
  it('простыми словами, с процентами и человекочитаемыми экранами', () => {
    const t = formatProductMetrics(FULL);
    expect(t).toContain('Дошли до конца: 70 из 118 (59%)');
    // воронка обучения: подписи шагов простыми словами, в порядке показа
    expect(t).toContain('поздоровались — 100');
    expect(t).toContain('это не терапия — 88');
    expect(t).toContain('что за пять потребностей — 80');
    expect(t).toContain('дошли до конца — 70');
    expect(t.indexOf('поздоровались')).toBeLessThan(
      t.indexOf('что за пять потребностей'),
    );
    expect(t).not.toContain('needs_what');
    expect(t).toContain('Дневники: 320');
    expect(t).toContain('Начали: 260 · дошли до конца: 210 (81%)');
    // ключи секций переводятся в подписи
    expect(t).toContain('Сегодня: 300');
    expect(t).toContain('Помощь: 80');
    expect(t).not.toContain('today:');
    expect(t).toContain('На «ты»: 900 · на «вы»: 250');
    expect(t).toContain('как в телефоне: 140');
    expect(t).toContain('позвонили по телефону доверия: 3');
    expect(t).toContain('Отправили картинку: 35 · сохранили текстом: 5');
    expect(t).toContain('записей вернули: 21');
    // делятся карточками: итоги + подписи видов без англицизмов
    expect(t).toContain('за неделю: 12, за месяц: 40');
    expect(t).toContain('🔥 сколько дней подряд — 20');
    expect(t).toContain('🧩 схема — 3');
    expect(t).toContain('Сменили главную практику: 15');
    // как открывали настройку — видно, находят ли жест долгого нажатия
    expect(t).toContain('шестерёнкой 30 · долгим нажатием 12');
    // что прятали — человеческими подписями, не ключами
    expect(t).toContain('🔥 счётчик дней подряд — 7');
    expect(t).toContain('💬 цитата — 4');
    expect(t).not.toContain('therapist_banner');
    expect(t).toContain('Запускали: 33 раз');
    // никакого жаргона
    expect(t).not.toMatch(/YSQ|retention|adoption|event|toggle|focus/i);
  });

  it('пустая БД: без NaN и без «висящих» процентов', () => {
    const t = formatProductMetrics(EMPTY);
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('%'); // все знаменатели 0 → проценты не печатаются
    expect(t).toContain('Дошли до конца: 0 из 0');
    expect(t).toContain('пока нет данных'); // пустое распределение экранов
    expect(t).toContain('Пока никто не делился'); // пустой share_card
    expect(t).toContain('Пока обучение никто не открывал');
    expect(t).toContain('Блоки с главного пока не прятали');
  });
});
