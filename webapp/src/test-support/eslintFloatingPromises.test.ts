// @vitest-environment node
// Правило №9 на сайте: no-floating-promises — error для всего webapp, тесты
// включительно (typed linting в eslint.config.js через tsconfig.test.json,
// 2026-11). Храповик eslint считает только нарушения, а не наличие правила:
// выключи его в конфиге — счётчик станет 0 и CI позеленеет. Этот тест держит
// само правило и исключение для navigate() — образец, который оно гасит, и
// контрольный образец (правило №15): функция с тем же типом
// `void | Promise<void>`, но не из react-router, обязана краснеть.
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const WEBAPP = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RULE = '@typescript-eslint/no-floating-promises';
// Образец линтуется под именем настоящего файла: typed-линт видит только файлы
// с диска из tsconfig.test.json, виртуальный путь даёт parse error. Текст
// подменяется в памяти, сам файл не меняется.
const HOST = join(WEBAPP, 'src/App.tsx');
const TEST_HOST = join(WEBAPP, 'src/App.test.tsx');
// При CI=true typescript-eslint сам включает single-run: программа строится из
// файлов с диска, и типы берутся от настоящего App.tsx, а не от образца —
// правило молчит (на CI тест падал, локально проходил). Образцу нужен обычный
// режим; правила и программа остаются из eslint.config.js.
const lintSample = (text: string, filePath: string) =>
  new ESLint({
    cwd: WEBAPP,
    overrideConfig: {
      files: ['src/**/*.{ts,tsx}'],
      languageOptions: { parserOptions: { disallowAutomaticSingleRunInference: true } },
    },
  }).lintText(text, { filePath });

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
    const [res] = await lintSample(SAMPLE, HOST);
    expect(res.messages.filter((m) => m.fatal)).toEqual([]);
    const hits = res.messages.filter((m) => m.ruleId === RULE);
    expect(hits.map((m) => m.line)).toEqual([7, 8]);
    expect(hits.every((m) => m.severity === 2)).toBe(true);
  }, 60_000);

  it('*.test.tsx: брошенный промис — error, await, void и navigate() — нет', async () => {
    const sample = `import { it } from 'vitest';
import { act } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
let navigate!: ReturnType<typeof useNavigate>;
it('probe', async () => {
  Promise.resolve(1);
  act(async () => {});
  await act(async () => {});
  void Promise.resolve(2);
  act(() => { navigate(-1); });
});
`;
    const [res] = await lintSample(sample, TEST_HOST);
    expect(res.messages.filter((m) => m.fatal)).toEqual([]);
    const hits = res.messages.filter((m) => m.ruleId === RULE);
    expect(hits.map((m) => m.line)).toEqual([6, 7]);
    expect(hits.every((m) => m.severity === 2)).toBe(true);
  }, 60_000);

  it('тестовая инфраструктура — под тем же правилом, что и прод', async () => {
    const eslint = new ESLint({ cwd: WEBAPP });
    const prod = (await eslint.calculateConfigForFile(HOST)) as { rules?: Record<string, unknown> };
    for (const f of ['src/App.test.tsx', 'src/test-support/rtlCleanup.ts', 'src/components/AppShell.test-helpers.tsx']) {
      const config = (await eslint.calculateConfigForFile(join(WEBAPP, f))) as { rules?: Record<string, unknown> };
      expect(config.rules?.[RULE], f).toEqual(prod.rules?.[RULE]);
    }
    expect(prod.rules?.[RULE]).toBeDefined();
  });
});
