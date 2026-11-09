// Сработавший повтор asset-recovery.js (инцидент 2026-11-04, #928): санитайзер
// и сверка литералов скрипта с реестром (правило №4). public/ ничего не
// импортирует, поэтому имя события и виды повтора в нём — литералы; опечатка
// молча дропалась бы на POST /api/public-event, и строка в /stats молчала бы.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ASSET_RECOVERY_EVENTS,
  ASSET_RECOVERY_KINDS,
  sanitizeAssetRecoveredMeta,
} from './asset-recovery.constants';
import { PUBLIC_ANALYTICS_EVENTS } from './analytics.constants';

const SCRIPT = readFileSync(
  join(__dirname, '../../webapp/public/asset-recovery.js'),
  'utf8',
);

describe('asset-recovery.js ↔ реестр asset_recovered', () => {
  it('событие открыто анонимно — скрипт работает до входа', () => {
    for (const name of ASSET_RECOVERY_EVENTS) {
      expect(PUBLIC_ANALYTICS_EVENTS).toContain(name);
    }
  });

  it('скрипт шлёт имя события из реестра в /api/public-event', () => {
    expect(SCRIPT).toContain("post('/api/public-event'");
    const names = [...SCRIPT.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1]);
    expect(names).toEqual([...ASSET_RECOVERY_EVENTS]);
  });

  it('виды повтора в скрипте — ровно ASSET_RECOVERY_KINDS', () => {
    const kinds = [...SCRIPT.matchAll(/recovered\('([a-z]+)'/g)].map(
      (m) => m[1],
    );
    expect([...new Set(kinds)].sort()).toEqual(
      [...ASSET_RECOVERY_KINDS].sort(),
    );
  });
});

describe('sanitizeAssetRecoveredMeta', () => {
  it('пропускает только kind и attempts', () => {
    expect(
      sanitizeAssetRecoveredMeta({ kind: 'css', attempts: 7, url: '/x' }),
    ).toEqual({ kind: 'css', attempts: 7 });
  });

  it.each([
    undefined,
    {},
    { kind: 'img', attempts: 1 },
    { kind: 'js', attempts: 0 },
    { kind: 'js', attempts: 11 },
    { kind: 'js', attempts: '1' },
    { kind: 'js', attempts: 2.5 },
  ])('невалидная meta %p — null', (meta) => {
    expect(sanitizeAssetRecoveredMeta(meta)).toBeNull();
  });
});
