// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { ScrollLock } from './ScrollLock';
import { markSheetOpen } from './openSheets';

describe('ScrollLock', () => {
  it('открытый лист блокирует прокрутку страницы, закрытие возвращает', () => {
    document.documentElement.style.overflow = 'auto';
    render(<ScrollLock />);
    expect(document.documentElement.style.overflow).toBe('auto');
    let unmark = () => {};
    act(() => { unmark = markSheetOpen('a'); });
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    act(() => unmark());
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(document.body.style.overflow).toBe('');
  });

  it('два листа подряд: страница разблокируется после последнего', () => {
    render(<ScrollLock />);
    let u1 = () => {};
    let u2 = () => {};
    act(() => { u1 = markSheetOpen('a'); u2 = markSheetOpen('b'); });
    act(() => u1());
    expect(document.body.style.overflow).toBe('hidden');
    act(() => u2());
    expect(document.body.style.overflow).toBe('');
  });
});
