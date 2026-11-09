// @vitest-environment node
// Правило №9 на сайте: no-floating-promises — error для прод-кода webapp
// (typed linting в eslint.config.js, 2026-11). Храповик eslint считает только
// нарушения, а не наличие правила: выключи его в конфиге — счётчик станет 0 и
// CI позеленеет. Этот тест держит само правило и исключение для navigate() —
// образец, который оно гасит, и контрольный образец (правило №15): функция с
// тем же типом `void | Promise<void>`, но не из react-router, обязана краснеть.
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const WEBAPP = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RULE = '@typescript-eslint/no-floating-promises';
// Образец линтуется под именем настоящего прод-файла: projectService видит
// только файлы с диска из tsconfig.app.json, виртуальный путь даёт parse error.
// Текст подменяется в памяти, сам файл не меняется.
const HOST = join(WEBAPP, 'src/App.tsx');

const SAMPLE = `import { useNavigate } from 'react-router-dom';
export function useProbe() {
  const navigate = useNavigate();
  const lookalike = (): void | Promise<void> => Promise.resolve();
  return () => {
    navigate('/today');
    lookalike();
    Promise.resolve(1);
    void Promise.resolve(2);
  };
}
`;

describe('eslint webapp — no-floating-promises', () => {
  it('прод-код: брошенный промис и двойник navigate — error, navigate() и void — нет', async () => {
    const [res] = await new ESLint({ cwd: WEBAPP }).lintText(SAMPLE, { filePath: HOST });
    expect(res.messages.filter((m) => m.fatal)).toEqual([]);
    const hits = res.messages.filter((m) => m.ruleId === RULE);
    expect(hits.map((m) => m.line)).toEqual([7, 8]);
    expect(hits.every((m) => m.severity === 2)).toBe(true);
  }, 60_000);

  it('тесты и тестовая инфраструктура — вне typed-правила: их нет в tsconfig.app.json', async () => {
    const eslint = new ESLint({ cwd: WEBAPP });
    for (const f of ['src/App.test.tsx', 'src/test-support/rtlCleanup.ts', 'src/components/AppShell.test-helpers.tsx']) {
      const config = (await eslint.calculateConfigForFile(join(WEBAPP, f))) as { rules?: Record<string, unknown> };
      expect(config.rules?.[RULE], f).toBeUndefined();
    }
    const prod = (await eslint.calculateConfigForFile(HOST)) as { rules?: Record<string, unknown> };
    expect(prod.rules?.[RULE]).toBeDefined();
  });
});
