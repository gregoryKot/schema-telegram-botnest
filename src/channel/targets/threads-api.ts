import { Agent } from 'undici';
import type { RequestTransport } from '../channel-http';

/**
 * Куда стучаться за Threads: напрямую или через ретранслятор.
 *
 * С российского хостинга серверы Meta не отвечают на попытку соединения вовсе
 * (`UND_ERR_CONNECT_TIMEOUT` на их IP) — маршрута нет, и ни таймаут, ни
 * повторы этого не лечат. Поэтому запросы уходят на маленький ретранслятор в
 * Cloudflare Workers (`deploy/threads-relay/`), который доступен отсюда и сам
 * ходит в Threads. Ретранслятор — тонкий проброс: наш код формирует тот же
 * путь и те же параметры, что и для прямого API, поэтому и публикация в два
 * шага, и ночное обновление токена работают без изменений.
 *
 * Без обеих переменных адаптер ходит напрямую — так он и должен вести себя
 * там, где Meta доступна.
 */
const DIRECT = 'https://graph.threads.net';
const RELAY_ENV = 'HEALTHY_ADULT_THREADS_RELAY';
const SECRET_ENV = 'HEALTHY_ADULT_THREADS_RELAY_SECRET';

/**
 * Прямому соединению — длинное окно: до Meta связь либо устанавливается долго,
 * либо не устанавливается никак (штатных 10 секунд не хватало). Через
 * ретранслятор запрос идёт в Cloudflare и такой поблажки не требует.
 */
const CONNECT_MS = 30_000;
const TOTAL_MS = 35_000;

let agent: Agent | undefined;

function relay(): { base: string; secret: string } | null {
  const base = process.env[RELAY_ENV]?.trim().replace(/\/$/, '');
  const secret = process.env[SECRET_ENV]?.trim();
  // Ретранслятор без ключа бесполезен: он ответит 403. Считаем это
  // недонастройкой и идём прямым путём — так причина будет честной.
  return base && secret ? { base, secret } : null;
}

/** Адрес и транспорт для пути вида `/v1.0/me/threads?...`. */
export function threadsApi(path: string): {
  url: string;
  transport: RequestTransport;
} {
  const via = relay();
  if (via)
    return {
      url: `${via.base}${path}`,
      transport: { headers: { 'x-relay-key': via.secret } },
    };
  agent ??= new Agent({ connect: { timeout: CONNECT_MS } });
  return {
    url: `${DIRECT}${path}`,
    transport: { dispatcher: agent, timeoutMs: TOTAL_MS },
  };
}

/** Идут ли запросы через ретранслятор — нужно для объяснения сбоя. */
export function threadsViaRelay(): boolean {
  return relay() !== null;
}

/** Сброс между тестами. */
export function resetThreadsApi(): void {
  agent = undefined;
}
