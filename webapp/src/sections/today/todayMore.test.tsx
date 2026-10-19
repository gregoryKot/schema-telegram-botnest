// @vitest-environment jsdom
// «Что ещё можно сегодня» на телефоне: память раскрытия (ключ общий с мини-аппом)
// и сама раскрывашка.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  renderHook,
  act,
} from '@testing-library/react';
import { setSecondaryHidden } from '../../../../shared/src/today/todayFocus';
import {
  TODAY_MORE_KEY,
  initialMoreOpen,
  useTodayMore,
  writeMoreOpen,
} from './todayMore';
import { TodayMoreToggle } from './TodayMoreToggle';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('todayMore', () => {
  it('ключ памяти совпадает с мини-аппом (выбор один на оба фронтенда)', () => {
    const mini = readFileSync(
      resolve(
        __dirname,
        '../../../../schema-miniapp/src/sections/today/helpers.ts',
      ),
      'utf8',
    );
    expect(mini).toContain(`TODAY_MORE_KEY = '${TODAY_MORE_KEY}'`);
  });

  it('по умолчанию свёрнуто', () => {
    expect(initialMoreOpen()).toBe(false);
  });

  it('запомненное «раскрыто» уважается', () => {
    localStorage.setItem(TODAY_MORE_KEY, '1');
    expect(initialMoreOpen()).toBe(true);
  });

  it('выключенное «прятать второстепенное» раскрывает блок', () => {
    setSecondaryHidden(false);
    expect(initialMoreOpen()).toBe(true);
  });

  it('недоступная память не роняет переключение — writeMoreOpen сообщает false', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    expect(writeMoreOpen(true)).toBe(false);
    spy.mockRestore();
    expect(writeMoreOpen(true)).toBe(true);
    expect(localStorage.getItem(TODAY_MORE_KEY)).toBe('1');
  });

  it('переключение пишет и снимает память', () => {
    const { result } = renderHook(() => useTodayMore());
    expect(result.current.open).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    expect(localStorage.getItem(TODAY_MORE_KEY)).toBe('1');
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
    expect(localStorage.getItem(TODAY_MORE_KEY)).toBeNull();
  });
});

describe('TodayMoreToggle', () => {
  it('подпись и aria-expanded зависят от состояния', () => {
    const calls: number[] = [];
    const { rerender } = render(
      <TodayMoreToggle open={false} onToggle={() => calls.push(1)} />,
    );
    const btn = screen.getByRole('button', { name: /Что ещё можно сегодня/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(calls).toHaveLength(1);
    rerender(<TodayMoreToggle open onToggle={() => {}} />);
    expect(
      screen
        .getByRole('button', { name: /Свернуть/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });
});
