// Тест гейта check-zero-coverage.mjs: файл src/** с нулём или почти нулём
// покрытых строк — красный, если не записан в бейслайн с причиной; причина
// «покрыто e2e» называет спек, который есть и гоняется e2e-шагом ci.yml; долг
// тает через --update, который только вычёркивает. Образец класса —
// src/api/throttle-hit.cleanup.ts жил с 0%, пока пол каталога src/api был зелёным.
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
interface RunOpts {
  args?: string[];
  keepTmp?: boolean;
  /** Прочие файлы песочницы: e2e-спеки, .github/workflows/ci.yml. */
  extra?: Record<string, string>;
}
const run = (
  files: Record<string, { lines: Lines }>,
  baseline: Record<string, string>,
  { args = [], keepTmp = false, extra = {} }: RunOpts = {},
) =>
  runGate(
    'check-zero-coverage.mjs',
    {
      [SUMMARY]: JSON.stringify({ total: entry(1, 1), ...files }),
      'scripts/zero-coverage-baseline.json': JSON.stringify(baseline),
      ...extra,
    },
    { args, keepTmp },
  );

describe('check-zero-coverage.mjs', () => {
  it('новый файл с 0% строк — красный; покрытый — зелёный', () => {
    const red = run({ 'src/api/cleanup.ts': entry(10, 0) }, {});
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('src/api/cleanup.ts: 0% строк');
    expect(run({ 'src/api/cleanup.ts': entry(10, 5) }, {}).status).toBe(0);
  });

  it('почти ноль: 5% строк без записи — красный, с причиной — зелёный; ровно 10% — уже не почти ноль', () => {
    const f = 'src/api/big.service.ts';
    const red = run({ [f]: entry(40, 2) }, {});
    expect(red.status).toBe(1);
    expect(red.stderr).toContain(`${f}: 5.0% строк (2 из 40) — ниже порога 10%`);
    const reason = { [f]: 'обёртка над SDK без ветвлений, логика в адаптере' };
    expect(run({ [f]: entry(40, 2) }, reason).status).toBe(0);
    expect(run({ [f]: entry(40, 4) }, {}).status).toBe(0);
    expect(run({ [f]: entry(1000, 99) }, {}).stderr).toContain(`${f}: 9.9% строк`);
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
      'src/a.ts: в бейслайне нулей, но покрыт от 10% строк или удалён',
    );
  });

  it('новый ноль рядом с покрытым — красный; --update вычёркивает покрытый и не вписывает новые', () => {
    const files = { 'src/a.ts': entry(5, 2), 'src/b.ts': entry(5, 0) };
    const base = { 'src/a.ts': 'был без теста, теперь с тестом' };
    const red = run(files, base);
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('src/b.ts: 0% строк');
    const upd = run(files, base, { args: ['--update'], keepTmp: true });
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
      'zero-coverage-rules.mjs',
      'EXEMPT_PATTERNS',
    ).map((p) => new RegExp(p.source, p.flags));
    const hit = (s: string) => patterns.some((re) => re.test(s));
    expect(hit('src/api/api.module.ts')).toBe(true);
    expect(hit('src/main.ts')).toBe(true);
    expect(hit('src/api/module-options.ts')).toBe(false);
    expect(hit('src/cli/main.ts')).toBe(false);
  });
});

describe('check-zero-coverage.mjs: причина «покрыто e2e»', () => {
  const SPEC = 'test/client-booking-ownership.e2e-spec.ts';
  const CTL = 'src/booking/client-booking.controller.ts';
  const zero = { [CTL]: entry(13, 0) };
  const base = { [CTL]: `контроллер под e2e-смоком ${SPEC}, вне юнит-подсчёта` };
  // e2e-шаг джобы backend: токен jest — префикс пути, как в настоящем ci.yml.
  const ci = (lines: string) => ({
    '.github/workflows/ci.yml': `jobs:\n  backend:\n    steps:\n${lines}`,
  });
  const E2E_STEP =
    '      - run: npx jest --config ./test/jest-e2e.json test/app-auth test/client-booking-ownership\n';

  it('спек есть и его гоняет e2e-шаг ci.yml — зелёный', () => {
    const res = run(zero, base, { extra: { [SPEC]: '', ...ci(E2E_STEP) } });
    expect(res.status).toBe(0);
  });

  it('спека нет в репозитории — красный, хотя ci.yml его называет', () => {
    const res = run(zero, base, { extra: ci(E2E_STEP) });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`бейслайн ${CTL}: спека ${SPEC} нет в репозитории`);
  });

  it('спек есть, но в ci.yml он только в комментарии — красный', () => {
    const lines =
      `      # ${SPEC} — гоняется ниже\n` +
      '      - run: npx jest --config ./test/jest-e2e.json test/app-auth\n';
    const res = run(zero, base, { extra: { [SPEC]: '', ...ci(lines) } });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      `${SPEC} не гоняет ни один e2e-шаг .github/workflows/ci.yml`,
    );
  });

  it('слово e2e без пути спека — красный; причина без e2e спека не требует', () => {
    const f = 'src/booking/booking.registry.ts';
    const z = { [f]: entry(25, 0) };
    const vague = run(z, { [f]: 'модуль поднимается e2e на AppModule вне подсчёта' });
    expect(vague.status).toBe(1);
    expect(vague.stderr).toContain(
      `бейслайн ${f}: причина ссылается на e2e, но не называет спек`,
    );
    expect(run(z, { [f]: 'реестр провайдеров без ветвлений' }).status).toBe(0);
  });
});
