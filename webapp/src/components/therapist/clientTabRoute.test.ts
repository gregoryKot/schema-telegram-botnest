// Вкладки кабинета в адресе (clientTabRoute.ts): слаги карточки и список клиентов.
import { describe, it, expect } from 'vitest';
import {
  slugOfTab, tabFromSlug, clientCardPath, clientTabFromPath,
  isClientListPath, LEGACY_TASKS_PATH,
} from './clientTabRoute';
import type { ClientTab } from './clientSheetTypes';
import { parseClientRef } from '../../../../shared/src/utils/clientRef';

const ALL: ClientTab[] = ['overview', 'concept', 'plan', 'mode_map', 'sessions', 'tasks', 'ysq', 'client_notes'];

describe('слаги вкладок карточки', () => {
  it('слаги — как договорено; «Обзор» без слага', () => {
    expect(ALL.map(slugOfTab)).toEqual(['', 'concept', 'plan', 'maps', 'sessions', 'tasks', 'schemas', 'notes']);
  });
  it('слаг → вкладка → слаг сходится для каждой вкладки, кроме «Обзора»', () => {
    for (const t of ALL.filter((x) => x !== 'overview')) expect(tabFromSlug(slugOfTab(t))).toBe(t);
  });
  it('пустой и неизвестный слаг — null (откроется «Обзор»)', () => {
    for (const s of ['', undefined, null, 'nope', 'mode_map', 'ysq', 'overview']) expect(tabFromSlug(s)).toBeNull();
  });
});

describe('clientCardPath', () => {
  it('«Обзор» — без суффикса, остальные — с ним', () => {
    expect(clientCardPath('abcdefgh', 'overview')).toBe('/cabinet/abcdefgh');
    expect(clientCardPath('abcdefgh', 'ysq')).toBe('/cabinet/abcdefgh/schemas');
    expect(clientCardPath('-16', 'mode_map')).toBe('/cabinet/-16/maps');
  });
});

describe('clientTabFromPath', () => {
  it('вкладка из адреса карточки — по коду и по старому id', () => {
    expect(clientTabFromPath('/cabinet/abcdefgh/tasks')).toBe('tasks');
    expect(clientTabFromPath('/cabinet/-16/notes')).toBe('client_notes');
  });
  it('без вкладки, неизвестная вкладка, не карточка — null', () => {
    for (const p of ['/cabinet/abcdefgh', '/cabinet/abcdefgh/nope', '/cabinet/tasks', '/cabinet/today/tasks',
      '/cabinet', '/cabinet/abcdefgh/tasks/x', '/today']) {
      expect(clientTabFromPath(p)).toBeNull();
    }
  });
});

describe('список клиентов', () => {
  it('список — только /cabinet; старый /cabinet/tasks, карточка и «Сегодня» — нет', () => {
    expect(isClientListPath('/cabinet')).toBe(true);
    expect(LEGACY_TASKS_PATH).toBe('/cabinet/tasks');
    expect(isClientListPath(LEGACY_TASKS_PATH)).toBe(false);
    expect(isClientListPath('/cabinet/today')).toBe(false);
    expect(isClientListPath('/cabinet/abcdefgh')).toBe(false);
  });
  it('/cabinet/tasks и /cabinet/today не принимаются за клиента', () => {
    expect(parseClientRef('tasks')).toBeNull();
    expect(parseClientRef('today')).toBeNull();
  });
});
