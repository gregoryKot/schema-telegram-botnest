// Метка сборки образа. Инцидент 31.07.2026: хостинг не смог подтянуть свежий
// коммит, ручная пересборка молча собрала старое, и «какой код на проде»
// выясняли по формулировке сообщения об ошибке. Метка отвечает на это прямо —
// поэтому её разбор под тестом, включая случай «метки нет».
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { builtAt, parseBuildInfo, resetBuildInfo } from './build-info';

describe('parseBuildInfo', () => {
  it('читает время сборки в UTC', () => {
    expect(parseBuildInfo('2026-07-31T12:40:05Z')?.toISOString()).toBe(
      '2026-07-31T12:40:05.000Z',
    );
  });

  it('переводы строк и пробелы вокруг не мешают', () => {
    expect(parseBuildInfo('  2026-07-31T12:40:05Z\n')?.toISOString()).toBe(
      '2026-07-31T12:40:05.000Z',
    );
  });

  it('мусор вместо даты — как будто метки нет', () => {
    expect(parseBuildInfo('позавчера')).toBeNull();
    expect(parseBuildInfo('')).toBeNull();
    expect(parseBuildInfo(null)).toBeNull();
  });
});

describe('builtAt', () => {
  const cwd = process.cwd();
  afterEach(() => {
    process.chdir(cwd);
    resetBuildInfo();
  });

  it('без файла метки отдаёт null, а не падает', () => {
    process.chdir(mkdtempSync(join(tmpdir(), 'build-info-')));
    resetBuildInfo();
    expect(builtAt()).toBeNull();
  });

  it('читает метку из рабочего каталога и запоминает', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-info-'));
    writeFileSync(join(dir, 'BUILD_INFO'), '2026-07-31T12:40:05Z\n');
    process.chdir(dir);
    resetBuildInfo();

    expect(builtAt()?.toISOString()).toBe('2026-07-31T12:40:05.000Z');
    // Второй вызов не ходит на диск — файл за жизнь процесса не меняется.
    process.chdir(cwd);
    expect(builtAt()?.toISOString()).toBe('2026-07-31T12:40:05.000Z');
  });
});
