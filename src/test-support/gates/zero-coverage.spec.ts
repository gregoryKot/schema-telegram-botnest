// Тест гейта check-zero-coverage.mjs: файл src/** с нулём покрытых строк —
// красный, если не записан в бейслайн с причиной; долг тает через --update,
// который только вычёркивает. Образец класса — src/api/throttle-hit.cleanup.ts
// жил с 0%, пока пол каталога src/api был зелёным.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cleanupTmp, runGate } from './gate-sandbox';
import { loadRegexList } from './pattern-loader';

type Lines = { total: number; covered: number };
const entry = (total: number, covered: number) => ({
  lines: {
    total,
    covered,
    pct: total ? (covered / total) * 100 : 100,
  } as Lines,
});
const SUMMARY = 'coverage/coverage-summary.json';
const run = (
  files: Record<string, { lines: Lines }>,
  baseline: Record<string, string>,
  args: string[] = [],
  keepTmp = false,
) =>
  runGate(
    'check-zero-coverage.mjs',
    {
      [SUMMARY]: JSON.stringify({ total: entry(1, 1), ...files }),
      'scripts/zero-coverage-baseline.json': JSON.stringify(baseline),
    },
    { args, keepTmp },
  );

describe('check-zero-coverage.mjs', () => {
  it('новый файл с 0% строк — красный; покрытый — зелёный', () => {
    const red = run({ 'src/api/cleanup.ts': entry(10, 0) }, {});
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('src/api/cleanup.ts: 0% строк');
    expect(run({ 'src/api/cleanup.ts': entry(10, 1) }, {}).status).toBe(0);
  });

  it('абсолютный путь из summary jest сводится к src/… песочницы', () => {
    const res = runGate(
      'check-zero-coverage.mjs',
      { 'scripts/zero-coverage-baseline.json': '{}' },
      {
        setup: (tmp) => {
          const abs = join(tmp, 'src', 'x.ts');
          writeFileSync(
            join(tmp, 'summary.json'),
            JSON.stringify({ [abs]: entry(3, 0) }),
          );
        },
        args: ['--summary=summary.json'],
      },
    );
    expect(res.stderr).toContain('src/x.ts: 0% строк');
  });

  it('Nest-модуль и src/main.ts без логики по построению; контроль: main.service.ts краснеет', () => {
    const files = {
      'src/booking/booking.module.ts': entry(9, 0),
      'src/main.ts': entry(30, 0),
    };
    expect(run(files, {}).status).toBe(0);
    const control = run({ ...files, 'src/main.service.ts': entry(5, 0) }, {});
    expect(control.stderr).toContain('src/main.service.ts');
    expect(control.stderr).not.toContain('booking.module.ts');
  });

  it('файл без исполняемых строк и пути вне src/ не считаются', () => {
    expect(
      run({ 'src/types.ts': entry(0, 0), 'test/x.ts': entry(4, 0) }, {}).status,
    ).toBe(0);
  });

  it('ноль в бейслайне с причиной — зелёный; короткая причина — красный', () => {
    const z = { 'src/booking/booking.registry.ts': entry(24, 0) };
    expect(
      run(z, {
        'src/booking/booking.registry.ts': 'реестр провайдеров без ветвлений',
      }).status,
    ).toBe(0);
    expect(
      run(z, { 'src/booking/booking.registry.ts': 'реестр' }).stderr,
    ).toContain('короче 20 символов');
  });

  it('покрытый файл из бейслайна — зелёный с просьбой зафиксировать (соседние PR не краснеют)', () => {
    const res = run(
      { 'src/a.ts': entry(5, 2) },
      { 'src/a.ts': 'был без теста, теперь с тестом' },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      'src/a.ts: в бейслайне нулей, но покрыт или удалён',
    );
  });

  it('новый ноль рядом с покрытым — красный; --update вычёркивает покрытый и не вписывает новые', () => {
    const files = { 'src/a.ts': entry(5, 2), 'src/b.ts': entry(5, 0) };
    const base = { 'src/a.ts': 'был без теста, теперь с тестом' };
    const red = run(files, base);
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('src/b.ts: 0% строк');
    const upd = run(files, base, ['--update'], true);
    try {
      expect(upd.status).toBe(1);
      expect(upd.stderr).toContain(
        'Новые нули --update не вписывает: src/b.ts',
      );
      const written = JSON.parse(
        readFileSync(
          join(upd.tmp, 'scripts/zero-coverage-baseline.json'),
          'utf8',
        ),
      );
      expect(written).toEqual({});
    } finally {
      cleanupTmp(upd.tmp);
    }
  });

  it('нет coverage-summary — красный с подсказкой', () => {
    const res = runGate('check-zero-coverage.mjs', {
      'scripts/zero-coverage-baseline.json': '{}',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('check-coverage-ratchet');
  });

  it('EXEMPT_PATTERNS: ровно модуль и точка входа', () => {
    const patterns = loadRegexList(
      'check-zero-coverage.mjs',
      'EXEMPT_PATTERNS',
    ).map((p) => new RegExp(p.source, p.flags));
    const hit = (s: string) => patterns.some((re) => re.test(s));
    expect(hit('src/api/api.module.ts')).toBe(true);
    expect(hit('src/main.ts')).toBe(true);
    expect(hit('src/api/module-options.ts')).toBe(false);
    expect(hit('src/cli/main.ts')).toBe(false);
  });
});
