// Шов сканера крон-аренд и кэша jest (флак CI 2026-10-15, джоба backend, PR #680):
// `walk` делал readdirSync + отдельный statSync по каждому имени, а внутри src/
// живёт `.jest-cache/` — параллельный воркер переименовывал временный файл
// между двумя вызовами, и suite падал ENOENT мимо своей темы. Обход теперь
// общий (collectSourceFiles): тип записи берётся из withFileTypes, скрытое
// пропускается.
import * as fs from 'fs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { scanCronClaims } from './cron-source-scan';

// readdirSync — обёртка над настоящим, чтобы тест мог вклиниться между выдачей
// имён и их использованием (jest.spyOn по модулю fs не переопределяется).
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return { ...actual, readdirSync: jest.fn(actual.readdirSync) };
});

const CRON_SERVICE = `
import { Cron } from '@nestjs/schedule';
export class X {
  @Cron('*/5 * * * *')
  async tick() {
    await this.leader.claimRun('a', LEASE_WINDOW.fiveMin);
  }
}
`;

const realReaddir = jest.requireActual<typeof import('fs')>('fs').readdirSync;

describe('scanCronClaims: обход дерева', () => {
  let root: string;
  const write = (rel: string, body = CRON_SERVICE) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cron-source-scan-'));
    jest
      .mocked(fs.readdirSync)
      .mockImplementation(realReaddir as typeof fs.readdirSync);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('не заходит в скрытые каталоги и в test-support', () => {
    write('src/a.service.ts');
    write('src/.jest-cache/jest-transform-cache-x/cd/b.service.ts');
    write('src/test-support/c.ts');

    const found = scanCronClaims(root);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      file: 'src/a.service.ts',
      method: 'tick',
      cron: '*/5 * * * *',
      claimName: 'a',
      windowKey: 'fiveMin',
    });
  });

  it('файл, исчезнувший прямо во время обхода, не роняет сканер ENOENT', () => {
    write('src/a.service.ts');
    write('src/.jest-cache/tmp.map.123', 'x');
    const real = realReaddir;
    // Параллельный воркер jest убирает временный файл сразу после выдачи имён.
    jest.mocked(fs.readdirSync).mockImplementation(((
      ...args: Parameters<typeof real>
    ) => {
      const res = (real as (...a: unknown[]) => unknown)(...args);
      rmSync(join(root, 'src/.jest-cache'), { recursive: true, force: true });
      return res;
    }) as typeof fs.readdirSync);

    expect(() => scanCronClaims(root)).not.toThrow();
    expect(scanCronClaims(root)).toHaveLength(1);
  });
});
