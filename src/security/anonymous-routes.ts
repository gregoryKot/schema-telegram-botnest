// Анонимные роут-МЕТОДЫ внутри контроллеров, которые в остальном под гвардом
// (аудит 2026-10). Классификация по файлу прятала их: гвард на одном методе
// делал защищённым весь файл, и новый анонимный `@Post` рядом не краснел
// ни в одном трипваере. Ключ — `файл:метод`, значение — почему анонимность
// здесь законна. Реестр только НАЗЫВАЕТ уже существующие точки входа
// (вход, OAuth-колбэки, refresh/logout, poll тикета); новой
// публичной поверхности он не создаёт. Список может только сокращаться,
// добавлять — только с ревью безопасности (route-auth.invariants.spec.ts).
export const ANONYMOUS_BY_DESIGN: Record<string, string> = {
  'auth/auth-account.controller.ts:emailLoginLink':
    'запрос ссылки входа по email: человек ещё не вошёл; CSRF-заголовок, ' +
    'троттлинг по IP, ответ не раскрывает, есть ли такой адрес',
  'auth/auth-account.controller.ts:emailLoginCallback':
    'переход по ссылке из письма: только 302 на страницу сайта, токен не ' +
    'гасится (его гасит POST email/consume), данных пользователя нет',
  'auth/auth-account.controller.ts:emailConsume':
    'погашение одноразового токена из письма = вход; токен 256 бит, ' +
    'CSRF-заголовок, троттлинг по IP',
  'auth/auth-account.controller.ts:telegramWebApp':
    'вход из мини-аппа Telegram: подписанный initData проверяется ' +
    'verifyTelegramWebAppData, CSRF-заголовок',
  'auth/auth-2fa.controller.ts:totpChallenge':
    'второй шаг входа: подписанный challengeToken + код TOTP, ' +
    'CSRF-заголовок, троттлинг по IP; сессии до этого шага ещё нет',
  'auth/auth-oauth.controller.ts:googleCallback':
    'возврат с Google: подписанный state + кука oauth_state (double-submit), ' +
    'код обменивается на сервере; сессии до колбэка нет',
  'auth/auth-oauth.controller.ts:vkCallback':
    'возврат с VK: тот же state и кука, что у Google, плюс PKCE; ' +
    'сессии до колбэка нет',
  'auth/auth-ticket.controller.ts:poll':
    'контейнер забирает сессию по длинному device-коду (RFC 8628): код и ' +
    'есть доказательство, CSRF-заголовок, троттлинг по IP',
  'auth/auth.controller.ts:refresh':
    'обмен refresh-куки на access: access уже истёк, гвард невозможен; ' +
    'проверка — ротируемая кука, CSRF-заголовок, троттлинг по IP',
  'auth/auth.controller.ts:logout':
    'выход по refresh-куке: access мог истечь; CSRF-заголовок, ' +
    'без куки — только очистка cookies, данных пользователя не отдаёт',
};
