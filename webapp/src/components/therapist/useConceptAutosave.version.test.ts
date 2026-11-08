// @vitest-environment jsdom
// Частичное сохранение концептуализации с версией строки (docs/open/therapy.md,
// «"Графические карты" (#963): запись холста в поля не упорядочена с полным
// сохранением»): вкладка «Концептуализация» в одном окне, холст в другом.
// Поверх НАСТОЯЩЕГО useClientDetail; сеть — сервер-фейк, который хранит строку,
// применяет патч и отвечает 409 на устаревшую версию (conceptServer). Проверка —
// «сохранил → нашёл»: что лежит на сервере и что видно во вкладке.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientDetail } from './useClientDetail';
import { conceptServer } from './conceptServer.test-helpers';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(), getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(), getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(), getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(), getClientDiary: vi.fn(),
    saveConceptualization: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const link = (modeId: string, origin = '') => ({
  modeId, alias: '', schemaIds: [], needIds: [], origin, manifest: '', strategy: '',
});
const INITIAL = {
  id: 1, schemaIds: [], modeIds: ['vulnerable_child'], goals: 'опора', triggers: null,
  modeLinks: [link('vulnerable_child', 'мама уходила')], schemaLinks: [],
  updatedAt: '2026-11-08T10:00:00.000Z',
};

let srv = conceptServer(INITIAL);
async function opened() {
  const ctx = renderHook(() => useClientDetail({ onOpenClient: vi.fn(), switchView: vi.fn(), setClients: vi.fn() }));
  await act(async () => { await ctx.result.current.openClient(CLIENT as never); });
  return ctx.result;
}
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(700); });

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ['getTherapyTasksForClient', 'getClientSchemaNotes', 'getClientModeNotes', 'getTherapyClientHistory', 'getClientDiary']) {
    mockApi[k].mockResolvedValue([]);
  }
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  srv = conceptServer(INITIAL);
  mockApi.getConceptualization.mockImplementation(srv.get);
  mockApi.saveConceptualization.mockImplementation(srv.save);
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('автосохранение концептуализации: патч и версия строки', () => {
  it('сохранил → нашёл: правка связи уходит одной связью, на сервере остальное цело', async () => {
    const result = await opened();
    act(() => { result.current.patchConcept({ modeLinks: [link('vulnerable_child', 'мама уходила, папа молчал')] }); });
    await settle();
    expect(mockApi.saveConceptualization.mock.calls[0][1]).toEqual({
      modeLinksPatch: { upsert: [link('vulnerable_child', 'мама уходила, папа молчал')], remove: [] },
      baseVersion: INITIAL.updatedAt,
    });
    expect(srv.state.goals).toBe('опора');
    expect(srv.state.modeLinks).toEqual([link('vulnerable_child', 'мама уходила, папа молчал')]);
    expect(result.current.saveStatus).toBe('saved');
    // Следующая правка — от версии ответа, а не от исходной: без 409.
    act(() => { result.current.patchConcept({ goals: 'опора и границы' }); });
    await settle();
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(2);
    const first = await mockApi.saveConceptualization.mock.results[0].value;
    expect(mockApi.saveConceptualization.mock.calls[1][1]).toEqual({ goals: 'опора и границы', baseVersion: first.updatedAt });
    expect(srv.state.goals).toBe('опора и границы');
  });

  it('холст в другом окне дописал режим → 409 → перечитал, наложил правку, повторил: на сервере и во вкладке оба', async () => {
    const result = await opened();
    srv.writeElsewhere({
      modeIds: ['vulnerable_child', 'angry_child'],
      modeLinks: [link('vulnerable_child', 'мама уходила'), link('angry_child')],
    });
    act(() => { result.current.patchConcept({ goals: 'правка вкладки' }); });
    await settle();
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(2); // 409 и повтор от свежей версии
    expect(mockApi.getConceptualization).toHaveBeenCalledTimes(2); // открытие и перечитывание
    expect(srv.state.goals).toBe('правка вкладки');
    expect(srv.state.modeIds).toEqual(['vulnerable_child', 'angry_child']);
    expect(srv.state.modeLinks).toEqual([link('vulnerable_child', 'мама уходила'), link('angry_child')]);
    expect(result.current.activeModeIds).toEqual(['vulnerable_child', 'angry_child']);
    expect(result.current.localConcept.goals).toBe('правка вкладки');
    expect(result.current.saveStatus).toBe('saved');
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('409 не проходит и после повторов — «Не сохранилось», правка остаётся во вкладке', async () => {
    const result = await opened();
    mockApi.saveConceptualization.mockRejectedValue(Object.assign(new Error('изменили в другом окне'), { status: 409 }));
    act(() => { result.current.patchConcept({ goals: 'правка вкладки' }); });
    await settle();
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(3);
    expect(result.current.saveStatus).toBe('error');
    expect(result.current.localConcept.goals).toBe('правка вкладки');
  });
});
