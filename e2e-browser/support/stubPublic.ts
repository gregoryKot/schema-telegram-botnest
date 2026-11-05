// Публичные ручки сайта для браузерного смока — то, что сервер отдаёт гостю на
// свежей базе: цены и контент по умолчанию, env как на проде. Форма сверена с
// контроллерами (путь — у строки); квизы строит тот же код, что и сервер.
import { normalizeAddressForm } from '../../src/notification/address-form';
import { buildQuizzes } from '../../src/quiz/quiz-registry';

type Reply = (status: number, body: unknown) => Promise<void>;

const topics = (pairs: [string, string][]) =>
  pairs.map(([label, href]) => ({ label, href }));

/** Неизменные ответы по «МЕТОД /путь»; у всех статус 200 (GET и @HttpCode(200)). */
export const PUBLIC_FIXTURES: Record<string, unknown> = {
  // booking.controller.ts → PricingService.getOptions: SESSION_META
  // (booking.config.ts) с ценами по умолчанию (price-currency.ts).
  'GET /api/booking/options': [
    {
      type: 'INTRO_15',
      label: 'Знакомство',
      durationMin: 15,
      note: '15 минут · бесплатно',
      price: 0,
      prices: { RUB: 0, ILS: 0, EUR: 0, USD: 0 },
    },
    {
      type: 'SESSION_50',
      label: 'Сессия',
      durationMin: 50,
      note: '50 минут',
      price: 4000,
      prices: { RUB: 4000, ILS: 200, EUR: 65, USD: 70 },
    },
  ],
  // site-content.service.ts: на пустой базе — DEFAULT_TOPICS_A/B, фото нет.
  'GET /api/site-content': {
    heroPhoto: null,
    marqueeTopicsA: topics([
      ['Схема-терапия', '#approach'],
      ['Паттерны', '#approach'],
      ['Отношения', '#booking'],
      ['Самооценка', '#booking'],
      ['Тревога', '#booking'],
      ['Идентичность', '#approach'],
      ['КПТ', '#approach'],
      ['Бесплатное знакомство', '#booking'],
      ['Онлайн-сессии', '#prices'],
      ['Отзывы', '/reviews'],
    ]),
    marqueeTopicsB: topics([
      ['Безопасная среда', '#about'],
      ['Глубинная работа', '#approach'],
      ['Ранние убеждения', '#approach'],
      ['Режимы и схемы', '#approach'],
      ['Устойчивые изменения', '#approach'],
      ['Первая встреча бесплатно', '#booking'],
      ['Доказательный метод', '#approach'],
      ['Индивидуально', '#prices'],
      ['Работаю онлайн', '#prices'],
      ['Почему нет отзывов', '/reviews'],
    ]),
  },
  // subscription.controller.ts: автосписание выключено, пока не готово
  // (SUBSCRIPTION_ENABLED, docs/ENV.md); цены по умолчанию (booking.config.ts).
  'GET /api/subscription/options': {
    enabled: false,
    options: [
      { period: 'month', price: 500 },
      { period: 'year', price: 5000 },
    ],
  },
  // auth-ticket.controller.ts: билет входа (коды случайные — здесь любые
  // той же длины); пока вход никто не подтвердил, опрос отвечает pending.
  'POST /api/auth/ticket/start': {
    deviceCode: 'a'.repeat(64),
    userCode: 'K7M2Q9XP',
    expiresIn: 300,
    interval: 3,
  },
  'POST /api/auth/ticket/poll': { status: 'pending' },
};

/** Отвечает на публичную ручку; true — путь обработан. */
export async function handlePublicRoute(
  key: string,
  url: URL,
  reply: Reply,
): Promise<boolean> {
  // quiz.controller.ts: сайт для «ты» шлёт запрос без ?form, для «вы» — ?form=vy.
  if (key === 'GET /api/quizzes') {
    const form = normalizeAddressForm(url.searchParams.get('form'));
    await reply(200, { quizzes: buildQuizzes(form) });
    return true;
  }
  if (!(key in PUBLIC_FIXTURES)) return false;
  await reply(200, PUBLIC_FIXTURES[key]);
  return true;
}
