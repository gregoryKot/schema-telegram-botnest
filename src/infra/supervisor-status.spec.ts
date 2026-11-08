// deploy/supervisor-status.mjs — состояние супервизора старта (причина для
// front, заголовок X-Maintenance-Reason) и DM владельцу при парковке (аудит
// 2026-10, «Из entrypoint без поднявшегося приложения сигнала нет»: при упавшем
// migrate deploy, крашлупе до listen и недоступной базе приложения нет, и
// молчали все каналы, кроме смока GitHub раз в 3–7 ч). Здесь — с подменённым
// fetch: шлёт, троттлит, молчит без токена, не бросает. Плюс
// deploy/entrypoint-config.mjs — настройки из env. Шов с настоящим entrypoint и
// фейковым Bot API — maintenance-startup.spec.ts.
import { execFileSync } from 'child_process';
import { join } from 'path';

const STATUS = join(process.cwd(), 'deploy', 'supervisor-status.mjs');
const CONFIG = join(process.cwd(), 'deploy', 'entrypoint-config.mjs');

interface Call {
  url: string;
  method: string;
  body: { chat_id: string; text: string };
}
interface Result<T> {
  out: T;
  calls: Call[];
  logs: string[];
}

/**
 * Сценарий над настоящим .mjs в отдельном node (jest ESM не грузит).
 * В теле доступны: m — модуль, fetchImpl — фейк Bot API (ответ задаёт
 * `reply`), log — сборщик строк, clock — подставляемое время.
 */
function scenario<T>(body: string, reply = 'ok'): Result<T> {
  const src = `import * as m from ${JSON.stringify(STATUS)};
const calls = [];
const logs = [];
const reply = ${JSON.stringify(reply)};
const fetchImpl = async (url, init) => {
  calls.push({ url, method: init.method, body: JSON.parse(init.body) });
  if (reply === 'throw') throw new Error('getaddrinfo ENOTFOUND');
  return { ok: reply === 'ok' };
};
const log = (line) => logs.push(line);
let t = 0;
const clock = () => t;
const out = await (async () => { ${body} })();
process.stdout.write(JSON.stringify({ out, calls, logs }));`;
  const raw = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    src,
  ]);
  return JSON.parse(raw.toString()) as Result<T>;
}

const STATUS_CFG = `{ token: '123:SECRETTOKEN', chatId: '42', apiBase: 'http://bot.test', fetchImpl, log, now: clock, dayMs: 1000 }`;

describe('deploy/supervisor-status.mjs — DM о парковке', () => {
  it('migrate deploy упал → DM владельцу через Bot API, причина наружу', () => {
    const r = scenario<[string, string]>(`
      const s = m.createSupervisorStatus(${STATUS_CFG});
      return [await s.park('migrate-failed'), s.reason()];`);
    expect(r.out).toEqual(['sent', 'migrate-failed']);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0].url).toBe(
      'http://bot.test/bot123:SECRETTOKEN/sendMessage',
    );
    expect(r.calls[0].method).toBe('POST');
    expect(r.calls[0].body.chat_id).toBe('42');
    expect(r.calls[0].body.text).toContain('migrate deploy упал');
  });

  it('троттл: одна причина — DM на 1, 2, 4-й парковке за сутки, не чаще', () => {
    const r = scenario<string[]>(`
      const s = m.createSupervisorStatus(${STATUS_CFG});
      const res = [];
      for (let i = 0; i < 5; i++) { t = i; res.push(await s.park('crashloop-parked')); }
      return res;`);
    expect(r.out).toEqual(['sent', 'sent', 'throttled', 'sent', 'throttled']);
    expect(r.calls).toHaveLength(3);
    expect(r.calls[1].body.text).toContain('Таких остановок за сутки: 2');
    expect(r.calls[2].body.text).toContain('станет 8');
  });

  it('троттл по причине: крашлуп не глушит DM о недоступной базе; сутки прошли — снова DM', () => {
    const r = scenario<string[]>(`
      const s = m.createSupervisorStatus(${STATUS_CFG});
      const res = [];
      for (let i = 0; i < 3; i++) { t = i; res.push(await s.park('crashloop-parked')); }
      res.push(await s.park('db-unreachable'));
      t = 5000; // dayMs = 1000 — окно суток в тесте
      res.push(await s.park('crashloop-parked'));
      return res;`);
    expect(r.out).toEqual(['sent', 'sent', 'throttled', 'sent', 'sent']);
  });

  it('без BOT_TOKEN или ADMIN_ID — молча пропускает, причина всё равно наружу', () => {
    const r = scenario<string[]>(`
      const a = m.createSupervisorStatus({ chatId: '42', fetchImpl, log });
      const b = m.createSupervisorStatus({ token: '1:x', fetchImpl, log });
      return [await a.park('migrate-failed'), a.reason(), await b.park('db-unreachable')];`);
    expect(r.out).toEqual(['skipped', 'migrate-failed', 'skipped']);
    expect(r.calls).toHaveLength(0);
    expect(r.logs).toEqual([]);
  });

  it.each([
    ['сеть недоступна', 'throw'],
    ['Bot API ответил ошибкой', 'fail'],
  ])('%s → failed и строка в лог, без исключения', (_name, reply) => {
    const r = scenario<string>(
      `const s = m.createSupervisorStatus(${STATUS_CFG});
      return await s.park('crashloop-parked');`,
      reply,
    );
    expect(r.out).toBe('failed');
    expect(r.logs).toEqual([
      '[entrypoint] DM о парковке (crashloop-parked) не ушёл',
    ]);
  });

  it('текст DM — без токена и адресов, для каждой причины парковки', () => {
    const r = scenario<string[]>(`
      return ['migrate-failed', 'crashloop-parked', 'db-unreachable']
        .flatMap((reason) => [m.parkMessage(reason, 1), m.parkMessage(reason, 4)]);`);
    for (const text of r.out) {
      expect(text).toMatch(/^🛑 Прод на техработах: /);
      expect(text).not.toMatch(/https?:|\/bot|SECRET|token/i);
    }
  });

  it('set меняет причину для front, начальная — starting', () => {
    const r = scenario<string[]>(`
      const s = m.createSupervisorStatus({});
      const before = s.reason();
      s.set('migrating');
      return [before, s.reason()];`);
    expect(r.out).toEqual(['starting', 'migrating']);
  });
});

describe('deploy/entrypoint-config.mjs', () => {
  function read(env: Record<string, string>): Record<string, unknown> {
    const src = `import { readEntrypointConfig } from ${JSON.stringify(CONFIG)};
process.stdout.write(JSON.stringify(readEntrypointConfig(${JSON.stringify(env)})));`;
    const raw = execFileSync(process.execPath, [
      '--input-type=module',
      '-e',
      src,
    ]);
    return JSON.parse(raw.toString()) as Record<string, unknown>;
  }

  it('без env — значения по умолчанию, Bot API — api.telegram.org', () => {
    expect(read({})).toMatchObject({
      APP_PORT: 3001,
      MIGRATE_CMD: 'npx prisma migrate deploy',
      MAX_FAILS: 3,
      MAX_FAILS_HOUR: 6,
      CRASH_WINDOW_MS: 900000,
      COOLDOWN_MS: 300000,
      MIGRATE_MAX_ATTEMPTS: 3,
      ALERT_API: 'https://api.telegram.org',
    });
  });

  it('env перекрывает; мусор в окне падений — значение по умолчанию', () => {
    const cfg = read({
      APP_PORT: '4000',
      STARTUP_MAX_FAILS: '5',
      STARTUP_CRASH_WINDOW_MS: 'abc',
      BOT_TOKEN: '1:x',
      ADMIN_ID: '42',
      STARTUP_ALERT_API: 'http://127.0.0.1:9',
    });
    expect(cfg).toMatchObject({
      APP_PORT: 4000,
      MAX_FAILS: 5,
      CRASH_WINDOW_MS: 900000,
      BOT_TOKEN: '1:x',
      ADMIN_ID: '42',
      ALERT_API: 'http://127.0.0.1:9',
    });
  });
});
