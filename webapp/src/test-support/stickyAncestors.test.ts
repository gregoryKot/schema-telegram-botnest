// @vitest-environment jsdom
// stickyAncestors — классы липких элементов из правил CSS и липкие предки листа в DOM.
// Образец и контрольный образец: sticky под @media находится, relative и комментарий — нет.
import { describe, it, expect } from 'vitest';
import { stickyClasses, stickyAncestorsOf, openFromSticky } from './stickyAncestors';
import { allCssRules, indexCssRules, parseRules } from '../styles/cssRules.test-helpers';

describe('stickyClasses', () => {
  it('находит класс с position: sticky, в том числе под @media и в ветке списка селекторов', () => {
    const css = `
      .a { position: sticky; top: 0; }
      @media (min-width: 1024px) { .wrap .b, .c > .d { top: 8px; position: sticky; } }
      .e { position: relative; z-index: 2; }
      /* .f { position: sticky } */
    `;
    expect([...stickyClasses(parseRules(css))].sort()).toEqual(['a', 'b', 'd']);
  });

  it('в исходниках есть липкая колонка разворота и липкая шапка листа', () => {
    const real = stickyClasses([...indexCssRules(), ...allCssRules()]);
    expect(real.has('pa-spread-side')).toBe(true);
    expect(real.has('ex2-top')).toBe(true);
  });
});

describe('stickyAncestorsOf', () => {
  it('возвращает липких предков от ближнего к дальнему и пусто без них', () => {
    document.body.innerHTML = '<div class="a"><div class="x"><div class="b"><p id="in"></p></div></div></div><p id="out"></p>';
    const sticky = new Set(['a', 'b']);
    expect(stickyAncestorsOf(document.getElementById('in')!, sticky)).toEqual(['div.b', 'div.a']);
    expect(stickyAncestorsOf(document.getElementById('out')!, sticky)).toEqual([]);
  });
});

describe('openFromSticky', () => {
  it('липкие предки открывающего и листа после тапа: лист в колонке, вне её, не открылся', () => {
    document.body.innerHTML = '<div class="a"><button id="open"></button><div id="in"></div></div><div id="out"></div>';
    const sticky = new Set(['a']);
    const opener = document.getElementById('open')!;
    const openInto = (id: string) => () => { document.getElementById(id)!.innerHTML = '<section class="sheet"></section>'; };
    const sheetIn = (id: string) => () => document.querySelector(`#${id} .sheet`);
    expect(openFromSticky(opener, openInto('in'), sheetIn('in'), sticky)).toEqual({ from: ['div.a'], sheet: ['div.a'] });
    expect(openFromSticky(opener, openInto('out'), sheetIn('out'), sticky)).toEqual({ from: ['div.a'], sheet: [] });
    expect(openFromSticky(opener, () => {}, () => null, sticky)).toEqual({ from: ['div.a'], sheet: null });
  });
});
