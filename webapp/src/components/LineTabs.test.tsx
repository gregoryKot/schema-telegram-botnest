// @vitest-environment jsdom
// LineTabs — вкладки на линии «Справочника»: выбор кликом, стрелки ←/→ по кругу с фокусом за выбором, тихая пара.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
