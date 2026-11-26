// Спеки браузерного смока идут через общий `test` (e2e-browser/support/test.ts):
// стаб API формы сервера и падение на экране ошибки нельзя забыть, свой
// перехват `/api` с выдуманным ответом — завести (ci-alarm #903). Правила —
// browser-smoke-specs.ts; здесь оба исхода на образцах (с контрольными) и
// прогон по настоящим спекам. e2e-browser/live/ — проход по живому стенду без
// стаба, по построению вне правила (readdirSync без рекурсии).
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  smokeSpecViolations,
  specsMissingFromConfig,
} from './browser-smoke-specs';

const DIR = join(process.cwd(), 'e2e-browser');
const specs = readdirSync(DIR).filter((f) => f.endsWith('.spec.ts'));
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

const GOOD = `import { test, expect } from './support/test';
test('x', async ({ page }) => {
  await page.goto('/');
});
`;

describe('образцы: спек на общем test', () => {
  it('чисто', () => {
    expect(smokeSpecViolations(GOOD)).toEqual([]);
  });

  it('type-импорт из @playwright/test разрешён (Page, TestInfo)', () => {
    const src = `import type { Page, TestInfo } from '@playwright/test';\n${GOOD}`;
    expect(smokeSpecViolations(src)).toEqual([]);
  });

  it('перехват файлов сборки предикатом — не ответы API, разрешён', () => {
    const src = `${GOOD}await page.route((url) => /^\\/assets\\//.test(url.pathname), h);\n`;
    expect(smokeSpecViolations(src)).toEqual([]);
  });

  it('режим гостя через test.use — разрешён', () => {
    const src = `${GOOD}test.use({ session: 'anonymous' });\n`;
    expect(smokeSpecViolations(src)).toEqual([]);
  });
});

describe('образцы: в обход общего test — красное', () => {
  it('test из @playwright/test: оба нарушения названы', () => {
    const src = `import { test, expect } from '@playwright/test';
test('x', async () => {});
`;
    const v = smokeSpecViolations(src);
    expect(v).toHaveLength(2);
    expect(v[0]).toContain('./support/test');
    expect(v[1]).toContain("'@playwright/test'");
  });

  it('test с псевдонимом из @playwright/test — тоже в обход', () => {
    const src = `import { test as base } from '@playwright/test';\n`;
    expect(smokeSpecViolations(src).join('\n')).toContain("'@playwright/test'");
  });

  it('свой перехват **/api/** при общем test — красное', () => {
    const src = `${GOOD}await page.route('**/api/**', (r) => r.fulfill({ body: '{}' }));\n`;
    expect(smokeSpecViolations(src)).toEqual([
      expect.stringContaining('свой перехват `/api`'),
    ]);
  });

  it('перехват с полным адресом http://…/api/** — тоже свой стаб', () => {
    const src = `${GOOD}await page.route('http://127.0.0.1:4173/api/**', h);\n`;
    expect(smokeSpecViolations(src)).toHaveLength(1);
  });
});

describe('настоящие спеки e2e-browser', () => {
  it('спеки нашлись (иначе проверка ничего не проверяет)', () => {
    expect(specs.length).toBeGreaterThanOrEqual(6);
  });

  it.each(specs)('%s — на общем test, без своего перехвата /api', (f) => {
    expect(smokeSpecViolations(read(f))).toEqual([]);
  });

  it('каждый спек стоит в testMatch playwright.config.ts — иначе не запускается', () => {
    const config = readFileSync(
      join(process.cwd(), 'playwright.config.ts'),
      'utf8',
    );
    expect(specsMissingFromConfig(config, specs)).toEqual([]);
  });
});

describe('образцы: спек вне testMatch', () => {
  const CONFIG = `testMatch: [\n  'a.spec.ts',\n  "b.spec.ts",\n],`;
  it('все в списке — чисто', () => {
    expect(specsMissingFromConfig(CONFIG, ['a.spec.ts', 'b.spec.ts'])).toEqual(
      [],
    );
  });
  it('спека нет в списке — назван', () => {
    expect(
      specsMissingFromConfig(CONFIG, ['a.spec.ts', 'today-fit.spec.ts']),
    ).toEqual(['today-fit.spec.ts']);
  });
  it('имя-подстрока чужого не засчитывается (a.spec.ts ≠ aa.spec.ts)', () => {
    expect(specsMissingFromConfig(`'aa.spec.ts'`, ['a.spec.ts'])).toEqual([
      'a.spec.ts',
    ]);
  });
});

// Спек попадает в CI-прогон `npx playwright test` (джоба browser-smoke) только
// через ручной список testMatch в playwright.config.ts: файл без строки там
// лежит зелёным и ничего не гоняет. check-e2e-in-ci смотрит только test/**,
// поэтому сверка — здесь, в обе стороны (#922).
describe('testMatch playwright.config.ts ↔ спеки e2e-browser', () => {
  const config = readFileSync(
    join(process.cwd(), 'playwright.config.ts'),
    'utf8',
  );
  // Все проекты конфига (webapp, game): имена из каждого testMatch.
  const listed = [...config.matchAll(/testMatch:\s*\[([^\]]*)\]/g)]
    .flatMap((t) => [...t[1].matchAll(/'([^']+)'/g)])
    .map((m) => m[1]);

  it('список testMatch нашёлся', () => {
    expect(listed.length).toBeGreaterThanOrEqual(6);
  });

  it.each(specs)('%s — в testMatch', (f) => {
    expect(listed).toContain(f);
  });

  it('в testMatch нет имён без файла', () => {
    expect(listed.filter((f) => !specs.includes(f))).toEqual([]);
  });
});
