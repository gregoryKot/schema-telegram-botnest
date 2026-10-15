// Поверхность визитки kotlarewski.gr: что хост отдаёт сам, остальное 301 на
// канонический хост (см. practice-domain.middleware.ts, правило №19).

/** Страницы SPA визитки — зеркало `personalRoutes` в webapp/src/App.tsx (тест-сверка в спеке). */
export const PRACTICE_PAGES: readonly string[] = [
  '/',
  '/articles',
  '/reviews',
  '/admin',
  '/booking-admin',
  '/articles-admin',
  '/book', // ссылка для клиентов: расписание сразу (BookingLinkPage), не для поиска
  '/booking/paid',
  '/booking/manage',
  '/subscribe',
  '/donate',
  '/privacy',
  '/offer',
];
/** Префиксы страниц с параметром (`/articles/:slug`). */
export const PRACTICE_PAGE_PREFIXES: readonly string[] = ['/articles/'];

/** Ручки API (любой метод), которые зовут страницы визитки, каждая с причиной. Запись
 *  (POST/PATCH/DELETE) вне списка получает 301: браузер повторяет его как GET без
 *  тела, то есть алиас запись не принимает (аудит 2026-10, I1). */
export const PRACTICE_API_PREFIXES: readonly string[] = [
  '/api/booking', // запись на консультацию: options, slots, by-token, admin/*
  '/api/subscription', // подписка: options, by-token
  '/api/donation', // донат (страница /donate)
  // Оплата Robokassa — часть поверхности визитки рядом с /book, /donate,
  // /subscribe, /booking/paid. SuccessURL/FailURL бронь строит от SITE_URL
  // (по умолчанию алиас), а ResultURL (POST-вебхук, форма без JSON) задаётся в
  // кабинете и по BOOKING_SETUP.md может стоять на алиасе. 301 съедает тело
  // POST: вебхук не подтверждает бронь, деньги списаны (аудит 2026-10,
  // security#16). Единый ResultURL обслуживает и донаты с подписками — своих
  // вебхуков на других путях нет.
  '/api/payment',
  '/api/site-content', // фото/бегущая строка лендинга + admin/*
  '/api/articles', // статьи и их админка
  '/api/healthy-adult', // админка фраз канала (AdminPage)
  '/api/client-errors', // отчёт о сбое формы брони (bookingFailure.ts), правило №14
];
