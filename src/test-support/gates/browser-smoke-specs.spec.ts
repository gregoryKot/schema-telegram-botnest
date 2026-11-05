// Спеки браузерного смока идут через общий `test` (e2e-browser/support/test.ts):
// стаб API формы сервера и падение на экране ошибки нельзя забыть, свой
// перехват `/api` с выдуманным ответом — завести (ci-alarm #903). Правила —
// browser-smoke-specs.ts; здесь оба исхода на образцах (с контрольными) и
// прогон по настоящим спекам. e2e-browser/live/ — проход по живому стенду без
// стаба, по построению вне правила (readdirSync без рекурсии).
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { smokeSpecViolations } from './browser-smoke-specs';

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
});
