// @vitest-environment jsdom
// Тест хука useClientDetail (miniapp) — вторая часть (лимит ~300 строк/файл,
// см. useClientDetail.test.ts для загрузки данных/удаления/заметок). Здесь:
// концептуализация (patch/toggle/явное saveConcept — в отличие от webapp,
// здесь НЕТ debounce-автосейва), алиас, инфо о сессиях, YSQ, экспорт.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientDetail } from './useClientDetail';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(),
    getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(),
    getClientModeNotes: vi.fn(),
    removeClient: vi.fn(),
    createTherapistNote: vi.fn(),
    deleteTherapistNote: vi.fn(),
    saveConceptualization: vi.fn(),
    renameClient: vi.fn(),
    updateSessionInfo: vi.fn(),
    requestYsq: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeClient = (o: Partial<Record<string, unknown>> = {}) => ({
  telegramId: 1,
  name: 'Иван',
  clientAlias: null,
  streak: 0,
  lastActiveDate: null,
  todayIndex: null,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
  ...o,
});

function setup() {
  const setClients = vi.fn();
  const switchView = vi.fn();
  const { result } = renderHook(() =>
    useClientDetail({ switchView, setClients }),
  );
  return { result, setClients, switchView };
}

async function openedHook(
  clientOverrides: Partial<Record<string, unknown>> = {},
) {
  const ctx = setup();
  await act(async () => {
    await ctx.result.current.openClient(makeClient(clientOverrides));
  });
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue([]);
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Концептуализация: явное сохранение (без debounce, в отличие от webapp) ──
describe('patchConcept / toggleSchemaId / toggleModeId', () => {
  it('patchConcept мержит патч в localConcept и помечает conceptDirty', async () => {
    const { result } = await openedHook();
    expect(result.current.conceptDirty).toBe(false);
    act(() => {
      result.current.patchConcept({ earlyExperience: 'детство' });
    });
    expect(result.current.localConcept.earlyExperience).toBe('детство');
    expect(result.current.conceptDirty).toBe(true);
  });

  it('toggleSchemaId добавляет и убирает id из активных списков', async () => {
    mockApi.getConceptualization.mockResolvedValue({
      id: 1,
      schemaIds: ['abandonment'],
      modeIds: [],
    });
    const { result } = await openedHook();
    expect(result.current.activeSchemaIds).toEqual(['abandonment']);

    act(() => {
      result.current.toggleSchemaId('abandonment');
    });
    expect(result.current.activeSchemaIds).toEqual([]);
    act(() => {
      result.current.toggleSchemaId('mistrust');
    });
    expect(result.current.activeSchemaIds).toEqual(['mistrust']);
  });

  it('toggleModeId добавляет и убирает id из активных режимов', async () => {
    const { result } = await openedHook();
    act(() => {
      result.current.toggleModeId('vulnerable_child');
    });
    expect(result.current.activeModeIds).toEqual(['vulnerable_child']);
    act(() => {
      result.current.toggleModeId('vulnerable_child');
    });
    expect(result.current.activeModeIds).toEqual([]);
  });
});

describe('saveConcept', () => {
  it('ничего не делает без выбранного клиента', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();
  });

  it('ничего не делает, если нет несохранённых правок (conceptDirty=false)', async () => {
    const { result } = await openedHook();
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();
  });

  it('отправляет собранный payload со всеми полями (пустые строки по умолчанию)', async () => {
    mockApi.saveConceptualization.mockResolvedValue({
      id: 1,
      schemaIds: [],
      modeIds: [],
    });
    const { result } = await openedHook({ telegramId: 9 });
    act(() => {
      result.current.patchConcept({
        earlyExperience: 'детство',
        goals: 'цель',
      });
    });
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(mockApi.saveConceptualization).toHaveBeenCalledWith(9, {
      schemaIds: [],
      modeIds: [],
      earlyExperience: 'детство',
      unmetNeeds: '',
      triggers: '',
      copingStyles: '',
      goals: 'цель',
      currentProblems: '',
      modeTransitions: '',
    });
  });

  it('успех: обновляет concept/localConcept, сбрасывает conceptDirty и conceptSaving', async () => {
    const saved = { id: 1, schemaIds: ['abandonment'], modeIds: [] };
    mockApi.saveConceptualization.mockResolvedValue(saved);
    const { result } = await openedHook();
    act(() => {
      result.current.toggleSchemaId('abandonment');
    });
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(result.current.concept).toEqual(saved);
    expect(result.current.localConcept).toEqual(saved);
    expect(result.current.conceptDirty).toBe(false);
    expect(result.current.conceptSaving).toBe(false);
  });

  it('ошибка вида "API ..." подменяется дружелюбным сообщением', async () => {
    mockApi.saveConceptualization.mockRejectedValue(new Error('API 500'));
    const { result } = await openedHook();
    act(() => {
      result.current.toggleSchemaId('a');
    });
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(result.current.conceptError).toBe('Ошибка сервера. Попробуй позже.');
  });

  it('прочая ошибка Error показывается как есть', async () => {
    mockApi.saveConceptualization.mockRejectedValue(
      new Error('validation failed'),
    );
    const { result } = await openedHook();
    act(() => {
      result.current.toggleSchemaId('a');
    });
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(result.current.conceptError).toBe('validation failed');
  });

  it('ошибка без сообщения (не Error) — фолбэк "Ошибка сохранения"', async () => {
    mockApi.saveConceptualization.mockRejectedValue('boom');
    const { result } = await openedHook();
    act(() => {
      result.current.toggleSchemaId('a');
    });
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(result.current.conceptError).toBe('Ошибка сохранения');
  });
});

// ── Алиас ─────────────────────────────────────────────────────────────────────
describe('saveAlias', () => {
  it('сохраняет trim-алиас и обновляет selectedClient + список клиентов', async () => {
    mockApi.renameClient.mockResolvedValue(undefined);
    const { result, setClients } = await openedHook({ telegramId: 7 });
    act(() => {
      result.current.setAliasInput('  Новое имя  ');
    });
    await act(async () => {
      await result.current.saveAlias();
    });

    expect(mockApi.renameClient).toHaveBeenCalledWith(7, '  Новое имя  ');
    expect(result.current.selectedClient?.clientAlias).toBe('Новое имя');
    expect(result.current.renamingAlias).toBe(false);
    const updater = setClients.mock.calls.at(-1)![0];
    expect(updater([{ telegramId: 7, clientAlias: null }])).toEqual([
      result.current.selectedClient,
    ]);
  });

  it('пустой ввод после trim сохраняется как null', async () => {
    mockApi.renameClient.mockResolvedValue(undefined);
    const { result } = await openedHook();
    act(() => {
      result.current.setAliasInput('   ');
    });
    await act(async () => {
      await result.current.saveAlias();
    });
    expect(result.current.selectedClient?.clientAlias).toBeNull();
  });

  it('при ошибке api выставляет aliasError и не закрывает форму', async () => {
    mockApi.renameClient.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    act(() => {
      result.current.setRenamingAlias(true);
      result.current.setAliasInput('x');
    });
    await act(async () => {
      await result.current.saveAlias();
    });
    expect(result.current.aliasError).toBe('Не удалось сохранить имя');
    expect(result.current.renamingAlias).toBe(true);
  });
});

// ── Сессии ────────────────────────────────────────────────────────────────────
describe('saveSessionInfo', () => {
  it('отправляет patch и обновляет selectedClient + список', async () => {
    mockApi.updateSessionInfo.mockResolvedValue(undefined);
    const { result, setClients } = await openedHook({ telegramId: 3 });
    await act(async () => {
      await result.current.saveSessionInfo({ nextSession: '2026-08-01' });
    });

    expect(mockApi.updateSessionInfo).toHaveBeenCalledWith(3, {
      nextSession: '2026-08-01',
    });
    expect(result.current.selectedClient?.nextSession).toBe('2026-08-01');
    const updater = setClients.mock.calls.at(-1)![0];
    expect(updater([{ telegramId: 3, nextSession: null }])).toEqual([
      result.current.selectedClient,
    ]);
  });

  it('при ошибке api выставляет sessionInfoError и очищает его через 3с', async () => {
    vi.useFakeTimers();
    mockApi.updateSessionInfo.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    await act(async () => {
      await result.current.saveSessionInfo({ nextSession: '2026-08-01' });
    });
    expect(result.current.sessionInfoError).toBe('Не удалось сохранить');
    expect(result.current.sessionInfoSaving).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.sessionInfoError).toBe('');
  });
});

// ── YSQ ───────────────────────────────────────────────────────────────────────
describe('handleRequestYsq', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('выставляет ysqRequested и сбрасывает его через 3с', async () => {
    mockApi.requestYsq.mockResolvedValue(undefined);
    const { result } = await openedHook({ telegramId: 4 });
    await act(async () => {
      await result.current.handleRequestYsq();
    });
    expect(mockApi.requestYsq).toHaveBeenCalledWith(4);
    expect(result.current.ysqRequested).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.ysqRequested).toBe(false);
  });

  it('при ошибке выставляет ysqError, не трогая ysqRequested', async () => {
    mockApi.requestYsq.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    await act(async () => {
      await result.current.handleRequestYsq();
    });
    expect(result.current.ysqError).toBe('Не удалось отправить запрос');
    expect(result.current.ysqRequested).toBe(false);
  });
});

// ── Экспорт ───────────────────────────────────────────────────────────────────
describe('handleExport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  it('без концептуализации ничего не делает (пустой текст)', async () => {
    const { result } = await openedHook();
    await act(async () => {
      await result.current.handleExport();
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('копирует читаемый текст с названиями схем/режимов, сбрасывает exportCopied через 2.5с', async () => {
    mockApi.getConceptualization.mockResolvedValue({
      id: 1,
      schemaIds: ['abandonment'],
      modeIds: ['vulnerable_child'],
      earlyExperience: 'опыт',
      updatedAt: '2026-01-05T00:00:00.000Z',
    });
    const { result } = await openedHook();
    await act(async () => {
      await result.current.handleExport();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(text).toContain('опыт');
    expect(text).toContain('Покинутость / Нестабильность');
    expect(text).toContain('Уязвимый Ребёнок');
    expect(result.current.exportCopied).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(result.current.exportCopied).toBe(false);
  });

  it('использует navigator.share вместо буфера обмена, если он доступен', async () => {
    mockApi.getConceptualization.mockResolvedValue({
      id: 1,
      schemaIds: [],
      modeIds: [],
      earlyExperience: 'x',
      updatedAt: '2026-01-05T00:00:00.000Z',
    });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
      writable: true,
    });
    const { result } = await openedHook();
    await act(async () => {
      await result.current.handleExport();
    });
    expect(share).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
