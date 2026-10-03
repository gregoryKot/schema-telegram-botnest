// Аудит 2026-10, F2: getClientData отдавал терапевту mySchemaIds/myModeIds как
// есть, а в БД это зашифрованные JSON-строки (bot.service.ts шифрует их через
// encryptRecord) — кабинет получал шифротекст, объявленный массивом.
// Ключ выставляем ДО загрузки crypto.ts: без ключа encrypt() — no-op, и тест
// на расшифровку ничего бы не доказывал.
process.env.ENCRYPTION_KEY = 'cd'.repeat(32);

import { TherapyClientDataService } from './therapy-client-data.service';
import { encryptJson } from '../utils/crypto';

function makeService(userRow: Record<string, unknown> | null) {
  const prisma: any = {
    user: { findUnique: jest.fn(async () => userRow) },
    ysqResult: { findUnique: jest.fn(async () => null) },
    ysqResultHistory: { findMany: jest.fn(async () => []) },
  };
  const relations: any = { assertHasClient: jest.fn(async () => undefined) };
  return new TherapyClientDataService(prisma, {} as any, {} as any, relations);
}

describe('getClientData — расшифровка ярлыков профиля (F2)', () => {
  it('зашифрованные mySchemaIds/myModeIds приходят терапевту массивами', async () => {
    const svc = makeService({
      firstName: 'Аня',
      mySchemaIds: encryptJson(['abandonment', 'mistrust']),
      myModeIds: encryptJson(['vulnerable_child']),
      therapistShareProfile: true,
    });
    const res = await svc.getClientData(1n, 555);
    expect(res.mySchemaIds).toEqual(['abandonment', 'mistrust']);
    expect(res.myModeIds).toEqual(['vulnerable_child']);
  });

  it('старые строки (массив без шифрования) читаются как есть', async () => {
    const svc = makeService({
      firstName: 'Аня',
      mySchemaIds: ['abandonment'],
      myModeIds: null,
      therapistShareProfile: true,
    });
    const res = await svc.getClientData(1n, 555);
    expect(res.mySchemaIds).toEqual(['abandonment']);
    expect(res.myModeIds).toEqual([]);
  });

  it('therapistShareProfile=false по-прежнему скрывает ярлыки', async () => {
    const svc = makeService({
      firstName: 'Аня',
      mySchemaIds: encryptJson(['abandonment']),
      myModeIds: encryptJson(['x']),
      therapistShareProfile: false,
    });
    const res = await svc.getClientData(1n, 555);
    expect(res.mySchemaIds).toEqual([]);
    expect(res.myModeIds).toEqual([]);
  });
});
