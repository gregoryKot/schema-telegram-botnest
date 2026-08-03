// Подтяжка содержимого записи «Моего пути» по тапу (read-after-write:
// запись создана в одном месте — schema-дневнике/трекере/т.п. — и здесь
// должна находиться по item.id/дате и корректно превращаться в карточку).
// Мокаем api целиком — реальные HTTP-клиенты живут во фронтендах.
import { describe, it, expect, vi } from 'vitest';
import {
  fetchJourneyResult,
  fetchJourneyDetail,
  type JourneyContentApi,
} from './journeyContent';
import type { JourneyItem } from './journeyMeta';
import { QUESTIONS } from '../hooks/useYsqTest';

// Заглушка api: явно кидает, если метод не замокан для теста — так виден
// случайный поход не в тот эндпоинт (баг «читаем не то, что писали»).
function stubApi(overrides: Partial<JourneyContentApi>): JourneyContentApi {
  const unimplemented = (name: string) => () => {
    throw new Error(`api.${name} не замокан в этом тесте`);
  };
  const names: (keyof JourneyContentApi)[] = [
    'getSchemaDiary',
    'getModeDiary',
    'getGratitudeDiary',
    'getBeliefChecks',
    'getLetters',
    'getFlashcards',
    'getSafePlace',
    'getNote',
    'getPractices',
    'getPlanHistory',
    'ratings',
    'getSchemaNotes',
    'getModeNotes',
    'getYsqHistory',
    'getYsqResult',
  ];
  const base = Object.fromEntries(
    names.map((n) => [n, unimplemented(n)]),
  ) as unknown as JourneyContentApi;
  return { ...base, ...overrides };
}

const item = (patch: Partial<JourneyItem>): JourneyItem => ({
  type: 'note',
  at: '2026-07-20',
  ...patch,
});

describe('fetchJourneyResult — сохранил → нашёл по id', () => {
  it('schema_diary: находит запись по id среди списка, а не первую попавшуюся', async () => {
    const api = stubApi({
      getSchemaDiary: async () => [
        { id: 1, trigger: 'первая', healthyView: '' },
        { id: 2, trigger: 'вторая', healthyView: 'взгляд' },
      ],
    });
    const result = await fetchJourneyResult(
      api,
      item({ type: 'schema_diary', id: 2 }),
    );
    expect(result?.parts).toEqual([
      { title: 'Ситуация', text: 'вторая' },
      { title: 'Здоровый взгляд', text: 'взгляд' },
    ]);
  });

  it('id, которого нет в списке (запись удалена/рассинхрон) — null, без падения', async () => {
    const api = stubApi({ getSchemaDiary: async () => [] });
    const result = await fetchJourneyResult(
      api,
      item({ type: 'schema_diary', id: 999 }),
    );
    expect(result).toBeNull();
  });

  it('note читается по дате (item.at), не по id — своя ветка без byId', async () => {
    const getNote = vi.fn(async (date: string) => ({
      text: date === '2026-07-20' ? 'заметка дня' : null,
    }));
    const api = stubApi({ getNote });
    const result = await fetchJourneyResult(
      api,
      item({ type: 'note', at: '2026-07-20T09:00:00Z' }),
    );
    expect(getNote).toHaveBeenCalledWith('2026-07-20');
    expect(result?.parts).toEqual([{ title: undefined, text: 'заметка дня' }]);
  });

  it('practice: без needId в записи ленты — не ходит в api, сразу пусто', async () => {
    const api = stubApi({});
    const result = await fetchJourneyResult(api, item({ type: 'practice' }));
    expect(result).toBeNull();
  });

  it('practice: с needId ищет среди практик именно этой потребности', async () => {
    const api = stubApi({
      getPractices: async (needId) =>
        needId === 'play' ? [{ id: 5, text: 'Порисовать' }] : [],
    });
    const result = await fetchJourneyResult(
      api,
      item({ type: 'practice', id: 5, needId: 'play' }),
    );
    expect(result?.parts).toEqual([{ title: 'Моя практика', text: 'Порисовать' }]);
  });

  it('schema_note: без schemaIds в записи ленты — не ходит в api', async () => {
    const getSchemaNotes = vi.fn(async () => []);
    const api = stubApi({ getSchemaNotes });
    const result = await fetchJourneyResult(api, item({ type: 'schema_note' }));
    expect(getSchemaNotes).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('mode_note: ищет по modeId записи', async () => {
    const api = stubApi({
      getModeNotes: async () => [
        { modeId: 'vulnerable_child', triggers: 'Критика', healthyView: '', behavior: '' },
      ],
    });
    const result = await fetchJourneyResult(
      api,
      item({ type: 'mode_note', modeId: 'vulnerable_child' }),
    );
    expect(result?.parts).toEqual([{ title: 'Триггеры', text: 'Критика' }]);
  });

  it('незнакомый тип записи → null без похода в api (default-ветка)', async () => {
    const result = await fetchJourneyResult(stubApi({}), item({ type: 'exotic' }));
    expect(result).toBeNull();
  });
});

describe('fetchJourneyResult — ysq (id из истории и фолбэк старого юзера)', () => {
  it('с id: тянет из истории и отдаёт scores/activeCount', async () => {
    const api = stubApi({
      getYsqHistory: async () => [
        { id: 1, completedAt: '2026-01-01', scores: [{ id: 'Покорность', pct5plus: 60, avg: 4.5 }] },
      ],
    });
    const result = await fetchJourneyResult(api, item({ type: 'ysq', id: 1 }));
    expect(result?.ysq?.activeCount).toBe(1);
  });

  it('без id (старый юзер): считает схемы из сохранённых ответов теста, не из истории', async () => {
    // Все ответы «совершенно верно» (6) → каждая из 20 схем выраженная.
    const api = stubApi({
      getYsqResult: async () => ({ answers: Array(QUESTIONS.length).fill(6) }),
    });
    const result = await fetchJourneyResult(api, item({ type: 'ysq' }));
    expect(result?.parts[0].text).toBe('Выраженных схем: 20 из 20');
  });

  it('без id и без результата — null (нет истории теста вообще)', async () => {
    const api = stubApi({ getYsqResult: async () => null });
    const result = await fetchJourneyResult(api, item({ type: 'ysq' }));
    expect(result).toBeNull();
  });
});

describe('fetchJourneyResult — tracker_day несёт сырые оценки для радара', () => {
  it('есть хотя бы одна оценка из пятёрки → результат с ratings', async () => {
    const api = stubApi({
      ratings: async () => ({ attachment: 7, autonomy: 8, unrelated: 1 }),
    });
    const result = await fetchJourneyResult(
      api,
      item({ type: 'tracker_day', at: '2026-07-20' }),
    );
    expect(result?.ratings).toEqual({ attachment: 7, autonomy: 8, unrelated: 1 });
  });

  it('день без единой оценки из нужных пяти — null, не «0 из 5»', async () => {
    const api = stubApi({ ratings: async () => ({}) });
    const result = await fetchJourneyResult(api, item({ type: 'tracker_day' }));
    expect(result).toBeNull();
  });
});

describe('fetchJourneyDetail', () => {
  it('прокидывает найденную запись в buildJourneyDetailParts (все поля)', async () => {
    const api = stubApi({
      getLetters: async () => [{ id: 3, text: 'Полный текст письма' }],
    });
    const parts = await fetchJourneyDetail(
      api,
      item({ type: 'letter', id: 3 }),
    );
    expect(parts).toEqual([{ title: undefined, text: 'Полный текст письма' }]);
  });

  it('запись не найдена → пустой массив, не падение', async () => {
    const api = stubApi({ getLetters: async () => [] });
    const parts = await fetchJourneyDetail(api, item({ type: 'letter', id: 1 }));
    expect(parts).toEqual([]);
  });
});
