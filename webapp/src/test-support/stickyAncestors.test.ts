// @vitest-environment jsdom
// stickyAncestors — классы липких элементов из правил CSS и липкие предки листа в DOM.
// Образец и контрольный образец: sticky под @media находится, relative и комментарий — нет.
import { describe, it, expect } from 'vitest';
import { stickyClasses, stickyAncestorsOf } from './stickyAncestors';
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
