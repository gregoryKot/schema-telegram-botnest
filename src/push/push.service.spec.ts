// PushService: подписка (проверки, пробное уведомление, события), отписка
// только своего, отправка во все устройства и уборка мёртвых подписок.
// Prisma — табличный фейк в памяти: важно «сохранил → нашёл», а не «вызвал».
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WebPushError, generateVAPIDKeys } from 'web-push';
import {
  mergeOutcomes,
  PUSH_ENABLED_PAYLOAD,
  PushService,
} from './push.service';
import type { VapidState } from './push-config';
import { hashEndpoint } from './push-endpoint';

type Row = {
  id: number;
  userId: bigint;
  endpointHash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function makePrisma() {
  const rows: Row[] = [];
  let seq = 0;
  const matches = (r: Row, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => {
      const inList = (v as { in?: unknown[] } | null)?.in;
      return inList
        ? inList.includes(r[k as keyof Row])
        : r[k as keyof Row] === v;
    });
  const pushSubscription = {
    upsert: jest.fn(({ where, create, update }) => {
      const hit = rows.find((r) => r.endpointHash === where.endpointHash);
      if (hit) Object.assign(hit, update);
      else rows.push({ id: ++seq, ...create });
      return Promise.resolve({ id: hit?.id ?? seq });
    }),
    findMany: jest.fn(({ where }) =>
      Promise.resolve(
        rows.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      ),
    ),
    deleteMany: jest.fn(({ where }) => {
      const gone = rows.filter((r) => matches(r, where));
      for (const g of gone) rows.splice(rows.indexOf(g), 1);
      return Promise.resolve({ count: gone.length });
    }),
  };
  return { prisma: { pushSubscription } as never, rows };
}

const READY: VapidState = {
  kind: 'ready',
  config: { ...generateVAPIDKeys(), subject: 'https://schemehappens.ru' },
};
const P256DH = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 9)]).toString(
  'base64url',
);
const AUTH = Buffer.alloc(16, 5).toString('base64url');
const sub = (n: string, host = 'fcm.googleapis.com') => ({
  endpoint: `https://${host}/fcm/send/${n}`,
  p256dh: P256DH,
  auth: AUTH,
});
const err = (status: number) =>
  new WebPushError('Received unexpected response code', status, {}, '', '');

function setup(vapid: VapidState = READY) {
  const { prisma, rows } = makePrisma();
  const send = jest
    .fn()
    .mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const service = new PushService(prisma, analytics as never, send, vapid);
  return { service, rows, send, analytics };
}

describe('PushService.publicKey', () => {
  it('ключи заданы — публичный ключ; нет — null', () => {
    expect(setup().service.publicKey()).toBe(
      READY.kind === 'ready' && READY.config.publicKey,
    );
    expect(setup({ kind: 'off' }).service.publicKey()).toBeNull();
    expect(
      setup({ kind: 'broken', problem: 'x' }).service.publicKey(),
    ).toBeNull();
  });
});

describe('PushService.subscribe', () => {
  it('сохраняет, шлёт пробное уведомление, событие с сервисом и итогом', async () => {
    const { service, rows, send, analytics } = setup();
    await expect(service.subscribe(1n, sub('a'))).resolves.toEqual({
      delivered: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: 1n,
      endpointHash: hashEndpoint(sub('a').endpoint),
    });
    expect(JSON.parse(send.mock.calls[0][1])).toEqual(PUSH_ENABLED_PAYLOAD);
    expect(analytics.track).toHaveBeenCalledWith(1n, 'push_subscribed', {
      delivered: true,
      service: 'fcm',
    });
  });

  it('пробное не принято (5xx) — подписка остаётся, delivered=false', async () => {
    const { service, rows, send, analytics } = setup();
    send.mockRejectedValueOnce(err(503));
    await expect(service.subscribe(1n, sub('a'))).resolves.toEqual({
      delivered: false,
    });
    expect(rows).toHaveLength(1);
    expect(analytics.track).toHaveBeenCalledWith(1n, 'push_subscribed', {
      delivered: false,
      service: 'fcm',
    });
  });

  it('пробное получило 410 — мёртвая подписка удалена сразу, событие push_gone', async () => {
    const { service, rows, send, analytics } = setup();
    send.mockRejectedValueOnce(err(410));
    await expect(service.subscribe(1n, sub('a'))).resolves.toEqual({
      delivered: false,
    });
    expect(rows).toHaveLength(0);
    expect(analytics.track).toHaveBeenCalledWith(1n, 'push_gone', {
      service: 'fcm',
    });
  });

  it('тот же браузер другим аккаунтом — строка переезжает, вторая не появляется', async () => {
    const { service, rows } = setup();
    await service.subscribe(1n, sub('a'));
    await service.subscribe(2n, sub('a'));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(2n);
  });

  it('чужой хост — 400, в лог только имя хоста, ничего не сохранено и не отправлено', async () => {
    const { service, rows, send } = setup();
    const warn = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);
    await expect(
      service.subscribe(1n, sub('secret-token', 'push.evil.ru')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(warn.mock.calls[0][0]).toContain('push.evil.ru');
    expect(warn.mock.calls[0][0]).not.toContain('secret-token');
    expect(rows).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('битые ключи — 400', async () => {
    const { service, rows } = setup();
    await expect(
      service.subscribe(1n, { ...sub('a'), p256dh: 'AAAA' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(0);
  });

  it('VAPID не задан — 503', async () => {
    const { service } = setup({ kind: 'off' });
    await expect(service.subscribe(1n, sub('a'))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('PushService.unsubscribe', () => {
  it('своя подписка удаляется с событием и причиной', async () => {
    const { service, rows, analytics } = setup();
    await service.subscribe(1n, sub('a'));
    await service.unsubscribe(1n, sub('a').endpoint, 'logout');
    expect(rows).toHaveLength(0);
    expect(analytics.track).toHaveBeenCalledWith(1n, 'push_unsubscribed', {
      reason: 'logout',
    });
  });

  it('чужая — не трогается, события нет', async () => {
    const { service, rows, analytics } = setup();
    await service.subscribe(1n, sub('a'));
    analytics.track.mockClear();
    await service.unsubscribe(2n, sub('a').endpoint);
    expect(rows).toHaveLength(1);
    expect(analytics.track).not.toHaveBeenCalled();
  });
});

describe('PushService.sendToUser', () => {
  const payload = { title: 't', body: 'b', url: '/today', tag: 'reminder' };

  async function withTwoDevices() {
    const s = setup();
    await s.service.subscribe(1n, sub('phone'));
    await s.service.subscribe(
      1n,
      sub('laptop', 'updates.push.services.mozilla.com'),
    );
    await s.service.subscribe(2n, sub('stranger'));
    s.send.mockClear();
    s.analytics.track.mockClear();
    return s;
  }

  it('шлёт во все устройства человека и только в них → sent', async () => {
    const { service, send } = await withTwoDevices();
    await expect(service.sendToUser(1n, payload)).resolves.toBe('sent');
    const endpoints = send.mock.calls.map((c) => c[0].endpoint).sort();
    expect(endpoints).toEqual(
      [
        sub('laptop', 'updates.push.services.mozilla.com').endpoint,
        sub('phone').endpoint,
      ].sort(),
    );
    expect(JSON.parse(send.mock.calls[0][1])).toEqual(payload);
  });

  it('одно устройство умерло (404) — удалено с событием, другое приняло → sent', async () => {
    const { service, send, rows, analytics } = await withTwoDevices();
    send.mockImplementation((s) =>
      s.endpoint.includes('phone')
        ? Promise.reject(err(404))
        : Promise.resolve({ statusCode: 201 }),
    );
    await expect(service.sendToUser(1n, payload)).resolves.toBe('sent');
    expect(rows.filter((r) => r.userId === 1n)).toHaveLength(1);
    expect(analytics.track).toHaveBeenCalledWith(1n, 'push_gone', {
      service: 'fcm',
    });
  });

  it('все ответили 410/403 — все удалены → gone; чужие подписки на месте', async () => {
    const { service, send, rows } = await withTwoDevices();
    send.mockImplementation((s) =>
      Promise.reject(err(s.endpoint.includes('phone') ? 410 : 403)),
    );
    await expect(service.sendToUser(1n, payload)).resolves.toBe('gone');
    expect(rows.map((r) => r.userId)).toEqual([2n]);
  });

  it('429/5xx — failed, подписки живы', async () => {
    const { service, send, rows } = await withTwoDevices();
    send.mockRejectedValue(err(429));
    await expect(service.sendToUser(1n, payload)).resolves.toBe('failed');
    expect(rows).toHaveLength(3);
  });

  it('таймаут на одном и сбой на другом — unknown (повтор дал бы дубль)', async () => {
    const { service, send } = await withTwoDevices();
    send.mockImplementation((s) =>
      Promise.reject(
        s.endpoint.includes('phone') ? new Error('Socket timeout') : err(500),
      ),
    );
    await expect(service.sendToUser(1n, payload)).resolves.toBe('unknown');
  });

  it('подписок нет — gone; VAPID не задан — failed без запросов', async () => {
    const { service, send } = setup();
    await expect(service.sendToUser(9n, payload)).resolves.toBe('gone');
    const off = setup({ kind: 'off' });
    await expect(off.service.sendToUser(1n, payload)).resolves.toBe('failed');
    expect(send).not.toHaveBeenCalled();
    expect(off.send).not.toHaveBeenCalled();
  });

  it('subscribedUserIds — пачкой, только подписанные', async () => {
    const { service } = await withTwoDevices();
    const ids = await service.subscribedUserIds([1n, 2n, 3n]);
    expect([...ids].sort()).toEqual(['1', '2']);
    expect(await service.subscribedUserIds([])).toEqual(new Set());
  });
});

describe('mergeOutcomes', () => {
  it.each([
    [['accepted', 'gone'], 'sent'],
    [['gone', 'gone'], 'gone'],
    [['unknown', 'failed'], 'unknown'],
    [['gone', 'failed'], 'failed'],
    [['failed'], 'failed'],
  ] as const)('%j → %s', (results, outcome) => {
    expect(mergeOutcomes([...results])).toBe(outcome);
  });
});
