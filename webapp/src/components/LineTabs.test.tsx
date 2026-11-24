// @vitest-environment jsdom
// LineTabs — вкладки на линии «Справочника»: выбор кликом, стрелки ←/→ по кругу с фокусом за выбором, тихая пара.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { LineTabs } from './LineTabs';
import { stepTab } from './lineTabsModel';

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() as never; });

const TABS = [{ id: 'a', label: 'Первая' }, { id: 'b', label: 'Вторая' }, { id: 'c', label: 'Третья' }] as const;
type Id = (typeof TABS)[number]['id'];

function Harness({ look = 'scroll' as 'scroll' | 'fill' | 'quiet', onPick = (_: Id) => {} }) {
  const [v, setV] = useState<Id>('a');
  return <LineTabs tabs={TABS} value={v} label="Разделы" look={look} onPick={(id) => { setV(id); onPick(id); }} />;
}
const selected = () => screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent);

describe('LineTabs', () => {
  it('клик выбирает вкладку; у выбранной tabIndex 0, у остальных -1', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    expect(screen.getByRole('tablist', { name: 'Разделы' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Вторая' }));
    expect(onPick).toHaveBeenCalledWith('b');
    expect(selected()).toEqual(['Вторая']);
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('стрелки ходят по кругу, фокус — за выбором; Home/End — к краям', () => {
    render(<Harness look="fill" />);
    const first = screen.getByRole('tab', { name: 'Первая' });
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(selected()).toEqual(['Третья']);
    expect(document.activeElement?.textContent).toBe('Третья');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(selected()).toEqual(['Первая']);
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(selected()).toEqual(['Третья']);
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(selected()).toEqual(['Третья']);
  });

  it('тихая пара: разделитель скрыт от диктора, второй капсулы нет', () => {
    const { container } = render(<Harness look="quiet" />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Первая', 'Вторая', 'Третья']);
    expect(container.querySelectorAll('.lt-sep[aria-hidden="true"]')).toHaveLength(2);
    expect(container.querySelector('.lt')).toBeNull();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Первая' }), { key: 'ArrowRight' });
    expect(selected()).toEqual(['Вторая']);
  });

  it('stepTab: шаги по кругу и мимо чужих клавиш', () => {
    expect(stepTab(['a', 'b'], 'b', 'ArrowRight')).toBe('a');
    expect(stepTab(['a', 'b'], 'a', 'ArrowLeft')).toBe('b');
    expect(stepTab(['a', 'b'], 'a', 'Tab')).toBeNull();
    expect(stepTab([], 'a', 'ArrowRight')).toBeNull();
  });

  it('число у пункта — тихое ds-count; null — числа нет; поле встаёт на место пункта; подсказка — title', () => {
    const tabs = [
      { id: 'a', label: 'Все', count: 4, title: 'Всего записей' },
      { id: 'b', label: 'Случаи', count: null },
      { id: 'c', label: 'Карта', field: <input aria-label="Название карты" /> },
    ];
    const onPick = vi.fn();
    render(<LineTabs tabs={tabs} value="b" onPick={onPick} label="Записи" look="scroll" />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Все4', 'Случаи']);
    expect(screen.getByRole('tab', { name: /Все/ }).querySelector('.ds-count.lt-count')?.textContent).toBe('4');
    expect(screen.getByRole('tab', { name: /Все/ }).title).toBe('Всего записей');
    expect(screen.getByRole('textbox', { name: 'Название карты' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('tab', { name: /Случаи/ }), { key: 'ArrowRight' });
    expect(onPick).toHaveBeenLastCalledWith('a'); // поле стрелкой не выбирается
  });

  it('выбор ещё не пришёл — по Tab в ленту ведёт первый пункт', () => {
    render(<LineTabs tabs={TABS} value={'x' as Id} onPick={() => {}} label="Разделы" look="scroll" />);
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it('лента: край затухает, только когда за ним есть пункты', () => {
    let box = { scrollLeft: 0, clientWidth: 200, scrollWidth: 320 };
    for (const key of ['scrollLeft', 'clientWidth', 'scrollWidth'] as const) {
      Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => box[key] });
    }
    render(<Harness />);
    const strip = screen.getByRole('tablist');
    expect([strip.hasAttribute('data-fade-start'), strip.hasAttribute('data-fade-end')]).toEqual([false, true]);
    box = { scrollLeft: 120, clientWidth: 200, scrollWidth: 320 };
    fireEvent.scroll(strip);
    expect([strip.hasAttribute('data-fade-start'), strip.hasAttribute('data-fade-end')]).toEqual([true, false]);
    for (const key of ['scrollLeft', 'clientWidth', 'scrollWidth'] as const) delete (HTMLElement.prototype as never)[key];
  });

  it('маска края — только по атрибуту края на модификаторе ленты .ds-seg--fade', () => {
    const css = readFileSync(join(__dirname, '../styles/cabinet.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const masked = [...css.matchAll(/([^{}]+)\{[^{}]*mask-image[^{}]*\}/g)].map((m) => m[1].trim());
    expect(masked.filter((s) => s.includes('ds-seg'))).toEqual([
      '.ds-seg--fade[data-fade-end]', '.ds-seg--fade[data-fade-start]', '.ds-seg--fade[data-fade-start][data-fade-end]',
    ]);
  });
});
