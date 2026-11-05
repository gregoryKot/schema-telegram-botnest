// Тест модуля правил scripts/local-cache-resolve.mjs — статическое
// разрешение ключа localStorage из выражения (литерал, шаблон, сложение,
// константа, поле объекта, функция-строитель). Сам гейт
// check-local-cache-writers.mjs проверяется в local-cache-writers.spec.ts
// через песочницу; здесь — слой разбора напрямую, чтобы каждый поддержанный
// вид выражения был пришпилен образцом, а неразрешимое оставалось
// неразрешимым (параметр функции не превращается в «какой-то ключ»).
import { importExport } from './pattern-loader';

const SCRIPT = 'local-cache-resolve.mjs';

function call<T>(exportName: string, mapExpr: string): T {
  return JSON.parse(importExport(SCRIPT, exportName, mapExpr)) as T;
}

/** resolveKeyExpr над одним виртуальным файлом с данным исходником. */
function resolve(
  expr: string,
  source: string,
): { keys: string[]; error?: string } {
  const ctx = `{ root: '/r', load: () => ${JSON.stringify(source)} }`;
  return call(
    'resolveKeyExpr',
    `(fn) => fn(${JSON.stringify(expr)}, '/r/shared/src/a.ts', ${ctx})`,
  );
}

describe('local-cache-resolve.mjs', () => {
  // Текстовый слой живёт отдельно (local-cache-source.mjs): скобки и запятые
  // внутри строк — не разделители.
  it('splitTopLevel и matchBracket (local-cache-source.mjs) не режут внутри строк и скобок', () => {
    const parts = JSON.parse(
      importExport(
        'local-cache-source.mjs',
        'splitTopLevel',
        `(fn) => fn("a, f(b, c), 'd,e', { x: 1, y: 2 }", ',')`,
      ),
    ) as string[];
    expect(parts).toEqual(['a', 'f(b, c)', "'d,e'", '{ x: 1, y: 2 }']);
    const close = JSON.parse(
      importExport(
        'local-cache-source.mjs',
        'matchBracket',
        `(fn) => fn("f(')', x)", 1)`,
      ),
    ) as number;
    expect(close).toBe(8);
  });

  it('литерал, шаблон с префиксом, сложение и тернарник', () => {
    expect(resolve("'my_key'", '')).toEqual({ keys: ['my_key'] });
    expect(resolve('`modemap_vp_${mapId}`', '')).toEqual({
      keys: ['modemap_vp_*'],
    });
    expect(resolve("'celebrated_' + day", '')).toEqual({
      keys: ['celebrated_*'],
    });
    expect(resolve("flag ? 'a' : 'b'", '')).toEqual({ keys: ['a', 'b'] });
  });

  it('константа, поле объекта и индекс по объекту — из исходника файла', () => {
    const src = [
      "const KEY = 'one' as const;",
      "export const KEYS: Record<string, string> = { schema: 'draft_schema', mode: 'draft_mode' };",
    ].join('\n');
    expect(resolve('KEY', src)).toEqual({ keys: ['one'] });
    expect(resolve('KEYS.mode', src)).toEqual({ keys: ['draft_mode'] });
    expect(resolve('KEYS[type]', src)).toEqual({
      keys: ['draft_schema', 'draft_mode'],
    });
  });

  it('функция-строитель: стрелка и объявление function', () => {
    const src = [
      'const nameKey = (id: number) => `modemap_couple_${id}`;',
      "function seenKey(modeId: string) { return 'mode_portrait_seen_' + modeId; }",
    ].join('\n');
    expect(resolve('nameKey(mapId)', src)).toEqual({
      keys: ['modemap_couple_*'],
    });
    expect(resolve('seenKey(picked.id)', src)).toEqual({
      keys: ['mode_portrait_seen_*'],
    });
  });

  // Контрольные образцы: то, что гейт обязан считать неразрешимым.
  it('параметр, шаблон без префикса и чужое поле — error, а не выдуманный ключ', () => {
    expect(resolve('key', 'export function put(key: string) {}').error).toMatch(
      /не константа/,
    );
    expect(resolve('`${prefix}_x`', '').error).toMatch(
      /без литерального префикса/,
    );
    expect(resolve('KEYS.other', "const KEYS = { a: 'x' };").error).toMatch(
      /нет поля other/,
    );
  });
});
