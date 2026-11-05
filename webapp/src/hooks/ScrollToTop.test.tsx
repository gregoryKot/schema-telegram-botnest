// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';
import { shouldResetScroll } from './shouldResetScroll';

const snap = { nav: null as ReturnType<typeof useNavigate> | null };
function Spy() { const navigate = useNavigate(); useEffect(() => { snap.nav = navigate; }); return null; }
const scrollTo = vi.fn();

beforeEach(() => { scrollTo.mockClear(); window.scrollTo = scrollTo as never; });

describe('shouldResetScroll', () => {
  it('новый адрес по PUSH — сброс; тот же адрес, POP и REPLACE — нет', () => {
    expect(shouldResetScroll('/diary', '/today', 'PUSH')).toBe(true);
    expect(shouldResetScroll('/today', '/today', 'PUSH')).toBe(false);
    expect(shouldResetScroll('/diary', '/today', 'POP')).toBe(false);
    expect(shouldResetScroll('/diary', '/today', 'REPLACE')).toBe(false);
  });
});

describe('ScrollToTop', () => {
  it('переход по ссылке сбрасывает прокрутку, «Назад» — нет', () => {
    render(<MemoryRouter initialEntries={['/diary']}><Spy /><ScrollToTop /></MemoryRouter>);
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => snap.nav!('/today'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockClear();
    act(() => snap.nav!(-1));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
