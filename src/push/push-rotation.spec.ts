// Смена подписки браузером (pushsubscriptionchange → POST /api/push/rotate) и
// сверка вкладки (POST /api/push/status). Ручка ротации анонимная: строка
// ищется ровно по старому адресу, чужая не двигается, неизвестный адрес —
// ничего. Prisma — табличный фейк с unique по endpointHash, как в Postgres:
// важно «сохранил → нашёл» (очередь шлёт на новый адрес), а не «вызвал».
import { BadRequestException } from '@nestjs/common';
import { generateVAPIDKeys } from 'web-push';
import { PushService } from './push.service';
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

const unique = () => Object.assign(new Error('unique'), { code: 'P2002' });

function makePrisma() {
  const rows: Row[] = [];
  let seq = 0;
  const hit = (r: Row, w: Partial<Row>) =>
    Object.entries(w).every(([k, v]) => r[k as keyof Row] === v);
  const taken = (hash: string | undefined, self: Row[]) =>
    rows.some((r) => r.endpointHash === hash && !self.includes(r));
  const pushSubscription = {
    upsert: jest.fn(({ where, create, update }) => {
      const row = rows.find((r) => r.endpointHash === where.endpointHash);
      if (row) Object.assign(row, update);
      else rows.push({ id: ++seq, ...create });
      return Promise.resolve({ id: row?.id ?? seq });
    }),
    findUnique: jest.fn(({ where }) =>
      Promise.resolve(rows.find((r) => hit(r, where)) ?? null),
    ),
    findMany: jest.fn(({ where }) =>
      Promise.resolve(rows.filter((r) => hit(r, where)).map((r) => ({ ...r }))),
    ),
    updateMany: jest.fn(({ where, data }) => {
      const hits = rows.filter((r) => hit(r, where));
      if (taken(data.endpointHash, hits)) return Promise.reject(unique());
      hits.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: hits.length });
    }),
    deleteMany: jest.fn(({ where }) => {
      const gone = rows.filter((r) => hit(r, where));
      gone.forEach((g) => rows.splice(rows.indexOf(g), 1));
      return Promise.resolve({ count: gone.length });
    }),
    count: jest.fn(({ where }) =>
      Promise.resolve(rows.filter((r) => hit(r, where)).length),
    ),
  };
  const prisma = {
    pushSubscription,
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  return { prisma, rows, pushSubscription };
}

const READY: VapidState = {
  kind: 'ready',
  config: { ...generateVAPIDKeys(), subject: 'https://schemehappens.ru' },
};
const P256DH = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 9)]).toString(
  'base64url',
);
const AUTH = Buffer.alloc(16, 5).toString('base64url');
const AUTH_NEW = Buffer.alloc(16, 6).toString('base64url');
const A = 1n;
const B = 2n;
const sub = (n: string, auth = AUTH) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
  p256dh: P256DH,
  auth,
});

async function setup(...owned: Array<[bigint, string]>) {
  const { prisma, rows, pushSubscription } = makePrisma();
  const send = jest
    .fn()
    .mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  const service = new PushService(prisma as never, undefined, send, READY);
  for (const [userId, name] of owned)
    await service.subscribe(userId, sub(name));
  send.mockClear();
  const snapshot = () => rows.map((r) => ({ ...r }));
  return { service, rows, send, pushSubscription, snapshot };
}

describe('PushService.rotate — браузер сменил подписку сам', () => {
  it('известный старый адрес — та же строка за тем же человеком с новым адресом; очередь шлёт уже туда (сохранил → нашёл)', async () => {
    const { service, rows, send } = await setup([A, 'old']);
    const id = rows[0].id;
    await service.rotate(sub('old').endpoint, sub('new', AUTH_NEW));
    expect(rows).toEqual([
      expect.objectContaining({
        id,
        userId: A,
        endpointHash: hashEndpoint(sub('new').endpoint),
      }),
    ]);
    expect(await service.isKnown(A, sub('new').endpoint)).toBe(true);
    expect(await service.isKnown(A, sub('old').endpoint)).toBe(false);
    await service.sendToUser(A, { title: 't', body: 'b', url: '/', tag: 'x' });
    expect(send.mock.calls.map(([to]) => to)).toEqual([
      {
        endpoint: sub('new').endpoint,
        keys: { p256dh: P256DH, auth: AUTH_NEW },
      },
    ]);
  });

  it.each([
    ['неизвестный адрес', 'never-seen'],
    ['регистр другой', 'OLD'],
    ['слэш в конце', 'old/'],
    ['только начало адреса', 'ol'],
  ])(
    '%s — ничего не меняется и не бросает (ответ ручки тот же)',
    async (_n, guess) => {
      const { service, snapshot } = await setup([A, 'old']);
      const before = snapshot();
      await expect(
        service.rotate(sub(guess).endpoint, sub('attacker')),
      ).resolves.toBeUndefined();
      expect(snapshot()).toEqual(before);
    },
  );

  it('новый адрес уже за тем же человеком (вкладка успела раньше) — одна строка с новым адресом и ключами', async () => {
    const { service, rows } = await setup([A, 'old'], [A, 'new']);
    await service.rotate(sub('old').endpoint, sub('new', AUTH_NEW));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: A,
      endpointHash: hashEndpoint(sub('new').endpoint),
    });
    expect(await service.isKnown(A, sub('old').endpoint)).toBe(false);
  });

  it('новый адрес за другим человеком — ни одна строка не тронута', async () => {
    const { service, snapshot } = await setup([A, 'a'], [B, 'b']);
    const before = snapshot();
    await service.rotate(sub('b').endpoint, sub('a'));
    expect(snapshot()).toEqual(before);
    expect(await service.isKnown(A, sub('a').endpoint)).toBe(true);
  });

  it('тот же адрес, новые ключи — ключи обновлены', async () => {
    const { service, rows, send } = await setup([A, 'same']);
    await service.rotate(sub('same').endpoint, sub('same', AUTH_NEW));
    expect(rows).toHaveLength(1);
    await service.sendToUser(A, { title: 't', body: 'b', url: '/', tag: 'x' });
    expect(send.mock.calls[0][0].keys.auth).toBe(AUTH_NEW);
  });

  it.each([
    [
      'хост не из списка push-сервисов',
      { ...sub('n'), endpoint: 'https://evil.example/x' },
    ],
    ['битые ключи', { ...sub('n'), auth: 'short' }],
  ])('%s — 400 до поиска старой строки', async (_n, next) => {
    const { service, pushSubscription, snapshot } = await setup([A, 'old']);
    const before = snapshot();
    await expect(service.rotate(sub('old').endpoint, next)).rejects.toThrow(
      BadRequestException,
    );
    expect(pushSubscription.findUnique).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it('гонка: строку с новым адресом вставила вкладка между чтением и записью — без 500, строки целы', async () => {
    const { service, pushSubscription, snapshot } = await setup(
      [A, 'old'],
      [A, 'new'],
    );
    const before = snapshot();
    const oldHash = hashEndpoint(sub('old').endpoint);
    const oldRow = before.find((r) => r.endpointHash === oldHash) ?? null;
    pushSubscription.findUnique
      .mockResolvedValueOnce(oldRow)
      .mockResolvedValueOnce(null); // вставка вкладки ещё не видна
    await expect(
      service.rotate(sub('old').endpoint, sub('new')),
    ).resolves.toBeUndefined();
    expect(snapshot()).toEqual(before);
  });
});

describe('PushService.isKnown — сверка вкладки', () => {
  it('своя подписка — true; чужая и неизвестная — false', async () => {
    const { service } = await setup([A, 'a'], [B, 'b']);
    expect(await service.isKnown(A, sub('a').endpoint)).toBe(true);
    expect(await service.isKnown(A, sub('b').endpoint)).toBe(false);
    expect(await service.isKnown(A, sub('zzz').endpoint)).toBe(false);
  });
});
