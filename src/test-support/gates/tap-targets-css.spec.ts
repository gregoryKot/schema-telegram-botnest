// check-tap-targets.mjs: размер тап-цели из CSS-класса (docs/open/frontend-ux.md,
// «Гейт тап-целей не видит размеры из CSS-классов»). Раньше считался только
// инлайновый style, и малый тумблер настроек `.ds-switch--sm` (38×22, зона
// `::before` от базового класса — 42×40) проходил мимо. Разбор CSS —
// scripts/tap-targets-css.mjs, кнопки дизайн-системы в CSS — tap-targets-ds.mjs;
// общие случаи гейта — tap-targets.spec.ts.
import { runGate } from './gate-sandbox';
import { callExport, loadStringList } from './pattern-loader';

const GATE = 'check-tap-targets.mjs';
const BASE = 'scripts/tap-targets-baseline.json';
const run = (css: string, tsx: string) =>
  runGate(GATE, {
    'webapp/src/styles/a.css': css + '\n',
    'webapp/src/A.tsx': tsx + '\n',
    [BASE]: '{}',
  });

const ICON = '<button className="ico" onClick={f} aria-label="Удалить" />';
const SWITCH =
  "<div role=\"switch\" onClick={f} className={`sw${small ? ' sw--sm' : ''}`} />";
const SW_CSS = [
  '.sw { position: relative; width: 44px; height: 26px; }',
  ".sw::before { content: ''; position: absolute; inset: -9px -2px; }",
  '.sw--sm { width: 38px; height: 22px; }',
].join('\n');

describe('check-tap-targets.mjs — размер из CSS-класса', () => {
  it('кнопка-иконка 22×22 классом — красный, в отчёте класс', () => {
    const res = run('.ico { width: 22px; height: 22px; }', ICON);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('22×22 (класс ico)');
  });

  it('контроль: зона ::before с отрицательным inset до 44 — зелёный', () => {
    const css = [
      '.ico { position: relative; width: 22px; height: 22px; }',
      ".ico::before { content: ''; position: absolute; inset: -11px; }",
    ].join('\n');
    expect(run(css, ICON).status).toBe(0);
  });

  it('контроль: инлайн задаёт размер — класс не смотрится', () => {
    const tsx = ICON.replace(
      ' />',
      ' style={{ minWidth: 44, minHeight: 44 }} />',
    );
    expect(run('.ico { width: 22px; height: 22px; }', tsx).status).toBe(0);
  });

  it('модификатор ниже в CSS перекрывает размер базы, зона базы не дотягивает — красный 42×40', () => {
    const res = run(SW_CSS, SWITCH);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('42×40');
  });

  it('контроль: своя зона у модификатора — зелёный', () => {
    const css = SW_CSS + '\n.sw--sm::before { inset: -11px -3px; }';
    expect(run(css, SWITCH).status).toBe(0);
  });

  it('контроль: не интерактивный элемент с мелким классом не считается', () => {
    const res = run(
      '.dot { width: 8px; height: 8px; }',
      '<span className="dot" />',
    );
    expect(res.status).toBe(0);
  });
});

const SEG = '.ds-seg-btn { padding: 6px 14px; cursor: pointer; }';
const TOUCH = (rule: string) => `@media (pointer: coarse) { ${rule} }`;

describe('check-tap-targets.mjs — кнопки дизайн-системы в CSS', () => {
  it('ds-класс с cursor: pointer без высоты (только padding) — красный, в отчёте класс', () => {
    const res = run(SEG, '');
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.ds-seg-btn: высота не задана');
  });

  it('контроль: min-height 44 под пальцем (@media) — зелёный', () => {
    expect(
      run(SEG + '\n' + TOUCH('.ds-seg-btn { min-height: 44px; }'), '').status,
    ).toBe(0);
  });

  it('контроль: зона ::before дотягивает 20 до 44 — зелёный', () => {
    const css = [
      '.ds-link { position: relative; height: 20px; cursor: pointer; }',
      ".ds-link::before { content: ''; position: absolute; inset: -12px 0; }",
    ].join('\n');
    expect(run(css, '').status).toBe(0);
  });

  it('модификатор со своей высотой ниже 44 — красный; исключение ds-link--inline — нет', () => {
    const css = [
      '.ds-btn { height: 44px; cursor: pointer; }',
      '.ds-btn--sm { height: 40px; }',
      '.ds-link { min-height: 44px; cursor: pointer; }',
      '.ds-link--inline { display: inline; min-height: 0; }',
    ].join('\n');
    const res = run(css, '');
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.ds-btn--sm: высота 40');
    expect(res.stderr).not.toContain('ds-link--inline');
  });

  it('DS_TARGET_EXEMPT гасит свои классы; контроль: тот же CSS у другого ds-класса — красный', () => {
    const exempt = loadStringList('tap-targets-ds.mjs', 'DS_TARGET_EXEMPT');
    expect(exempt).toContain('ds-link--inline');
    const css = (c: string) =>
      `.${c} { padding: 2px; cursor: pointer; min-height: 0; }`;
    expect(run(exempt.map(css).join('\n'), '').status).toBe(0);
    expect(run(css('ds-link--ctl'), '').status).toBe(1);
  });

  it('контроль: не ds-класс и ds-класс без cursor: pointer не считаются', () => {
    const css =
      '.tcp-anchor { padding: 4px; cursor: pointer; }\n.ds-chip { padding: 5px 10px; }';
    expect(run(css, '').status).toBe(0);
  });
});

describe('tap-targets-css.mjs — чистые функции', () => {
  it('insetGrowth: прирост по осям; 0 — без прироста; не px — null', () => {
    const g = (v: string) =>
      callExport('tap-targets-css.mjs', 'insetGrowth', v);
    expect(g('-9px -2px')).toEqual({ x: 4, y: 18 });
    expect(g('-4px -1px -6px -3px')).toEqual({ x: 4, y: 10 });
    expect(g('0')).toEqual({ x: 0, y: 0 });
    expect(g('auto')).toBeNull();
  });

  it('classTokens: литералы строк и шаблонов, без имён переменных', () => {
    const t = (v: string) =>
      callExport('tap-targets-css.mjs', 'classTokens', v);
    expect(t("`sw${small ? ' sw--sm' : ''}`")).toEqual(['sw--sm', 'sw']);
    expect(t('"a b"')).toEqual(['a', 'b']);
    expect(t("cn('x', on && 'y')")).toEqual(['x', 'y']);
  });
});
