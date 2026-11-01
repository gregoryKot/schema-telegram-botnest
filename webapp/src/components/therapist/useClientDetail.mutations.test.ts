// @vitest-environment jsdom
// Тест хука useClientDetail — вторая часть (лимит ~300 строк/файл, см.
// useClientDetail.test.ts для загрузки данных/удаления/заметок). Здесь:
// автосохранение концептуализации (debounce), алиас, инфо о сессиях, YSQ, экспорт.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientDetail } from './useClientDetail';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(), getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(), getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(), getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(), getClientDiary: vi.fn(),
    removeClient: vi.fn(), createTherapistNote: vi.fn(), deleteTherapistNote: vi.fn(),
    saveConceptualization: vi.fn(), renameClient: vi.fn(),
    updateSessionInfo: vi.fn(), requestYsq: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockReport = reportClientError as unknown as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeClient = (o: Partial<Record<string, unknown>> = {}) => ({
  telegramId: 1, name: 'Иван', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [], ...o,
});

function setup() {
  const setClients = vi.fn();
  const switchView = vi.fn();
  const onOpenClient = vi.fn();
  const { result } = renderHook(() => useClientDetail({ onOpenClient, switchView, setClients }));
  return { result, setClients, switchView, onOpenClient };
}

async function openedHook(clientOverrides: Partial<Record<string, unknown>> = {}) {
  const ctx = setup();
  await act(async () => { await ctx.result.current.openClient(makeClient(clientOverrides)); });
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Концептуализация: автосохранение с debounce ─────────────────────────────
describe('patchConcept / autoSave', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  // Issue #879: «✓ Сохранено» раньше гасло через 2 с — терапевт не знал, сохранилось
  // ли. Теперь статус 'saved' держится до следующей правки, а savedAt — момент из ответа.
  it('patchConcept: pending → api вызывается через 700мс → saved и НЕ гаснет, savedAt из ответа', async () => {
    mockApi.saveConceptualization.mockResolvedValue({ id: 1, schemaIds: ['x'], updatedAt: '2026-10-28T11:07:00.000Z' });
    const { result } = await openedHook();
    expect(result.current.savedAt).toBeNull();

    act(() => { result.current.toggleSchemaId('abandonment'); });
    expect(result.current.saveStatus).toBe('pending');
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.savedAt?.toISOString()).toBe('2026-10-28T11:07:00.000Z');

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.saveStatus).toBe('saved');
  });
  it('ответ без updatedAt — savedAt = момент сохранения', async () => {
    vi.setSystemTime(new Date('2026-10-28T09:00:00.000Z'));
    mockApi.saveConceptualization.mockResolvedValue({ id: 1 });
    const { result } = await openedHook();
    act(() => { result.current.toggleSchemaId('a'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); }); // debounce 700мс → 09:00:00.700
    expect(result.current.savedAt?.toISOString()).toBe('2026-10-28T09:00:00.700Z');
  });
  it('повторный patchConcept до истечения таймера сбрасывает debounce (ровно один вызов api)', async () => {
    mockApi.saveConceptualization.mockResolvedValue({ id: 1, schemaIds: [] });
    const { result } = await openedHook();

    act(() => { result.current.toggleSchemaId('a'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    act(() => { result.current.toggleSchemaId('b'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
  });
  it('toggleSchemaId/toggleModeId добавляют и убирают id из активных списков', async () => {
    mockApi.getConceptualization.mockResolvedValue({ id: 1, schemaIds: ['abandonment'], modeIds: [] });
    mockApi.saveConceptualization.mockResolvedValue({ id: 1 });
    const { result } = await openedHook();
    expect(result.current.activeSchemaIds).toEqual(['abandonment']);

    act(() => { result.current.toggleSchemaId('abandonment'); });
    expect(result.current.activeSchemaIds).toEqual([]);
    act(() => { result.current.toggleModeId('vulnerable_child'); });
    expect(result.current.activeModeIds).toEqual(['vulnerable_child']);
    act(() => { result.current.toggleModeId('vulnerable_child'); });
    expect(result.current.activeModeIds).toEqual([]);
  });
  // РЕГРЕССИЯ (был БАГ, найден при написании компонентных тестов
  // ClientConceptTab/TherapistClientSheet): catch у autoSave откатывал
  // saveStatus в 'idle' и БОЛЬШЕ НИЧЕГО не делал. Терапевт видел, что индикатор
  // автосохранения погас, и решал, что правка сохранилась, хотя
  // api.saveConceptualization упал и правка тихо потерялась. Теперь catch
  // ставит saveStatus = 'error' (строку «Не сохранилось» + «Повторить» рисует
  // SaveStatusLine, issue #879), а retrySave повторяет отправку и шлёт событие.
  it('autoSave при ошибке api ставит saveStatus = error (не тишина и не idle)', async () => {
    mockApi.saveConceptualization.mockRejectedValue(new Error('network'));
    const { result } = await openedHook();
    act(() => { result.current.toggleSchemaId('a'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(result.current.saveStatus).toBe('error');
    expect(result.current.savedAt).toBeNull();
  });

  it('retrySave после ошибки: второй вызов api, событие concept_save_retry, затем saved', async () => {
    mockApi.saveConceptualization.mockRejectedValueOnce(new Error('network'));
    const { result } = await openedHook();
    act(() => { result.current.toggleSchemaId('a'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(result.current.saveStatus).toBe('error');

    mockApi.saveConceptualization.mockResolvedValue({ id: 1 });
    await act(async () => { result.current.retrySave(); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(2);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('concept_save_retry');
    expect(result.current.saveStatus).toBe('saved');
  });
  // #879: статус сохранения — состояние клиента, а не вкладки: при смене клиента
  // «Не сохранилось» гаснет. Взведённая правка прежнего клиента не теряется и не
  // переезжает к новому: она сразу уходит ПРЕЖНЕМУ, с его данными (usePendingSave,
  // инцидент 2026-10-26; весь класс — useClientDetail.switch.test.ts).
  it('открытие другого клиента после ошибки: статус idle, savedAt null, отложенная правка уходит прежнему клиенту', async () => {
    mockApi.saveConceptualization.mockRejectedValueOnce(new Error('network'));
    const { result } = await openedHook();
    act(() => { result.current.toggleSchemaId('a'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(result.current.saveStatus).toBe('error');

    mockApi.saveConceptualization.mockResolvedValue({ id: 1 });
    act(() => { result.current.toggleSchemaId('b'); }); // таймер взведён, до срабатывания — смена клиента
    expect(result.current.saveStatus).toBe('pending');
    await act(async () => { await result.current.openClient(makeClient({ telegramId: 2 })); });
    expect(result.current.saveStatus).toBe('idle');
    expect(result.current.savedAt).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(2); // упавший и досылка прежнему, новому — ничего
    expect(mockApi.saveConceptualization.mock.calls[1][0]).toBe(1);
    expect(mockApi.saveConceptualization.mock.calls[1][1]).toMatchObject({ schemaIds: ['a', 'b'] });
    expect(result.current.saveStatus).toBe('idle'); // ответ прежнему клиенту карточку нового не трогает
  });

  it('autoSave отправляет собранный payload со всеми полями конкретуализации', async () => {
    mockApi.saveConceptualization.mockResolvedValue({ id: 1 });
    const { result } = await openedHook();
    act(() => { result.current.patchConcept({ earlyExperience: 'детство', goals: 'цель' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledWith(1, {
      schemaIds: [], modeIds: [], earlyExperience: 'детство', unmetNeeds: '',
      triggers: '', copingStyles: '', goals: 'цель', currentProblems: '', modeTransitions: '',
      modeLinks: [],
      schemaLinks: [],
    });
  });

  // ФИКС (был БАГ): setTimeout(autoSave, 700) внутри patchConcept раньше
  // захватывал `autoSave` из рендера ДО применения текущего patch (устаревшее
  // замыкание над state) — отправлялось значение localConcept КАК ОНО БЫЛО до
  // patchConcept, а не после. Итог: последняя правка терапевта перед паузой
  // 700мс+ систематически не долетала до сервера. Починено через
  // localConceptRef, обновляемый синхронно (см. useClientDetail.ts) — autoSave
  // теперь читает ref, а не устаревшее замыкание над state. Тест фиксирует
  // корректное поведение как регресс-гард.
  it('ФИКС (был БАГ): autoSave отправляет значение ПОСЛЕ текущего patch, а не до', async () => {
    mockApi.saveConceptualization.mockResolvedValue({ id: 1 });
    const { result } = await openedHook();

    // Единственная правка сразу после открытия карточки — должна долететь.
    act(() => { result.current.patchConcept({ earlyExperience: 'A' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization.mock.calls[0][1].earlyExperience).toBe('A');

    // Следующая правка тоже отправляет своё собственное (актуальное) значение.
    act(() => { result.current.patchConcept({ earlyExperience: 'B' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization.mock.calls[1][1].earlyExperience).toBe('B');
  });

  it('ФИКС: серия быстрых правок в одном debounce-окне — побеждает последнее значение, один вызов api', async () => {
    mockApi.saveConceptualization.mockResolvedValue({ id: 1 });
    const { result } = await openedHook();

    act(() => { result.current.patchConcept({ earlyExperience: 'C' }); });
    act(() => { result.current.patchConcept({ earlyExperience: 'D' }); });
    act(() => { result.current.patchConcept({ earlyExperience: 'E' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });

    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    expect(mockApi.saveConceptualization.mock.calls[0][1].earlyExperience).toBe('E');
  });
});

// ── Алиас ─────────────────────────────────────────────────────────────────────
describe('saveAlias', () => {
  it('сохраняет trim-алиас и обновляет selectedClient + список клиентов', async () => {
    mockApi.renameClient.mockResolvedValue(undefined);
    const { result, setClients } = await openedHook({ telegramId: 7 });
    act(() => { result.current.setAliasInput('  Новое имя  '); });
    await act(async () => { await result.current.saveAlias(); });

    expect(mockApi.renameClient).toHaveBeenCalledWith(7, '  Новое имя  ');
    expect(result.current.selectedClient?.clientAlias).toBe('Новое имя');
    expect(result.current.renamingAlias).toBe(false);
    // updater подменяет элемент списка с совпавшим telegramId на актуальный selectedClient целиком.
    const updater = setClients.mock.calls.at(-1)![0];
    expect(updater([{ telegramId: 7, clientAlias: null }])).toEqual([result.current.selectedClient]);
  });
  it('пустой ввод после trim сохраняется как null', async () => {
    mockApi.renameClient.mockResolvedValue(undefined);
    const { result } = await openedHook();
    act(() => { result.current.setAliasInput('   '); });
    await act(async () => { await result.current.saveAlias(); });
    expect(result.current.selectedClient?.clientAlias).toBeNull();
  });
  it('при ошибке api выставляет aliasError и не закрывает форму', async () => {
    mockApi.renameClient.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    act(() => { result.current.setRenamingAlias(true); result.current.setAliasInput('x'); });
    await act(async () => { await result.current.saveAlias(); });
    expect(result.current.aliasError).toBe('Не удалось сохранить имя');
    expect(result.current.renamingAlias).toBe(true);
  });
});

// ── Сессии ────────────────────────────────────────────────────────────────────
describe('saveSessionInfo', () => {
  it('отправляет patch и обновляет selectedClient + список', async () => {
    mockApi.updateSessionInfo.mockResolvedValue(undefined);
    const { result, setClients } = await openedHook({ telegramId: 3 });
    await act(async () => { await result.current.saveSessionInfo({ nextSession: '2026-08-01' }); });

    expect(mockApi.updateSessionInfo).toHaveBeenCalledWith(3, { nextSession: '2026-08-01' });
    expect(result.current.selectedClient?.nextSession).toBe('2026-08-01');
    const updater = setClients.mock.calls.at(-1)![0];
    expect(updater([{ telegramId: 3, nextSession: null }])).toEqual([result.current.selectedClient]);
  });
  // РЕГРЕССИЯ (check-silent-catch): catch раньше был `{ /* ignore */ }`, и
  // обе кнопки в ClientOverviewSidebar делали `await saveSessionInfo(...);
  // setEditingNextSession(false)` без проверки исхода — поле редактирования
  // закрывалось, будто дата сохранилась, хотя api упал и selectedClient не
  // обновился. Теперь функция возвращает false и заполняет sessionInfoError,
  // а закрывать поле обязан вызывающий — только при true.
  it('ошибка api: возвращает false, выставляет sessionInfoError, selectedClient не меняется', async () => {
    mockApi.updateSessionInfo.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook({ nextSession: null });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.saveSessionInfo({ nextSession: '2026-08-01' });
    });
    expect(ok).toBe(false);
    expect(result.current.sessionInfoError).not.toBe('');
    expect(result.current.selectedClient?.nextSession).toBeNull();
    expect(result.current.sessionInfoSaving).toBe(false);
  });

  it('успех возвращает true и сбрасывает предыдущую sessionInfoError', async () => {
    mockApi.updateSessionInfo.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined);
    const { result } = await openedHook();
    await act(async () => { await result.current.saveSessionInfo({ nextSession: '2026-08-01' }); });
    expect(result.current.sessionInfoError).not.toBe('');

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saveSessionInfo({ nextSession: '2026-08-02' }); });
    expect(ok).toBe(true);
    expect(result.current.sessionInfoError).toBe('');
  });
});

// ── YSQ ───────────────────────────────────────────────────────────────────────
describe('handleRequestYsq', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('выставляет ysqRequested и сбрасывает его через 3с', async () => {
    mockApi.requestYsq.mockResolvedValue(undefined);
    const { result } = await openedHook({ telegramId: 4 });
    await act(async () => { await result.current.handleRequestYsq(); });
    expect(mockApi.requestYsq).toHaveBeenCalledWith(4);
    expect(result.current.ysqRequested).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.ysqRequested).toBe(false);
  });
  it('второй тап, пока первый запрос в полёте → api.requestYsq вызван один раз', async () => {
    let resolve!: () => void;
    mockApi.requestYsq.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const { result } = await openedHook({ telegramId: 4 });
    let first!: Promise<void>;
    act(() => {
      first = result.current.handleRequestYsq();
      void result.current.handleRequestYsq();
    });
    expect(mockApi.requestYsq).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); await first; });
    expect(result.current.ysqRequested).toBe(true);
  });

  it('при ошибке выставляет ysqError, не трогая ysqRequested', async () => {
    mockApi.requestYsq.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    await act(async () => { await result.current.handleRequestYsq(); });
    expect(result.current.ysqError).toBe('Не удалось отправить запрос');
    expect(result.current.ysqRequested).toBe(false);
  });
});

// ── Экспорт ───────────────────────────────────────────────────────────────────
describe('handleExport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true, writable: true,
    });
  });
  it('без концептуализации ничего не делает (пустой текст)', async () => {
    const { result } = await openedHook();
    await act(async () => { await result.current.handleExport(); });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
  it('копирует текст в буфер и сбрасывает exportCopied через 2.5с, когда navigator.share недоступен', async () => {
    mockApi.getConceptualization.mockResolvedValue({
      id: 1, schemaIds: [], modeIds: [], earlyExperience: 'опыт', updatedAt: '2026-01-05T00:00:00.000Z',
    });
    const { result } = await openedHook();
    await act(async () => { await result.current.handleExport(); });

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(text).toContain('опыт');
    expect(result.current.exportCopied).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(result.current.exportCopied).toBe(false);
  });
  // РЕГРЕССИЯ (check-silent-catch): catch у записи в буфер раньше был
  // `/* ignore */` — при отказе clipboard.writeText (частая причина: страница
  // не в фокусе) кнопка «Экспорт» молча ничего не делала, exportCopied не
  // включался, и терапевт не получал вообще никакого сигнала. Теперь отказ
  // уходит в reportClientError; UI по-прежнему не показывает ошибку (нет
  // отдельного состояния под неё), но факт отказа больше не тонет бесследно.
  it('при отказе clipboard.writeText шлёт reportClientError и не выставляет exportCopied', async () => {
    mockApi.getConceptualization.mockResolvedValue({
      id: 1, schemaIds: [], modeIds: [], earlyExperience: 'опыт', updatedAt: '2026-01-05T00:00:00.000Z',
    });
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'));
    const { result } = await openedHook();
    await act(async () => { await result.current.handleExport(); });
    expect(result.current.exportCopied).toBe(false);
    expect(mockReport).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'therapist.clientDetail', message: expect.stringContaining('clipboard') }),
    );
  });
  it('использует navigator.share вместо буфера обмена, если он доступен', async () => {
    mockApi.getConceptualization.mockResolvedValue({
      id: 1, schemaIds: [], modeIds: [], earlyExperience: 'x', updatedAt: '2026-01-05T00:00:00.000Z',
    });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    const { result } = await openedHook();
    await act(async () => { await result.current.handleExport(); });
    expect(share).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
