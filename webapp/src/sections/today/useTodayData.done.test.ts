// @vitest-environment jsdom
// «Сделано сегодня» для фокус-карточки считается из дневников, а перечитывание
// после записи (reloadDiaries) обновляет его без сброса профиля.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn(), getSchemaDiary: vi.fn(), getModeDiary: vi.fn(), getGratitudeDiary: vi.fn(),
    getTherapyRelation: vi.fn(), history: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { useTodayData } from './useTodayData';
import { todayStr } from '../../utils/format';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const now = () => new Date().toISOString();
// День благодарности — местный день человека (shared/src/diary/diaryDay.ts),
// а не гринвичский: так её и пишут, так и сверяют «сделано сегодня».
const todayDay = () => todayStr();

beforeEach(() => {
  vi.clearAllMocks();
  m.getProfile.mockResolvedValue({ mySchemaIds: [] });
  m.getModeDiary.mockResolvedValue([]);
  m.getTherapyRelation.mockResolvedValue(null);
  m.history.mockResolvedValue([]);
});

describe('useTodayData — todayDone', () => {
  it('пустые дневники: ничего не сделано, благодарности нет', async () => {
    m.getSchemaDiary.mockResolvedValue([]);
    m.getGratitudeDiary.mockResolvedValue([]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.todayDone).toEqual({ schema: false, mode: false, gratitude: false });
    expect(result.current.gratitudeToday).toBeUndefined();
  });

  it('запись за вчера не считается, а после reloadDiaries новая запись видна', async () => {
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString();
    m.getSchemaDiary.mockResolvedValue([{ id: 1, createdAt: yesterday, trigger: 'Т' }]);
    m.getGratitudeDiary.mockResolvedValue([]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.todayDone.schema).toBe(false);

    m.getSchemaDiary.mockResolvedValue([{ id: 2, createdAt: now(), trigger: 'Т' }]);
    m.getGratitudeDiary.mockResolvedValue([{ id: 3, date: todayDay(), items: ['a', 'b'] }]);
    act(() => result.current.reloadDiaries());
    await waitFor(() => expect(result.current.todayDone.schema).toBe(true));
    expect(result.current.todayDone.gratitude).toBe(true);
    expect(result.current.gratitudeToday).toEqual(['a', 'b']);
    expect(result.current.profile).not.toBeNull();
  });
});

// Инцидент 2026-10-26: в 00:19 по Москве (21:19 UTC) «сегодня» — уже 27-е.
// Благодарность за 26-е «Ещё» не дописывает: её пункты ушли бы в запись 27-го.
describe('useTodayData — благодарность сегодня по местному дню', () => {
  let prevTz: string | undefined;
  beforeEach(() => {
    prevTz = process.env.TZ;
    process.env.TZ = 'Europe/Moscow';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T21:19:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  });

  it('запись 27-го — сделано сегодня, её пункты дописываются', async () => {
    m.getSchemaDiary.mockResolvedValue([]);
    m.getGratitudeDiary.mockResolvedValue([{ id: 3, date: '2026-10-27', items: ['чай'] }]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.todayDone.gratitude).toBe(true);
    expect(result.current.gratitudeToday).toEqual(['чай']);
  });

  it('запись 26-го (гринвичское «сегодня») — уже вчера', async () => {
    m.getSchemaDiary.mockResolvedValue([]);
    m.getGratitudeDiary.mockResolvedValue([{ id: 4, date: '2026-10-26', items: ['вчера'] }]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.todayDone.gratitude).toBe(false);
    expect(result.current.gratitudeToday).toBeUndefined();
  });
});
