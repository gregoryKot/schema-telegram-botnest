// @vitest-environment node
// «Заголовок + картинка в строке» и «картинка + текст + шеврон» — примитивы бумажной аппликации в
// paper.css (правило №3). До 2026-11 первое жило четырьмя локальными правилами (.cw-title-row,
// .qe-head, .ss-title-row, .sh-head), а сетка строки с картинкой — только у страницы «Ещё»
// (.cm-page …:has(> .pp-row-art)): в выборе потребности для плана шеврон уезжал на вторую строку
// (docs/open/frontend-ux.md, хвост #921). CSS в jsdom не исполняется — сверяем исходники.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cssBundle } from './cssBundle.test-helpers';

const SRC = join(__dirname, '..');
// Сборник (sheet-schemas.css) читается вместе с частями (@import): правило могло уехать в ss-sheet.css.
const css = (f: string) => cssBundle(f).replace(/\/\*[\s\S]*?\*\//g, '');
const tsx = (f: string) => readFileSync(join(SRC, f), 'utf8');
const body = (src: string, sel: string) =>
  [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').map((s) => s.trim()).includes(sel)).map((m) => m[2]).join(';');
const paper = css('paper.css');

describe('pp-head — заголовок слева, картинка справа', () => {
  it('объявлен в paper.css: flex, раздвинуты, зазор 12, заголовок сжимается, картинка нет', () => {
    const head = body(paper, '.pp-head');
    expect(head).toMatch(/display: flex/);
    expect(head).toMatch(/justify-content: space-between/);
    expect(head).toMatch(/gap: 12px/);
    expect(body(paper, '.pp-head > :not(.pp-art)')).toMatch(/min-width: 0/);
    expect(body(paper, '.pp-head > .pp-art')).toMatch(/flex: none/);
  });

  it.each([
    ['client-why.css', '.cw-title-row'], ['quick-entry.css', '.qe-head'],
    ['sheet-schemas.css', '.ss-title-row'], ['practice-selfhelp.css', '.sh-head'],
  ])('%s: своей раскладки %s нет', (f, sel) => {
    expect(css(f)).not.toMatch(new RegExp(`${sel.replace('.', '\\.')}[^{]*\\{[^}]*display:\\s*flex`));
  });

  it.each([
    'components/therapy/TalkSheet.tsx',
    'components/schemaSheets/SsHead.tsx', 'sections/practice/SelfHelpSheet.tsx',
  ])('%s: строка заголовка — pp-head', (f) => {
    expect(tsx(f)).toMatch(/className="pp-head[ "]/);
    expect(tsx(f)).not.toMatch(/cw-title-row|qe-head|ss-title-row/);
  });

  // b10a (2026-11): заголовок «Что на уме?» и знак — в листе-герое сущности, а не строкой над полем.
  it('быстрая запись: заголовок со знаком — EntitySheet, своей строки заголовка нет', () => {
    const f = tsx('components/diary/quickEntry/QuickWriteStep.tsx');
    expect(f).toMatch(/<EntitySheet look="diary"/);
    expect(f).not.toMatch(/cw-title-row|qe-head|ss-title-row/);
  });
});

describe('строка-переход с картинкой: сетка «картинка + текст + шеврон» везде', () => {
  it('правило для любого ds-list-row--nav с .pp-row-art — в paper.css', () => {
    expect(body(paper, '.ds-list-row--nav:has(> .pp-row-art)')).toMatch(/grid-template-columns: 44px minmax\(0, 1fr\) auto/);
  });

  it('у «Ещё» своей копии сетки нет', () => {
    expect(css('client-more.css')).not.toMatch(/:has\(> \.pp-row-art\)/);
  });

  it('копий сетки нет нигде, кроме paper.css (раньше ещё cabinet.css и client-more.css)', () => {
    const own = (readdirSync(__dirname) as string[]).filter((f) => f.endsWith('.css'))
      .map((f) => [f, readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')] as const)
      .concat([['index.css', readFileSync(join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')]]);
    const withGrid = own.filter(([, src]) => body(src, '.ds-list-row--nav:has(> .pp-row-art)').includes('grid-template-columns')).map(([f]) => f);
    expect(withGrid).toEqual(['paper.css']);
  });
});
