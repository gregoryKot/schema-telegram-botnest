// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

let startParam: string | null = null;
vi.mock('../../../shared/src/host', () => ({
  getHost: () => ({ startParam: () => startParam }),
}));
import { useStartParam } from './useStartParam';
import { rememberLaunchParam } from '../../../shared/src/host/startParam';

function setup(param: string | null, entry: string, enabled = true) {
  startParam = param;
  const onAction = vi.fn();
  const onHandled = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
  const view = renderHook(
    ({ on }: { on: boolean }) => {
      useStartParam(on, onAction, onHandled);
      return useLocation();
    },
    { wrapper, initialProps: { on: enabled } },
  );
  return { onAction, onHandled, ...view };
}

beforeEach(() => {
  cleanup();
  startParam = null;
  localStorage.clear();
});

describe('useStartParam', () => {
  it('pair_ и therapy_ отдают действие присоединения, адрес очищается', () => {
    const a = setup('pair_AB12', '/today?startapp=pair_AB12');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'join', joinKind: 'pair', code: 'AB12' });
    expect(a.result.current.search).toBe('');
    cleanup();
    const b = setup('therapy_XY', '/today?startapp=therapy_XY&x=1');
    expect(b.onAction).toHaveBeenCalledWith({ kind: 'join', joinKind: 'therapy', code: 'XY' });
    expect(b.result.current.search).toBe('?x=1');
  });

  it('diaries ведёт в /diary без вызова onAction', () => {
    const a = setup('diaries', '/today?startapp=diaries');
    expect(a.result.current.pathname).toBe('/diary');
    expect(a.result.current.search).toBe('');
    expect(a.onAction).not.toHaveBeenCalled();
  });

  it('tracker отдаёт действие tracker (параметр из хоста, адрес без параметра не трогаем)', () => {
    const a = setup('tracker', '/today');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'tracker' });
    expect(a.result.current.pathname).toBe('/today');
  });

  it('неизвестный параметр игнорируется, но из адреса убирается', () => {
    const a = setup('evil', '/today?startapp=evil');
    expect(a.onAction).not.toHaveBeenCalled();
    expect(a.result.current.pathname).toBe('/today');
    expect(a.result.current.search).toBe('');
  });

  it('пока enabled=false ничего не делает; после включения срабатывает один раз', () => {
    const a = setup('tracker', '/today', false);
    expect(a.onAction).not.toHaveBeenCalled();
    a.rerender({ on: true });
    expect(a.onAction).toHaveBeenCalledTimes(1);
    a.rerender({ on: true });
    a.rerender({ on: false });
    a.rerender({ on: true });
    expect(a.onAction).toHaveBeenCalledTimes(1);
  });

  it('onHandled — один раз после разбора, и с действием, и без (очередь входов знает, что ссылки нет)', () => {
    const a = setup(null, '/today', false);
    expect(a.onHandled).not.toHaveBeenCalled();
    a.rerender({ on: true });
    expect(a.onHandled).toHaveBeenCalledTimes(1);
    a.rerender({ on: true });
    expect(a.onHandled).toHaveBeenCalledTimes(1);
    cleanup();
    const b = setup('pair_AB12', '/today?startapp=pair_AB12');
    expect(b.onAction).toHaveBeenCalledTimes(1);
    expect(b.onHandled).toHaveBeenCalledTimes(1);
  });

  // Аудит 2026-11, U2: кнопка уведомления о задании вела на «Сегодня».
  it('tasks_<id> уводит на «Ещё» и отдаёт действие с id задания', () => {
    const a = setup('tasks_42', '/today?startapp=tasks_42');
    expect(a.result.current.pathname).toBe('/more');
    expect(a.result.current.search).toBe('');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'tasks', taskId: 42 });
  });

  it('ysq отдаёт действие теста, адрес остаётся на месте', () => {
    const a = setup('ysq', '/today?startapp=ysq');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'ysq' });
    expect(a.result.current.pathname).toBe('/today');
  });

  // Кнопка web_app в Telegram/MAX открывает адрес как есть: start_param хоста пуст.
  it('хост без start_param — параметр берётся из адреса', () => {
    const a = setup(null, '/today?startapp=ysq');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'ysq' });
    expect(a.result.current.search).toBe('');
  });

  // Аудит 2026-11, U3: ссылка-приглашение на сайт без входа — /login терял адрес.
  it('параметр, отложенный до входа (RequireAuth), срабатывает после входа один раз', () => {
    rememberLaunchParam('?startapp=therapy_XY');
    const a = setup(null, '/today');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'join', joinKind: 'therapy', code: 'XY' });
    cleanup();
    const b = setup(null, '/today');
    expect(b.onAction).not.toHaveBeenCalled();
  });

  it('свежая ссылка сильнее отложенной, а отложенная всё равно стирается', () => {
    rememberLaunchParam('?startapp=therapy_OLD');
    const a = setup('tracker', '/today');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'tracker' });
    cleanup();
    const b = setup(null, '/today');
    expect(b.onAction).not.toHaveBeenCalled();
  });
});
