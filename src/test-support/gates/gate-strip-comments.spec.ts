// Тест общего сканера scripts/gate-strip-comments.mjs — его используют
// check-render-poison.mjs и check-color-drift.mjs, чтобы не считать
// нарушением то, что написано в комментарии (пояснение «Без backdrop-filter
// — см. BottomNav.tsx», номер PR `#516`, старый цвет в примечании).
//
// Сканер — ровно та точка, где гейт может замолчать целиком: стёр лишнее —
// и настоящие нарушения исчезли вместе с комментариями. Поэтому здесь
// проверяются оба направления: комментарий гасится, а код рядом остаётся.
// Ветка `isCss: true` (в CSS `//` комментарием не является) запинена в
// render-poison.spec.ts случаем с `url(https://…)` в одном объявлении с
// размытием.
import { callExport } from './pattern-loader';

const strip = (src: string) =>
  callExport('gate-strip-comments.mjs', 'stripComments', src);

describe('gate-strip-comments.mjs', () => {
  it('`//`-комментарий стирается, а код на соседних строках цел', () => {
    const out = strip("// старый цвет был '#ef4444'\nconst a = '#ef4444';\n");
    expect(out).not.toContain('// старый цвет');
    expect(out).toContain("const a = '#ef4444';");
  });

  it('число строк не меняется — номера строк в отчёте гейта не съезжают', () => {
    const out = strip(
      'const a = 1;\n// пояснение\n/* блок\n   на две строки */\nconst b = 2;\n',
    );
    expect(out.split('\n')).toHaveLength(6);
    expect(out.split('\n')[4]).toBe('const b = 2;');
  });

  it('многострочный /* */ гасится целиком', () => {
    const out = strip(
      '/* rgba(239,68,68,0.08)\n   осталось в примечании */\nconst a = 1;\n',
    );
    expect(out).not.toContain('rgba(239,68,68');
    expect(out).toContain('const a = 1;');
  });

  it('`//` внутри строкового литерала комментарием не считается', () => {
    const out = strip(
      "const u = 'https://cdn.example.com/x.png'; const c = '#ef4444';\n",
    );
    expect(out).toContain('https://cdn.example.com/x.png');
    expect(out).toContain("'#ef4444'");
  });

  it('хвостовой комментарий гасится, а объявление перед ним остаётся', () => {
    const out = strip("export const MOSS = '#4a6335'; // зелёный статус\n");
    expect(out).toContain("'#4a6335'");
    expect(out).not.toContain('зелёный статус');
  });
});
