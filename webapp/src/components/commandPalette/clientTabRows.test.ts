// Вкладки карточки клиента в общем поиске: когда строки появляются и куда ведут.
import { describe, it, expect, vi } from 'vitest';
import type { TherapyClientSummary } from '../../api';
import { CLIENT_TABS_SHOWN, allClientTabRows, clientTabRows } from './clientTabRows';
import type { PaletteInput } from './paletteRows';

const client = (telegramId: number, name: string, urlCode?: string): TherapyClientSummary => ({
  telegramId, name, clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
  relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [], urlCode,
});
const CLIENTS = [client(1, 'Иван Петров', 'abcdefgh'), client(2, 'Мария'), client(3, 'Иван Сидоров')];
const path = vi.fn();
const input = (query: string, over: Partial<PaletteInput> = {}) =>
  ({ query, clients: CLIENTS, screenShare: false, run: { path }, ...over }) as unknown as PaletteInput;
const labels = (query: string, over?: Partial<PaletteInput>) => clientTabRows(input(query, over)).map((r) => r.row.label);

describe('clientTabRows', () => {
  it('имя и слово вкладки в любом порядке — вкладка этого клиента; действие ведёт на её адрес', () => {
    expect(labels('мария план')).toEqual(['Мария · План работы']);
    expect(labels('записи мария')).toEqual(['Мария · Записи клиента']);
    const [hit] = clientTabRows(input('петров задания'));
    expect(hit.row).toMatchObject({ key: 'client-tab:1:tasks', kind: 'client_tab', label: 'Иван Петров · Задания' });
    hit.row.action();
    expect(path).toHaveBeenCalledWith('/cabinet/abcdefgh/tasks');
  });

  it('имя подходит двум клиентам — вкладка у каждого', () => {
    expect(labels('иван сессии')).toEqual(['Иван Петров · Сессии', 'Иван Сидоров · Сессии']);
  });

  it('слово вкладки без имени — пусто', () => {
    expect(labels('план')).toEqual([]);
    expect(labels('задания')).toEqual([]);
  });

  it('по имени найден один клиент — все его вкладки, кроме «Обзора», с весом строки клиента', () => {
    const hits = clientTabRows(input('мария'));
    expect(hits).toHaveLength(CLIENT_TABS_SHOWN);
    expect(hits.map((h) => h.row.label)).not.toContain('Мария · Обзор');
    expect(new Set(hits.map((h) => h.score)).size).toBe(1);
  });

  it('по имени найдены двое — вкладок нет', () => {
    expect(labels('иван')).toEqual([]);
  });

  it('«Показ экрана» — ни по запросу, ни для «Недавнего»', () => {
    expect(labels('мария', { screenShare: true })).toEqual([]);
    expect(allClientTabRows(input('', { screenShare: true }))).toEqual([]);
    expect(allClientTabRows(input(''))).toHaveLength(CLIENTS.length * CLIENT_TABS_SHOWN);
  });
});
