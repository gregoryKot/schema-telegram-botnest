/**
 * Ретранслятор запросов в Threads (Cloudflare Workers).
 *
 * Зачем: серверы Meta не отвечают на соединение с российского хостинга, где
 * живёт приложение, а Cloudflare — отвечает. Воркер принимает от бэкенда путь
 * и параметры как есть и повторяет запрос в graph.threads.net со своей
 * стороны. Никакой логики публикации тут нет намеренно: два шага создания
 * поста и обновление токена остаются в приложении, где их видно и где на них
 * есть тесты. Меньше кода тут — меньше того, что может разъехаться.
 *
 * Что он НЕ делает: не ходит никуда, кроме graph.threads.net; не принимает
 * запросы без ключа; не хранит токен и не пишет тело запроса в логи (в них
 * поехал бы access_token).
 *
 * Секреты воркера: RELAY_SECRET. Разворачивание — README рядом.
 */
const UPSTREAM = 'https://graph.threads.net';

/** Сравнение без ранней остановки: длина ключа и так известна, время — нет. */
function sameSecret(given, expected) {
  if (typeof given !== 'string' || given.length !== expected.length)
    return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++)
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (!env.RELAY_SECRET)
      return new Response('relay is not configured', { status: 500 });
    if (!sameSecret(request.headers.get('x-relay-key'), env.RELAY_SECRET))
      return new Response('forbidden', { status: 403 });
    if (request.method !== 'GET' && request.method !== 'POST')
      return new Response('method not allowed', { status: 405 });

    const incoming = new URL(request.url);
    const target = `${UPSTREAM}${incoming.pathname}${incoming.search}`;
    try {
      const res = await fetch(target, { method: request.method });
      // Тело и статус отдаём как есть: разбирать ответ площадки — дело
      // приложения, и оно уже умеет объяснять её ошибки словами.
      return new Response(await res.text(), {
        status: res.status,
        headers: {
          'content-type':
            res.headers.get('content-type') ?? 'application/json',
        },
      });
    } catch (err) {
      // Причина нужна целиком: без неё «не дошло» опять станет загадкой.
      return new Response(`relay upstream failed: ${err}`, { status: 502 });
    }
  },
};
