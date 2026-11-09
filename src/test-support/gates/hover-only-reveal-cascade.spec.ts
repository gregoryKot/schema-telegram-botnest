// check-hover-only-reveal.mjs: каскад и `<style>` в .tsx (docs/open/frontend-ux.md,
// «Гейт check-hover-only-reveal.mjs не считает каскад»). Раскрытие для пальца,
// проигравшее сокрытию по специфичности или порядку, раньше засчитывалось — а
// на телефоне кнопка оставалась невидимой. Шаблонные `<style>` лендингов и
// статей гейт не видел вовсе. Общие образцы гейта — hover-only-reveal.spec.ts.
import { runGate } from './gate-sandbox';
import { callExport } from './pattern-loader';

const SCRIPT = 'check-hover-only-reveal.mjs';
const css = (...lines: string[]) => lines.join('\n') + '\n';
const run = (file: string, content: string) =>
  runGate(SCRIPT, { [file]: content });

const HOVER = '.row:hover .x, .x:focus-visible { opacity: 1; }';
const TOUCH = '@media (hover: none) { .x { opacity: 1; } }';
const TOUCH_STRONG = '@media (hover: none) { .row .x { opacity: 1; } }';

describe('check-hover-only-reveal.mjs — раскрытие обязано выиграть каскад', () => {
  it('путь для пальца выше в файле, сокрытие специфичнее — красный', () => {
    const res = run(
      'webapp/src/a.css',
      css(TOUCH, '.row .x { opacity: 0; }', HOVER),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/a.css:2');
    expect(res.stderr).toContain('нет пути для пальца');
  });

  it('контроль: тот же путь ниже сокрытия той же специфичности — зелёный', () => {
    const res = run(
      'webapp/src/a.css',
      css('.row .x { opacity: 0; }', HOVER, TOUCH_STRONG),
    );
    expect(res.status).toBe(0);
  });

  it('контроль: путь выше, но специфичнее сокрытия — зелёный', () => {
    const res = run(
      'webapp/src/a.css',
      css(TOUCH_STRONG, '.x { opacity: 0; }', HOVER),
    );
    expect(res.status).toBe(0);
  });
});

describe('check-hover-only-reveal.mjs — <style> в .tsx', () => {
  const page = (style: string) =>
    [
      'export function Landing() {',
      '  return (',
      '    <div>',
      `      <style>{\`\n${style}\n\`}</style>`,
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');

  it('шаблон с сокрытием и раскрытием только по :hover — красный, строка файла', () => {
    const res = run(
      'webapp/src/pages/Landing.tsx',
      page('.card .more { opacity: 0; }\n.card:hover .more { opacity: 1; }'),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/pages/Landing.tsx:5');
  });

  it('контроль: оба пути без hover — зелёный', () => {
    const style = [
      '.card .more { opacity: 0; }',
      '.card:hover .more, .card:focus-within .more { opacity: 1; }',
      '@media (hover: none) { .card .more { opacity: 1; } }',
    ].join('\n');
    expect(run('webapp/src/pages/Landing.tsx', page(style)).status).toBe(0);
  });

  it('<style>{ИМЯ}</style> с шаблонной константой файла — тоже сканируется', () => {
    const src = [
      'const CSS = `.a .b { visibility: hidden; }',
      '.a:hover .b { visibility: visible; }`;',
      'export const P = () => <style>{CSS}</style>;',
      '',
    ].join('\n');
    const res = run('shared/src/P.tsx', src);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared/src/P.tsx:1');
  });
});

describe('check-hover-only-reveal.mjs — specificity', () => {
  const spec = (s: string) => callExport(SCRIPT, 'specificity', s);
  it.each([
    ['.row:hover .x', [0, 3, 0]],
    ['#id .x', [1, 1, 0]],
    ['a::before', [0, 0, 2]],
    [':where(.a) .b', [0, 1, 0]],
    ['[data-open] .y', [0, 2, 0]],
    [':not(.a) li', [0, 1, 1]],
  ])('%s → %j', (sel, want) => {
    expect(spec(sel)).toEqual(want);
  });
});
