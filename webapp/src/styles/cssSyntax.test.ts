// Синтаксис CSS целиком — тем же разборщиком, что у сборки (docs/open/frontend-ux.md).
// В волне 3 `vite build` упал на осиротевшем теле правила `.st-hour` в
// `sheet-settings.css`, а 366 кейсов стилей были зелёными: спеки читают css
// регэкспами и сломанную скобку не видят. Здесь каждый .css сайта и `shared/`
// проходит через lightningcss без errorRecovery — как минификатор сборки.
//
// Разборщик берётся из зависимостей самого vite, а не отдельной копией: тест
// обязан ругаться ровно на то, на что ругается сборка.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

type Transform = (o: {
  filename: string;
  code: Uint8Array;
  minify: boolean;
  errorRecovery: boolean;
}) => { warnings: { message: string }[] };

const require = createRequire(import.meta.url);
const fromVite = createRequire(require.resolve('vite'));
const { transform } = fromVite('lightningcss') as { transform: Transform };

const WEBAPP = join(__dirname, '..', '..');
const ROOTS = [join(WEBAPP, 'src'), join(WEBAPP, '..', 'shared', 'src')];

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : cssFiles(p);
    return e.name.endsWith('.css') ? [p] : [];
  });
}

/** Текст ошибки разбора или null; предупреждения — тоже ошибка. */
function syntaxError(filename: string, css: string): string | null {
  try {
    const r = transform({
      filename,
      code: Buffer.from(css),
      minify: true,
      errorRecovery: false,
    });
    return r.warnings.length
      ? r.warnings.map((w) => w.message).join('; ')
      : null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe('CSS сайта и shared/ разбирается lightningcss без восстановления', () => {
  const files = ROOTS.flatMap(cssFiles);

  it('файлы нашлись (обход каталогов не пустой)', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('ни в одном файле нет ошибки разбора', () => {
    const broken = files
      .map((f) => [relative(WEBAPP, f), syntaxError(f, readFileSync(f, 'utf8'))])
      .filter(([, err]) => err !== null);
    expect(broken).toEqual([]);
  });

  it('контроль: осиротевшее тело правила — ошибка', () => {
    const orphan = '.st-row { gap: 8px; }\n  padding: 4px 0;\n}\n';
    expect(syntaxError('orphan.css', orphan)).not.toBeNull();
    expect(syntaxError('ok.css', '.st-row { gap: 8px; }\n')).toBeNull();
  });
});
