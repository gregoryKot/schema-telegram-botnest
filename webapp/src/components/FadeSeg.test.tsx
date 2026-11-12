// @vitest-environment jsdom
// FadeSeg — прокручиваемый сегмент: край затухает только там, где за ним есть пункты (ревью вёрстки
// r1: лента карт и вкладки справочника резались по букве), выбранный пункт доводится до видимого.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FadeSeg } from './FadeSeg';

const scrollIntoView = vi.fn();
let box = { scrollLeft: 0, clientWidth: 200, scrollWidth: 200 };

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView as never;
  for (const key of ['scrollLeft', 'clientWidth', 'scrollWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => box[key] });
  }
});
afterEach(cleanup);

const seg = (active: string) => (
  <FadeSeg role="group" label="Карты" watch={active} className="extra">
    {['a', 'b', 'c'].map((id) => <button key={id} type="button" aria-pressed={active === id} className="ds-seg-btn">{id}</button>)}
  </FadeSeg>
);

describe('FadeSeg', () => {
  it('всё входит — затухания нет; классы сегмента и свой класс на месте', () => {
    box = { scrollLeft: 0, clientWidth: 200, scrollWidth: 200 };
    render(seg('a'));
    const el = screen.getByRole('group', { name: 'Карты' });
    expect(el.className).toBe('ds-seg ds-seg--scroll ds-seg--fade extra');
    expect(el.hasAttribute('data-fade-end')).toBe(false);
    expect(el.hasAttribute('data-fade-start')).toBe(false);
  });

  it('за правым краем есть пункты — затухает правый; после прокрутки в конец — левый', () => {
    box = { scrollLeft: 0, clientWidth: 200, scrollWidth: 320 };
    render(seg('a'));
    const el = screen.getByRole('group');
    expect(el.hasAttribute('data-fade-end')).toBe(true);
    expect(el.hasAttribute('data-fade-start')).toBe(false);
    box = { scrollLeft: 120, clientWidth: 200, scrollWidth: 320 };
    fireEvent.scroll(el);
    expect(el.hasAttribute('data-fade-end')).toBe(false);
    expect(el.hasAttribute('data-fade-start')).toBe(true);
  });

  it('выбранный пункт доводится до видимого без рывка ленты (nearest), смена выбора — снова', () => {
    const { rerender } = render(seg('a'));
    rerender(seg('c'));
    const last = scrollIntoView.mock.instances[scrollIntoView.mock.instances.length - 1] as HTMLElement;
    expect(last.textContent).toBe('c');
    expect(scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ inline: 'nearest', block: 'nearest' }));
  });

  it('маска объявлена на модификаторе .ds-seg--fade и только по атрибуту края — общий .ds-seg--scroll не тронут', () => {
    const css = readFileSync(join(__dirname, '../styles/cabinet.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const masked = [...css.matchAll(/([^{}]+)\{[^{}]*mask-image[^{}]*\}/g)].map((m) => m[1].trim());
    expect(masked.filter((s) => s.includes('ds-seg'))).toEqual([
      '.ds-seg--fade[data-fade-end]', '.ds-seg--fade[data-fade-start]', '.ds-seg--fade[data-fade-start][data-fade-end]',
    ]);
  });
});
