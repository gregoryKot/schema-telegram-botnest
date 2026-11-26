// Куда уходят запросы Threads. Инцидент 2026-07-31: с российского хостинга
// серверы Meta не отвечают на соединение вовсе, поэтому появился ретранслятор
// в Cloudflare. Здесь проверяется развилка: есть настроенный ретранслятор —
// идём через него, нет — напрямую, как и должно быть там, где Meta доступна.
import { resetThreadsApi, threadsApi, threadsViaRelay } from './threads-api';

const ENV = [
  'HEALTHY_ADULT_THREADS_RELAY',
  'HEALTHY_ADULT_THREADS_RELAY_SECRET',
];

describe('threads-api', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    resetThreadsApi();
    for (const key of ENV) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('без ретранслятора — прямой адрес Meta и длинное окно на соединение', () => {
    const { url, transport } = threadsApi('/v1.0/me/threads?media_type=TEXT');
    expect(url).toBe(
      'https://graph.threads.net/v1.0/me/threads?media_type=TEXT',
    );
    expect(transport.dispatcher).toBeDefined();
    expect(transport.timeoutMs).toBe(35_000);
    expect(threadsViaRelay()).toBe(false);
  });

  it('с ретранслятором — его адрес и ключ в заголовке', () => {
    process.env.HEALTHY_ADULT_THREADS_RELAY = 'https://zv.workers.dev';
    process.env.HEALTHY_ADULT_THREADS_RELAY_SECRET = 'ключ';
    const { url, transport } = threadsApi('/v1.0/me/threads_publish?id=1');

    expect(url).toBe('https://zv.workers.dev/v1.0/me/threads_publish?id=1');
    expect(transport.headers).toEqual({ 'x-relay-key': 'ключ' });
    // Через Cloudflare соединение обычное — поблажка на 30 секунд не нужна.
    expect(transport.dispatcher).toBeUndefined();
    expect(threadsViaRelay()).toBe(true);
  });

  it('лишний слэш в адресе не превращается в двойной', () => {
    process.env.HEALTHY_ADULT_THREADS_RELAY = 'https://zv.workers.dev/';
    process.env.HEALTHY_ADULT_THREADS_RELAY_SECRET = 'ключ';
    expect(threadsApi('/v1.0/me/threads').url).toBe(
      'https://zv.workers.dev/v1.0/me/threads',
    );
  });

  it('ретранслятор без ключа не используется — он ответил бы 403', () => {
    process.env.HEALTHY_ADULT_THREADS_RELAY = 'https://zv.workers.dev';
    expect(threadsApi('/v1.0/me/threads').url).toContain('graph.threads.net');
    expect(threadsViaRelay()).toBe(false);
  });
});
