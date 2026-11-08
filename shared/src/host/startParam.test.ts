// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PENDING_LAUNCH_KEY,
  parseStartParam,
  rememberLaunchParam,
  takeLaunchParam,
  urlStartParam,
} from './startParam';

describe('parseStartParam', () => {
  it('pair_/therapy_ дают присоединение с кодом', () => {
    expect(parseStartParam('pair_AB12')).toEqual({
      kind: 'join',
      joinKind: 'pair',
      code: 'AB12',
    });
    expect(parseStartParam('therapy_XY')).toEqual({
      kind: 'join',
      joinKind: 'therapy',
      code: 'XY',
    });
  });
  it('префикс без кода игнорируется', () => {
    expect(parseStartParam('pair_')).toBeNull();
    expect(parseStartParam('therapy_')).toBeNull();
  });
  it('diaries и tracker', () => {
    expect(parseStartParam('diaries')).toEqual({ kind: 'diaries' });
    expect(parseStartParam('tracker')).toEqual({ kind: 'tracker' });
  });
  // Аудит 2026-11, U2: уведомления о задании и тесте открывали «Сегодня».
  it('tasks — «Задания», tasks_<id> — задание по id, ysq — тест на схемы', () => {
    expect(parseStartParam('tasks')).toEqual({ kind: 'tasks' });
    expect(parseStartParam('tasks_42')).toEqual({ kind: 'tasks', taskId: 42 });
    expect(parseStartParam('ysq')).toEqual({ kind: 'ysq' });
  });
  it('id задания — только целое положительное число', () => {
    for (const bad of [
      'tasks_',
      'tasks_0',
      'tasks_-1',
      'tasks_1e3',
      'tasks_abc',
      'tasks_1.5',
      'tasks_12345678901',
    ]) {
      expect(parseStartParam(bad), bad).toBeNull();
    }
    expect(parseStartParam('ysqX')).toBeNull();
  });
  it('неизвестное, пустое и null игнорируются', () => {
    expect(parseStartParam('settings')).toBeNull();
    expect(parseStartParam('diariesX')).toBeNull();
    expect(parseStartParam('')).toBeNull();
    expect(parseStartParam(null)).toBeNull();
    expect(parseStartParam(undefined)).toBeNull();
  });
});

describe('urlStartParam', () => {
  it('startapp, затем start_param; без них — null', () => {
    expect(urlStartParam('?startapp=tasks_7&x=1')).toBe('tasks_7');
    expect(urlStartParam('?start_param=ysq')).toBe('ysq');
    expect(urlStartParam('?x=1')).toBeNull();
    expect(urlStartParam('')).toBeNull();
  });
});

// Аудит 2026-11, U3: ссылка-приглашение на сайт открывается без входа, а
// /login теряет адрес. Параметр ждёт входа в localStorage.
describe('отложенный до входа параметр запуска', () => {
  beforeEach(() => localStorage.clear());

  it('сохранил до входа → забрал после входа, ровно один раз', () => {
    rememberLaunchParam('?startapp=therapy_ABC', 1000);
    expect(takeLaunchParam(2000)).toBe('therapy_ABC');
    expect(takeLaunchParam(2000)).toBeNull();
    expect(localStorage.getItem(PENDING_LAUNCH_KEY)).toBeNull();
  });

  it('старше часа — брошенная ссылка: не срабатывает и стирается', () => {
    rememberLaunchParam('?startapp=tasks', 0);
    expect(takeLaunchParam(3_600_001)).toBeNull();
    expect(localStorage.getItem(PENDING_LAUNCH_KEY)).toBeNull();
  });

  it('адрес без параметра или с неизвестным не трогает отложенное', () => {
    rememberLaunchParam('?startapp=ysq', 0);
    rememberLaunchParam('?x=1', 0);
    rememberLaunchParam('?startapp=evil', 0);
    expect(takeLaunchParam(1)).toBe('ysq');
  });

  it('битая запись — null, не исключение', () => {
    localStorage.setItem(PENDING_LAUNCH_KEY, '{oops');
    expect(takeLaunchParam()).toBeNull();
    localStorage.setItem(
      PENDING_LAUNCH_KEY,
      JSON.stringify({ raw: 1, at: 'x' }),
    );
    expect(takeLaunchParam()).toBeNull();
  });
});
