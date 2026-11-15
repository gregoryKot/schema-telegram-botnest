// check-history-sheet.mjs: оверлей, у которого `position: fixed` и `inset: 0` разнесены по разным
// CSS-правилам или классам. Объявления складываются (history-sheet-css.mjs): у класса — по всем
// его правилам и файлам, у className — по всем его классам. Общие случаи — history-sheet.spec.ts.
import { runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const run = (css: Record<string, string>, tsx: string) =>
  runGate('check-history-sheet.mjs', {
    ...css,
    'webapp/src/Screen.tsx': `${tsx}\n`,
    'scripts/history-sheet-baseline.json': '{}',
  });
const UTILS = {
  'webapp/src/utils.css':
    '.u-fixed { position: fixed; z-index: 90; }\n.u-fill { inset: 0; }\n',
};

describe('check-history-sheet.mjs — fixed и inset: 0 в разных правилах', () => {
  it('fixed у одного класса, inset: 0 у другого в одном className — красный, оба класса в сообщении', () => {
    const res = run(
      UTILS,
      'export const S = () => <div className="u-fixed u-fill" />;',
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Screen.tsx › S');
    expect(res.stderr).toContain('классы «u-fixed» + «u-fill»');
  });

  it('контроль: те же классы на разных элементах — не оверлей', () => {
    const tsx =
      'export const S = () => <div className="u-fixed"><i className="u-fill" /></div>;';
    expect(run(UTILS, tsx).status).toBe(0);
  });

  it('один селектор в разных правилах и файлах — оверлей; контроль: fixed без пары — нет', () => {
    const css = {
      'webapp/src/a.css':
        '.sheet { position: fixed; }\n.lone { position: fixed; }\n',
      'webapp/src/b.css':
        '@media (max-width: 600px) { .sheet { inset: 0; } }\n.other { inset: 0; }\n',
    };
    const red = run(css, 'export const S = () => <div className="sheet" />;');
    expect(red.status).toBe(1);
    expect(red.stderr).toContain('класс «sheet»');
    expect(
      run(css, 'export const S = () => <div className="lone" />;').status,
    ).toBe(0);
  });
});

// Чистые функции модуля пинятся напрямую: сломанный разбор молча не видел бы ни одного класса.
describe('history-sheet-css.mjs — чистые функции', () => {
  const css = (mapExpr: string): unknown =>
    JSON.parse(
      importExport('history-sheet-css.mjs', 'classDeclarations', mapExpr),
    );

  it('classDeclarations: класс складывает свои правила из разных файлов; ::before и комментарий — не в счёт', () => {
    const texts = [
      '.a { position: fixed; } .d::before { position: fixed; inset: 0; }',
      '.x .a { inset: 0; } /* .g { position: fixed; } */',
    ];
    const got = css(
      `(fn) => Object.fromEntries(fn(${JSON.stringify(texts)}))`,
    ) as Record<string, string>;
    expect(Object.keys(got)).toEqual(['a']);
    expect(got.a).toMatch(/position: fixed;.*inset: 0;/s);
  });

  it('classOverlays: свой класс-оверлей и пара классов одного className — находки со строкой', () => {
    const src =
      'const A = <i className="whole" />;\nconst B = <i className={cx("u-fix", on && "u-fill")} />;';
    const decls =
      "new Map([['whole', 'position: fixed; inset: 0;'], ['u-fix', 'position: fixed;'], ['u-fill', 'inset: 0;']])";
    const hits = JSON.parse(
      importExport(
        'history-sheet-css.mjs',
        'classOverlays',
        `(fn) => fn(${JSON.stringify(src)}, ${decls})`,
      ),
    ) as { line: number; what: string }[];
    expect(hits.map((h) => [h.line, h.what])).toEqual([
      [1, 'класс «whole» (CSS: fixed + весь экран)'],
      [2, 'классы «u-fix» + «u-fill» (CSS: fixed + весь экран вместе)'],
    ]);
  });
});
