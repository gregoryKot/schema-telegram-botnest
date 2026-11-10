// @vitest-environment jsdom
// Отказ записи «моих схем/режимов» с 409 unreadable_data: прежний список на
// сервере не читается, и сервер не дал его стереть. Экран отличает этот отказ
// от обрыва связи (saveBlocked), а выбор человека остаётся на устройстве.
// Второй блок — прогресс теста YSQ живой (QA 2026-10-26).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSchemasData } from './useSchemasData';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';
import { clearYsqProgress, notifyYsqResultChanged, writeYsqProgress } from '../../../../shared/src/hooks/ysqProgressStore';
import { cachedGet, clearApiCache } from '../../../../shared/src/api/apiCache';
import { applyMutationInvalidation } from '../../../../shared/src/api/apiCacheRules';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn(),
    getYsqHistory: vi.fn(),
    getYsqProgress: vi.fn(),
    listMyModeMaps: vi.fn(),
    updateSettings: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const unwritable = Object.assign(new Error('Правка не сохранена'), { status: 409, reason: 'unreadable_data' });

async function mounted() {
  const hook = renderHook(() => useSchemasData());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useSchemasData — отказ записи поверх нечитаемого списка', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockApi.getProfile.mockResolvedValue({ mySchemaIds: [], myModeIds: [], ysq: { activeSchemaIds: [], completedAt: null } });
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getYsqProgress.mockResolvedValue(null);
    mockApi.listMyModeMaps.mockResolvedValue([]);
  });

  it('409 unreadable_data на схемах → saveBlocked, выбор остался в state и localStorage', async () => {
    mockApi.updateSettings.mockRejectedValue(unwritable);
    const { result } = await mounted();
    await act(async () => { result.current.saveSchemas(['abandonment']); });

    await waitFor(() => expect(result.current.saveBlocked).toBe(true));
    expect(result.current.saveFailed).toBe(true);
    expect(result.current.manualSchemaIds).toEqual(['abandonment']);
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY)!)).toEqual(['abandonment']);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('mySchemaIds') }));
  });

  it('409 unreadable_data на режимах → saveBlocked, выбор режимов сохранён локально', async () => {
    mockApi.updateSettings.mockRejectedValue(unwritable);
    const { result } = await mounted();
    await act(async () => { result.current.saveModes(['vulnerable_child']); });

    await waitFor(() => expect(result.current.saveBlocked).toBe(true));
    expect(result.current.myModeIds).toEqual(['vulnerable_child']);
    expect(JSON.parse(localStorage.getItem(MY_MODE_IDS_KEY)!)).toEqual(['vulnerable_child']);
  });

  it('контроль: обрыв сети — saveFailed без saveBlocked', async () => {
    mockApi.updateSettings.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = await mounted();
    await act(async () => { result.current.saveSchemas(['abandonment']); });

    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(result.current.saveBlocked).toBe(false);
  });

  it('контроль: удачная запись после отказа снимает оба флага', async () => {
    mockApi.updateSettings.mockRejectedValueOnce(unwritable).mockResolvedValue(undefined);
    const { result } = await mounted();
    await act(async () => { result.current.saveSchemas(['abandonment']); });
    await waitFor(() => expect(result.current.saveBlocked).toBe(true));
    await act(async () => { result.current.saveSchemas(['mistrust']); });

    await waitFor(() => expect(result.current.saveFailed).toBe(false));
    expect(result.current.saveBlocked).toBe(false);
  });

  // b15: сбой показывается у блока, где сделан выбор (saveKind), и «Повторить» шлёт тот же список.
  it('обрыв → «Повторить» шлёт тот же список режимов; удача снимает сбой; блок — режимы', async () => {
    mockApi.updateSettings.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined);
    const { result } = await mounted();
    await act(async () => { result.current.saveModes(['vulnerable_child']); });
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(result.current.saveKind).toBe('modes');

    await act(async () => { result.current.retrySave(); });
    await waitFor(() => expect(result.current.saveFailed).toBe(false));
    expect(mockApi.updateSettings).toHaveBeenCalledTimes(2);
    expect(mockApi.updateSettings).toHaveBeenLastCalledWith({ myModeIds: ['vulnerable_child'] });
  });

  it('контроль: последним сохранялись схемы — блок схем, повтор шлёт схемы', async () => {
    mockApi.updateSettings.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = await mounted();
    await act(async () => { result.current.saveModes(['vulnerable_child']); });
    await act(async () => { result.current.saveSchemas(['abandonment']); });
    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(result.current.saveKind).toBe('schemas');
    await act(async () => { result.current.retrySave(); });
    expect(mockApi.updateSettings).toHaveBeenLastCalledWith({ mySchemaIds: ['abandonment'] });
  });
});

// «Мои паттерны» под открытым тестом YSQ (QA 2026-10-26): после «✕» карточка
// звала «Начать тест», а «Продолжить (N из 116)» появлялось только после
// перезагрузки — прогресс грузился один раз при открытии экрана.
describe('useSchemasData — прогресс теста YSQ живой', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockApi.getProfile.mockResolvedValue({ mySchemaIds: [], myModeIds: [], ysq: null });
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getYsqProgress.mockResolvedValue(null);
    mockApi.listMyModeMaps.mockResolvedValue([]);
    mockApi.updateSettings.mockResolvedValue({});
  });

  it('ответы в тесте поверх экрана — «продолжить (5 из 116)» без перезагрузки; сдал — снова «начать»', async () => {
    const { result } = await mounted();
    expect(result.current.ysqProgressAnswered).toBeNull();

    act(() => writeYsqProgress([4, 4, 4, 4, 4, ...Array(111).fill(0)], 5));
    expect(result.current.ysqProgressAnswered).toBe(5);

    act(() => clearYsqProgress());
    expect(result.current.ysqProgressAnswered).toBeNull();
  });
});

// QA 2026-11 (B-З5): после «Сохранить и закрыть» в тесте экран «Мои паттерны»
// до F5 звал «Начать тест» и показывал пустые выраженные схемы. Связка
// целиком, через настоящий кеш GET: сервер сохранил итог → мутация сбросила
// кеш профиля → тест сообщил экрану → экран перечитал профиль и увидел схемы.
describe('useSchemasData — прошёл тест → паттерны видны без перезагрузки', () => {
  const server = { ysq: { activeSchemaIds: [] as string[], completedAt: null as string | null } };
  const fetchProfile = vi.fn(async () => ({ mySchemaIds: [], myModeIds: [], ysq: { ...server.ysq } }));

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    clearApiCache();
    server.ysq = { activeSchemaIds: [], completedAt: null };
    mockApi.getProfile.mockImplementation(() => cachedGet('/api/profile', fetchProfile));
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getYsqProgress.mockResolvedValue(null);
    mockApi.listMyModeMaps.mockResolvedValue([]);
  });

  it('итог сохранён на сервере — выраженные схемы и дата прохождения появляются сразу', async () => {
    const { result } = await mounted();
    expect(result.current.ysqSchemaIds).toEqual([]);
    expect(result.current.ysqCompletedAt).toBeNull();

    // POST /api/ysq-result прошёл: сервер пишет итог, apiClient сбрасывает кеш.
    server.ysq = { activeSchemaIds: ['abandonment'], completedAt: '2026-11-03T10:00:00.000Z' };
    applyMutationInvalidation('POST', '/api/ysq-result', '{}');
    act(() => notifyYsqResultChanged());

    await waitFor(() => expect(result.current.ysqSchemaIds).toEqual(['abandonment']));
    expect(result.current.ysqCompletedAt).toBe('2026-11-03T10:00:00.000Z');
  });

  it('контроль: без события экран профиль не перечитывает (событие — и есть механизм)', async () => {
    const { result } = await mounted();
    server.ysq = { activeSchemaIds: ['abandonment'], completedAt: '2026-11-03T10:00:00.000Z' };
    applyMutationInvalidation('POST', '/api/ysq-result', '{}');
    await act(async () => {});
    expect(result.current.ysqSchemaIds).toEqual([]);
  });
});

// Класс «кэш пережил источник правды» (#939): до этого кэш писался только при
// непустом списке, и всё, что убрали на другом устройстве, здесь воскресало.
describe('useSchemasData — пустой список с сервера стирает локальную копию', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getYsqProgress.mockResolvedValue(null);
    mockApi.listMyModeMaps.mockResolvedValue([]);
  });

  it('сервер отдал [] — кэш схем и режимов становится [] и state пуст', async () => {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(['abandonment']));
    localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(['vulnerable_child']));
    mockApi.getProfile.mockResolvedValue({ mySchemaIds: [], myModeIds: [], ysq: { activeSchemaIds: [], completedAt: null } });
    const { result } = await mounted();
    expect(result.current.manualSchemaIds).toEqual([]);
    expect(result.current.myModeIds).toEqual([]);
    expect(localStorage.getItem(MY_SCHEMA_IDS_KEY)).toBe('[]');
    expect(localStorage.getItem(MY_MODE_IDS_KEY)).toBe('[]');
  });

  // Контрольный образец: ответ без полей (не той формы) кэш не трогает —
  // стирать по отсутствию данных нельзя, только по явному пустому списку.
  it('в ответе нет полей — локальная копия остаётся', async () => {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(['abandonment']));
    mockApi.getProfile.mockResolvedValue({ ysq: { activeSchemaIds: [], completedAt: null } });
    await mounted();
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY)!)).toEqual(['abandonment']);
  });
});

// docs/open/frontend-ux.md: после 409 на «моих схемах» перезагрузка показывала
// пустой список — сервер отдавал нечитаемый список `[]`, экран и кэш верили
// ему. Теперь сервер называет такой список в unreadableLists.
describe('useSchemasData — нечитаемый список на сервере не затирает локальный выбор', () => {
  const unreadableProfile = {
    mySchemaIds: [], myModeIds: [], unreadableLists: ['mySchemaIds'],
    ysq: { activeSchemaIds: [], completedAt: null },
  };
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getYsqProgress.mockResolvedValue(null);
    mockApi.listMyModeMaps.mockResolvedValue([]);
  });

  it('выбрал → 409 → перезагрузка: выбор на экране и в кэше', async () => {
    mockApi.getProfile.mockResolvedValue(unreadableProfile);
    mockApi.updateSettings.mockRejectedValue(unwritable);
    const first = await mounted();
    await act(async () => { first.result.current.saveSchemas(['abandonment']); });
    await waitFor(() => expect(first.result.current.saveBlocked).toBe(true));
    first.unmount();

    const { result } = await mounted();
    expect(result.current.manualSchemaIds).toEqual(['abandonment']);
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY)!)).toEqual(['abandonment']);
  });

  it('контроль: читаемый соседний список с сервера по-прежнему источник правды', async () => {
    localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(['vulnerable_child']));
    mockApi.getProfile.mockResolvedValue(unreadableProfile);
    const { result } = await mounted();
    expect(result.current.myModeIds).toEqual([]);
    expect(localStorage.getItem(MY_MODE_IDS_KEY)).toBe('[]');
  });
});
