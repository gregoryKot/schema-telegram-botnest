// Поддельный Telegram Bot API для шовных тестов поллинга: настоящий Telegraf
// ходит по `apiRoot` в локальный http-сервер, а не в мок `launch()`
// (правило №14: мок, подменяющий launch целиком, стоит НЕ на шве — в нём не
// участвует ни Telegraf, ни его поведение на 409).
//
// Что воспроизводится — контракт Bot API, на который опирается код:
//   * getUpdates: отдаёт апдейты с update_id >= offset, подтверждённые
//     (< offset) выбрасывает; пустая очередь — «long poll» на HOLD_MS;
//   * 409 «Conflict: terminated by other getUpdates request» — по сценарию;
//   * '400-long': Telegram отклоняет long-poll (в теле есть `timeout`), а
//     короткий служебный getUpdates (sync offset: `limit: 1`, без `timeout`)
//     принимает — так Telegraf делает в `finally` после любого сбоя цикла;
//   * deleteWebhook с drop_pending_updates=true стирает очередь (документация
//     Bot API: «Pass True to drop all pending updates»).
// Записанного ответа площадки на 409 в test/fixtures/recorded нет — текст
// взят из документации и из логов Telegraf (см. docs/README.md, «Что осталось
// открытым»).
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import type { Update } from 'telegraf/types';

export type GetUpdatesStep = 'ok' | '409' | '400-long';

const HOLD_MS = 40;

export interface FakeTelegramApi {
  /** Подставить в `new Telegraf(token, { telegram: { apiRoot } })`. */
  apiRoot: string;
  /** Счётчик вызовов по имени метода Bot API. */
  hits: Record<string, number>;
  /** Тела deleteWebhook — по ним видно, просил ли код стереть очередь. */
  deleteWebhookBodies: Array<Record<string, unknown>>;
  /** Тела getUpdates: long-poll (`timeout`) отличим от служебного sync. */
  getUpdatesBodies: Array<Record<string, unknown>>;
  /** Положить апдейт в очередь «на стороне Telegram». */
  enqueue(update: Update): void;
  /** Сценарий ответов на getUpdates; после конца — последний шаг повторяется. */
  setScript(script: GetUpdatesStep[]): void;
  close(): Promise<void>;
}

const CONFLICT =
  'Conflict: terminated by other getUpdates request; make sure that only ' +
  'one bot instance is running';

export async function startFakeTelegramApi(
  script: GetUpdatesStep[] = ['ok'],
): Promise<FakeTelegramApi> {
  const hits: Record<string, number> = {};
  const deleteWebhookBodies: Array<Record<string, unknown>> = [];
  const getUpdatesBodies: Array<Record<string, unknown>> = [];
  let queue: Update[] = [];
  let steps = script;
  let getUpdatesCalls = 0;

  const server: Server = createServer((req, res) => {
    const method = (req.url ?? '').split('/').pop() ?? '';
    hits[method] = (hits[method] ?? 0) + 1;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      // Telegraf шлёт JSON либо пустое тело (методы без параметров).
      const raw = Buffer.concat(chunks).toString();
      const body: Record<string, unknown> = raw ? JSON.parse(raw) : {};
      res.setHeader('content-type', 'application/json');
      const reply = (result: unknown) =>
        res.end(JSON.stringify({ ok: true, result }));

      if (method === 'getMe') {
        return reply({ id: 1, is_bot: true, first_name: 'b', username: 'bot' });
      }
      if (method === 'deleteWebhook') {
        deleteWebhookBodies.push(body);
        if (body.drop_pending_updates === true) queue = [];
        return reply(true);
      }
      if (method === 'getUpdates') {
        getUpdatesBodies.push(body);
        const step = steps[Math.min(getUpdatesCalls++, steps.length - 1)];
        if (step === '400-long' && Number(body.timeout ?? 0) > 0) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({
              ok: false,
              error_code: 400,
              description: 'Bad Request: long poll rejected',
            }),
          );
        }
        if (step === '409') {
          res.statusCode = 409;
          return res.end(
            JSON.stringify({
              ok: false,
              error_code: 409,
              description: CONFLICT,
            }),
          );
        }
        const offset = Number(body.offset ?? 0);
        queue = queue.filter((u) => u.update_id >= offset);
        if (queue.length > 0) return reply(queue);
        return void setTimeout(() => reply([]), HOLD_MS);
      }
      return reply(true);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;

  return {
    apiRoot: `http://127.0.0.1:${port}`,
    hits,
    deleteWebhookBodies,
    getUpdatesBodies,
    enqueue: (u) => void queue.push(u),
    setScript: (s) => {
      steps = s;
      getUpdatesCalls = 0;
    },
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
