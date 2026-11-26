// Комнаты Zoom вне базы: сверка со ссылками живых броней под ключом шифрования.
// Пока хоть одна ссылка не прочитана, удалять нельзя — комната могла быть её.
// Шов (команда, fetch, отчёт) — foreign-scrub.spec.ts. Ключи читаются при
// загрузке модулей — грузим под ключом (loadWithKeys).
import { loadWithKeys } from '../test-support/load-with-keys';
import type { OrphanPorts } from './zoom-orphans';
import { orphanLines } from './zoom-orphans.report';

type Orphans = typeof import('./zoom-orphans');
type Crypto = typeof import('../utils/crypto');
/* eslint-disable @typescript-eslint/no-require-imports */
const { orphans, crypto } = loadWithKeys({ key: 'ab'.repeat(32) }, () => ({
  orphans: require('./zoom-orphans') as Orphans,
  crypto: require('../utils/crypto') as Crypto,
}));
const foreign = loadWithKeys(
  { key: 'cd'.repeat(32) },
  () => require('../utils/crypto') as Crypto,
);
/* eslint-enable @typescript-eslint/no-require-imports */
afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY_OLD;
});

describe('zoom-orphans: ссылки живых броней', () => {
  it('зашифрованная и старая открытая ссылки читаются, чужой шифротекст — в счёт нечитаемых', () => {
    const refs = orphans.linkRefs([
      crypto.encrypt('https://us02web.zoom.us/j/81000000001?pwd=a'),
      'https://zoom.us/j/81000000002',
      foreign.encrypt('https://zoom.us/j/81000000003?pwd=b'),
      null,
    ]);
    expect(refs.unreadable).toBe(1);
    expect(refs.booked.has('81000000001')).toBe(true);
    expect(refs.booked.has('81000000002')).toBe(true);
    expect(refs.booked.has('81000000003')).toBe(false);
  });

  it('нечитаемая ссылка: комнаты вне базы не удаляются, только переименовываются', async () => {
    const deleted: string[] = [];
    const renamed: string[] = [];
    const ports: OrphanPorts = {
      listZoomMeetings: () =>
        Promise.resolve({
          result: 'ok',
          meetings: [
            { id: '81000000004', topic: 'Сессии — Имя Клиента', type: 3 },
            { id: '81000000005', topic: 'Сессия', type: 3 },
          ],
        }),
      roomRefs: () =>
        Promise.resolve({ known: new Set(), booked: new Set(), unreadable: 1 }),
      deleteZoomRoom: (id) => {
        deleted.push(id);
        return Promise.resolve('ok');
      },
      renameZoomRoom: (id) => {
        renamed.push(id);
        return Promise.resolve('ok');
      },
      pause: () => Promise.resolve(),
    };
    const rep = await orphans.scrubOrphans({
      topic: 'Сессия',
      live: true,
      ports,
    });
    expect(deleted).toEqual([]);
    expect(renamed).toEqual(['81000000004']);
    expect(rep).toMatchObject({ orphans: 2, deleted: 0, renamed: 1 });
    expect(orphanLines(rep, true)).toContain(
      'Не прочитано ссылок в бронях: 1 — комнаты вне базы не удаляются, только переименовываются.',
    );
  });
});
