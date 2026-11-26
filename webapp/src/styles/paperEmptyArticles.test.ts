// @vitest-environment node
// #1674, К18 и К22: пустое состояние и карточка статьи лежат на бумаге страницы между линиями — без цветного листа
// вокруг пустого состояния, без белой коробки с рамкой и тенью у статьи. CSS в jsdom не исполняется — сверяем исходники.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules, readCss, type Rule } from './cssRules.test-helpers';

const SRC = join(__dirname, '..');
const BOX = /(^|;)\s*(background(-color)?:\s*[^;]*var\(--surface\)|box-shadow:\s*(?!none)[^;]+|border:\s*(?!0|none)[^;]+)/;

/** Правила карточки статьи, красящие коробку: белый фон, тень или рамка со всех сторон. */
const boxedCards = (rules: Rule[]): string[] => rules
  .filter((r) => r.selectors.some((s) => /^\.ac-card\b(?!-)/.test(s) && !s.includes(':hover')) && BOX.test(r.body))
  .map((r) => r.selectors.join(', '));

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
});

/** Файлы, где `PaperEmpty` стоит прямо внутри цветного листа `pp-paper` (в трёх строках над ним). */
const emptyOnSheet = (files: Record<string, string>): string[] => Object.entries(files).filter(([, src]) => {
  const lines = src.split('\n');
  return lines.some((l, i) => /<PaperEmpty\b/.test(l) && lines.slice(Math.max(0, i - 3), i).some((x) => /className="[^"]*\bpp-paper\b/.test(x)));
}).map(([f]) => f);

describe('К22: карточка статьи без коробки', () => {
  it('.ac-card — только линия сверху: ни белого фона, ни тени, ни рамки', () => {
    expect(boxedCards(readCss('article-card.css'))).toEqual([]);
  });
  it('разметка карточки и силуэта не берёт ds-card', () => {
    for (const f of ['pages/landing/ArticleCard.tsx', 'pages/ArticleSkeletons.tsx']) {
      expect(readFileSync(join(SRC, f), 'utf8'), f).not.toMatch(/ds-card/);
    }
  });
  it('красный образец: белая коробка с тенью; контрольный: линия сверху', () => {
    expect(boxedCards(parseRules('.ac-card { background: var(--surface); box-shadow: var(--shadow-1); }'))).toEqual(['.ac-card']);
    expect(boxedCards(parseRules('.ac-card { padding-top: 20px; border-top: 1px solid var(--panel-line); }'))).toEqual([]);
  });
});

describe('К18: пустое состояние на бумаге страницы', () => {
  it('PaperEmpty нигде не стоит внутри цветного листа pp-paper', () => {
    const files = Object.fromEntries(walk(SRC).map((f) => [f, readFileSync(f, 'utf8')]));
    expect(emptyOnSheet(files)).toEqual([]);
  });
  it('заголовок пустого состояния — serif', () => {
    const rule = readCss('paper.css').find((r) => r.selectors.includes('.pp-empty-text > .ds-list-title'));
    expect(rule?.body).toContain('var(--serif)');
  });
  it('красный образец: PaperEmpty на листе; контрольный: на блоке между линиями', () => {
    expect(emptyOnSheet({ a: '<div className="u-col8 pp-paper x">\n<PaperEmpty/>' })).toEqual(['a']);
    expect(emptyOnSheet({ a: '<div className="u-col8 pp-block x">\n<PaperEmpty/>' })).toEqual([]);
  });
});
