// @vitest-environment node
// К19/К20 (#1674): на телефоне действия шапки встают в строку надписи, вкладки не сжимаются. CSS в jsdom не исполняется — сверяем исходники.
import { describe, expect, it } from 'vitest';
import { parseRules, readCss, type Rule } from './cssRules.test-helpers';

const decl = (rules: Rule[], sel: string): string => rules.filter((r) => r.selectors.includes(sel)).map((r) => r.body).join(' ');
/** Действия шапки лежат в строке надписи (строка 1), а не своей строкой. */
const inEyebrowRow = (body: string): boolean => /grid-row:\s*1\b/.test(body);

describe('шапка раздела на телефоне: действия в строке надписи', () => {
  it('«Паттерны»: «Настроить экран» и шестерёнка — в строке 1, «Библиотека» — ниже', () => {
    const rules = readCss('client-schemas.css');
    expect(inEyebrowRow(decl(rules, '.cs-head-tools'))).toBe(true);
    expect(decl(rules, '.cs-head-lib')).toMatch(/grid-row:\s*4/);
  });
  it('«Мой путь»: действия — в строке надписи', () => {
    expect(inEyebrowRow(decl(readCss('client-profile-mobile.css'), '.cpf-head-actions'))).toBe(true);
  });
  it('красный образец: действия без строки сетки не считаются лежащими в строке надписи', () => {
    expect(inEyebrowRow(decl(parseRules('.cs-head-tools { display: flex; }'), '.cs-head-tools'))).toBe(false);
  });
});

describe('вкладки: подпись не сжимается и не переносится', () => {
  const rules = readCss('line-tabs.css');
  it.each(['.lt-tab', '.lt-q'])('%s — nowrap', (sel) => expect(decl(rules, sel)).toMatch(/white-space:\s*nowrap/));
  it('пара вида справа на телефоне встаёт под ленту и не отнимает у неё ширину', () => {
    expect(decl(rules, '.lt:has(> .lt-aside) > .lt-strip')).toMatch(/flex:\s*1 1 100%/);
  });
  it('лента с прокруткой не сжимает вкладки', () => expect(decl(rules, '.lt-tab')).toMatch(/flex:\s*0 0 auto/));
});
