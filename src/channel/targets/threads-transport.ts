import { Agent } from 'undici';
import type { RequestTransport } from '../channel-http';

/**
 * Транспорт для Threads: длинное окно на установление соединения.
 *
 * У штатного клиента Node на это 10 секунд, и с российского хостинга запрос
 * стабильно упирался в `UND_ERR_CONNECT_TIMEOUT` — до серверов Meta связь либо
 * устанавливается долго, либо не устанавливается вовсе (инцидент 2026-07-31).
 * Даём соединению 30 секунд и общее окно 35: если и этого не хватает, дело не
 * в терпении, и отчёт честно скажет про недоступность домена.
 *
 * Терпение стоит времени: три попытки подряд — это до полутора минут на слот.
 * Для публикации раз в полдня это приемлемо, для команды `/zv threads` —
 * заметное ожидание, о котором лучше знать заранее.
 */
const CONNECT_MS = 30_000;
const TOTAL_MS = 35_000;

let agent: Agent | undefined;

export function threadsTransport(): RequestTransport {
  agent ??= new Agent({ connect: { timeout: CONNECT_MS } });
  return { dispatcher: agent, timeoutMs: TOTAL_MS };
}

/** Сброс между тестами. */
export function resetThreadsTransport(): void {
  agent = undefined;
}
