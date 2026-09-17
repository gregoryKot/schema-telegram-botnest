// @vitest-environment jsdom
// useAboutMe — грузит 6 источников параллельно (профиль/тест-историю/дневник
// схем/дневник режимов + getModeNotes/getPhraseChecks для «Тёплых слов»),
// склеивает mySchemaIds (активные ⋃ ручные), считает недельную частоту
// (общий слой patternsSummary — не пересчитываем здесь) и собирает
// warmWordsItems. getModeNotes/getPhraseChecks добавлены сюда 2026-08-23:
// раньше WarmWordsCard грузил их САМ при своём монтировании, только после
// готовности этого хука — сеть уходила второй волной (замер 2026-08-22, 3G:
// +621мс). getModeDiary для тёплых слов переиспользуется, не дублируется.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAboutMe } from './useAboutMe';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn(),
    getYsqHistory: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getModeNotes: vi.fn(),
    getPhraseChecks: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(() => {
  vi.clearAllMocks();
});

const emptyProfile = {
  name: 'Аня',
  role: 'CLIENT',
  ysq: { completedAt: null, activeSchemaIds: [] as string[] },
  notifications: {
    enabled: false,
    reminderEnabled: false,
    timezone: 'UTC',
    localHour: 9,
  },
  streak: 0,
  lastActivity: {
    needsTracker: null,
    schemaDiary: null,
    modeDiary: null,
    gratitudeDiary: null,
  },
  mySchemaIds: [] as string[],
  myModeIds: [] as string[],
};

describe('useAboutMe — одна волна из шести запросов', () => {
  it('все шесть источников запрашиваются синхронно при монтировании', () => {
    mockApi.getProfile.mockReturnValue(new Promise(() => {}));
    mockApi.getYsqHistory.mockReturnValue(new Promise(() => {}));
    mockApi.getSchemaDiary.mockReturnValue(new Promise(() => {}));
    mockApi.getModeDiary.mockReturnValue(new Promise(() => {}));
    mockApi.getModeNotes.mockReturnValue(new Promise(() => {}));
    mockApi.getPhraseChecks.mockReturnValue(new Promise(() => {}));

    renderHook(() => useAboutMe());

    expect(mockApi.getProfile).toHaveBeenCalledTimes(1);
    expect(mockApi.getYsqHistory).toHaveBeenCalledTimes(1);
    expect(mockApi.getSchemaDiary).toHaveBeenCalledTimes(1);
    // Ровно один раз — не дублируем ради тёплых слов (переиспользуем).
    expect(mockApi.getModeDiary).toHaveBeenCalledTimes(1);
    expect(mockApi.getModeNotes).toHaveBeenCalledTimes(1);
    expect(mockApi.getPhraseChecks).toHaveBeenCalledTimes(1);
  });
});

describe('useAboutMe — happy path', () => {
  it('объединяет активные и ручные схемы без дублей, обе готовности true после загрузки', async () => {
    mockApi.getProfile.mockResolvedValue({
      ...emptyProfile,
      ysq: {
        completedAt: '2026-08-01T00:00:00.000Z',
        activeSchemaIds: ['abandonment', 'mistrust'],
      },
      mySchemaIds: ['mistrust', 'defectiveness'],
      myModeIds: ['vulnerable_child'],
    });
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getSchemaDiary.mockResolvedValue([
      { id: 1, createdAt: '2026-08-10', schemaIds: ['abandonment'] } as never,
    ]);
    mockApi.getModeDiary.mockResolvedValue([]);
    mockApi.getModeNotes.mockResolvedValue([]);
    mockApi.getPhraseChecks.mockResolvedValue([]);

    const { result } = renderHook(() => useAboutMe());
    await waitFor(() =>
      expect(
        result.current.portraitReady && result.current.warmWordsReady,
      ).toBe(true),
    );

    expect(new Set(result.current.mySchemaIds)).toEqual(
      new Set(['abandonment', 'mistrust', 'defectiveness']),
    );
    expect(result.current.myModeIds).toEqual(['vulnerable_child']);
    expect(result.current.ysqCompletedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(result.current.portrait.totalSchemas).toBe(3);
    expect(result.current.warmWordsItems).toEqual([]);
  });

  it('провал одного источника не роняет остальные (each .catch → null/[])', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('network'));
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getSchemaDiary.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([]);
    mockApi.getModeNotes.mockResolvedValue([]);
    mockApi.getPhraseChecks.mockResolvedValue([]);

    const { result } = renderHook(() => useAboutMe());
    await waitFor(() =>
      expect(
        result.current.portraitReady && result.current.warmWordsReady,
      ).toBe(true),
    );

    expect(result.current.mySchemaIds).toEqual([]);
    expect(result.current.portrait.totalSchemas).toBe(0);
    expect(result.current.warmWordsItems).toEqual([]);
  });

  it('провал остальных пяти источников (не только getProfile) тоже не роняет хук — готовности true с безопасными дефолтами', async () => {
    mockApi.getProfile.mockResolvedValue(emptyProfile);
    mockApi.getYsqHistory.mockRejectedValue(new Error('network'));
    mockApi.getSchemaDiary.mockRejectedValue(new Error('network'));
    mockApi.getModeDiary.mockRejectedValue(new Error('network'));
    mockApi.getModeNotes.mockRejectedValue(new Error('network'));
    mockApi.getPhraseChecks.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useAboutMe());
    await waitFor(() =>
      expect(
        result.current.portraitReady && result.current.warmWordsReady,
      ).toBe(true),
    );

    expect(result.current.schemaEntries).toEqual([]);
    expect(result.current.modeEntries).toEqual([]);
    expect(result.current.warmWordsItems).toEqual([]);
  });

  it('собирает warmWordsItems из карточек режимов, дневника режимов и разборов фраз', async () => {
    mockApi.getProfile.mockResolvedValue(emptyProfile);
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getSchemaDiary.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([
      {
        id: 1,
        modeId: 'vulnerable_child',
        healthyResponse: 'Свежее тёплое слово',
        createdAt: '2026-08-10T00:00:00.000Z',
      },
    ]);
    mockApi.getModeNotes.mockResolvedValue([
      {
        modeId: 'vulnerable_child',
        healthyView: 'Старое слово',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mockApi.getPhraseChecks.mockResolvedValue([]);

    const { result } = renderHook(() => useAboutMe());
    await waitFor(() =>
      expect(
        result.current.portraitReady && result.current.warmWordsReady,
      ).toBe(true),
    );

    expect(result.current.warmWordsItems).toHaveLength(2);
    expect(result.current.warmWordsItems[0].text).toBe('Свежее тёплое слово');
  });
});

// Замер 2026-08-23: вкладка «Я» была ~2× дольше соседних, потому что обе
// карточки ждали общий Promise.all из шести запросов. Гейт per-карточка:
// портрет готов по своим двум источникам, не дожидаясь «тёплых слов».
describe('useAboutMe — готовность по карточкам, не общая', () => {
  it('портрет готов, пока getModeNotes/getPhraseChecks ещё висят', async () => {
    mockApi.getProfile.mockResolvedValue(emptyProfile);
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getSchemaDiary.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([]);
    mockApi.getModeNotes.mockReturnValue(new Promise(() => {}));
    mockApi.getPhraseChecks.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAboutMe());

    await waitFor(() => expect(result.current.portraitReady).toBe(true));
    expect(result.current.warmWordsReady).toBe(false);
  });

  it('и наоборот: тёплые слова готовы, пока профиль ещё висит', async () => {
    mockApi.getProfile.mockReturnValue(new Promise(() => {}));
    mockApi.getYsqHistory.mockReturnValue(new Promise(() => {}));
    mockApi.getSchemaDiary.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([]);
    mockApi.getModeNotes.mockResolvedValue([]);
    mockApi.getPhraseChecks.mockResolvedValue([]);

    const { result } = renderHook(() => useAboutMe());

    await waitFor(() => expect(result.current.warmWordsReady).toBe(true));
    expect(result.current.portraitReady).toBe(false);
  });
});
