// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { GUIDE_MARK_FRAGMENT_MAX } from '../../../../../../shared/src/limits/textLimits';
import { normalizeSelectionText, readGuideSelection } from './guideSelection';

afterEach(() => { document.body.innerHTML = ''; window.getSelection()?.removeAllRanges(); });

function mount(html: string) {
  document.body.innerHTML = html;
  return document.querySelector('.gd-page')!;
}
function select(from: Node, to: Node, a = 0, b?: number) {
  const r = document.createRange();
  r.setStart(from, a);
  r.setEnd(to, b ?? (to.textContent?.length ?? 0));
  const s = window.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
  return s;
}
const text = (sel: string) => document.querySelector(sel)!.firstChild!;

describe('normalizeSelectionText', () => {
  it('схлопывает пробелы и переносы', () => {
    expect(normalizeSelectionText('  а \n\n б\t в ')).toBe('а б в');
  });
  it('длинное режет по границе слова и ставит «…», в пределе', () => {
    const long = 'слово '.repeat(1000);
    const out = normalizeSelectionText(long);
    expect(out.length).toBeLessThanOrEqual(GUIDE_MARK_FRAGMENT_MAX);
    expect(out.endsWith('слово…')).toBe(true);
    expect(normalizeSelectionText('коротко')).toBe('коротко');
  });
});

describe('readGuideSelection', () => {
  const page = `<div class="gd-page">
    <section data-address="mode:a/goal"><p id="g">Цель режима здесь</p></section>
    <section data-address="mode:a/stuck"><p id="s">Где застревают</p></section>
    <div id="free"><p id="p">Пункт из подробнее</p></div>
    <textarea id="t">заметка терапевта</textarea>
  </div><div id="outside">Чужой текст вокруг</div>`;

  it('адрес — ближайший раздел у начала выделения', () => {
    const root = mount(page);
    const sel = select(text('#g'), text('#g'), 0, 4);
    expect(readGuideSelection(sel, root)).toEqual({ text: 'Цель', address: 'mode:a/goal' });
  });

  it('выделение через два раздела — адрес первого', () => {
    const root = mount(page);
    const sel = select(text('#g'), text('#s'), 5, 5);
    expect(readGuideSelection(sel, root)?.address).toBe('mode:a/goal');
  });

  it('место без адреса («Подробнее») — первый раздел листа', () => {
    const root = mount(page);
    const sel = select(text('#p'), text('#p'), 0, 5);
    expect(readGuideSelection(sel, root)).toEqual({ text: 'Пункт', address: 'mode:a/goal' });
  });

  it('пусто, коротко, вне листа и в поле ввода — null', () => {
    const root = mount(page);
    expect(readGuideSelection(null, root)).toBeNull();
    expect(readGuideSelection(window.getSelection(), root)).toBeNull();
    expect(readGuideSelection(select(text('#g'), text('#g'), 0, 2), root)).toBeNull();
    expect(readGuideSelection(select(text('#outside'), text('#outside'), 0, 5), root)).toBeNull();
    const area = document.querySelector('textarea')!;
    expect(readGuideSelection(select(area.firstChild!, area.firstChild!, 0, 6), root)).toBeNull();
  });

  it('лист без разделов с адресом или внутри листа отметки — null', () => {
    const root = mount('<div class="gd-page"><p id="x">Просто текст листа</p></div>');
    expect(readGuideSelection(select(text('#x'), text('#x'), 0, 6), root)).toBeNull();
    const sheet = mount('<div class="gd-page" data-no-guide-mark><section data-address="mode:a/goal"><p id="y">Текст цели</p></section></div>');
    expect(readGuideSelection(select(text('#y'), text('#y'), 0, 5), sheet)).toBeNull();
  });
});
