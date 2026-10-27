// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTherapyTarget } from './useTherapyTarget';

const track = vi.hoisted(() => vi.fn());
vi.mock('./trackTherapyNudge', () => ({ trackTherapyNudge: track }));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

beforeEach(() => { localStorage.clear(); track.mockClear(); });
afterEach(cleanup);

describe('useTherapyTarget', () => {
  it('терапевт не подключён: write нет, open пишет событие и поднимает лист', () => {
    const { result } = renderHook(() => useTherapyTarget('more', 'crisis'), { wrapper });
    expect(result.current.hidden).toBe(false);
    expect(result.current.write).toBeUndefined();
    expect(result.current.sheet).toBeNull();
    act(() => result.current.open());
    expect(track).toHaveBeenCalledWith('more', 'open', 'crisis');
    expect(result.current.sheet).not.toBeNull();
  });

  it('терапевт подключён: write со ссылкой на него, onClick пишет write', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    const { result } = renderHook(() => useTherapyTarget('home'), { wrapper });
    expect(result.current.write?.url).toBe('tg://user?id=42');
    result.current.write?.onClick();
    expect(track).toHaveBeenCalledWith('home', 'write', undefined);
  });

  it('пользователь сам терапевт: hidden', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    const { result } = renderHook(() => useTherapyTarget('home'), { wrapper });
    expect(result.current.hidden).toBe(true);
  });
});
