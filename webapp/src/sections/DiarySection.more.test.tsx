// @vitest-environment jsdom
// «Записи» → «Показать ещё» (R6, аудит 2026-11): список дневника отдавал 30
// последних записей, и старшие было не увидеть. Первая страница несёт признак
// «есть ещё» от сервера; кнопка догружает следующую страницу старше последней
// показанной записи и пропадает, когда записей больше нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiarySection } from './DiarySection';
import { oldestId } from './diary/useDiaryLists';

vi.mock('../api', () => ({
  api: { getDiaryPage: vi.fn(), getProfile: vi.fn(), history: vi.fn(), trackEvent: vi.fn(), createSchemaDiary: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Запись схем № n: чем больше n, тем она новее (день n в 2026-08).
const entry = (n: number) => ({
  id: n,
  createdAt: `2026-08-${String(n).padStart(2, '0')}T10:00:00Z`,
  trigger: `Запись номер ${n}`,
  emotions: [],
  schemaIds: [],
});
const EMPTY = { items: [], hasMore: false };
const newest = Array.from({ length: 30 }, (_, i) => entry(31 - i)); // 31..2

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getProfile.mockResolvedValue(null);
  mockApi.history.mockResolvedValue([]);
});
afterEach(() => cleanup());

const renderSection = () =>
  render(
    <MemoryRouter>
      <DiarySection />
    </MemoryRouter>,
  );

describe('DiarySection — «Показать ещё»', () => {
  it('догружает записи старше последней показанной, затем кнопка пропадает', async () => {
    mockApi.getDiaryPage.mockImplementation(async (kind: string, before?: number) => {
      if (kind !== 'schema') return EMPTY;
      return before === undefined ? { items: newest, hasMore: true } : { items: [entry(1)], hasMore: false };
    });
    renderSection();
    await screen.findByText('Запись номер 31');
    expect(screen.queryByText('Запись номер 1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Показать ещё' }));
    await screen.findByText('Запись номер 1');
    expect(mockApi.getDiaryPage).toHaveBeenCalledWith('schema', 2);
    // Дневники без «есть ещё» повторно не запрашиваются.
    expect(mockApi.getDiaryPage).not.toHaveBeenCalledWith('mode', expect.anything());
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull();
  });

  it('записей не больше страницы — кнопки нет', async () => {
    mockApi.getDiaryPage.mockImplementation(async (kind: string) =>
      kind === 'schema' ? { items: [entry(5)], hasMore: false } : EMPTY,
    );
    renderSection();
    await screen.findByText('Запись номер 5');
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull();
  });

  it('сбой догрузки — честная строка и повтор; лента на месте', async () => {
    let fail = true;
    mockApi.getDiaryPage.mockImplementation(async (kind: string, before?: number) => {
      if (kind !== 'schema') return EMPTY;
      if (before === undefined) return { items: newest, hasMore: true };
      if (fail) throw new Error('offline');
      return { items: [entry(1)], hasMore: false };
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Показать ещё' }));
    await screen.findByText('Более ранние записи не загрузились.');
    expect(screen.getByText('Запись номер 31')).toBeTruthy();

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('Запись номер 1');
    await waitFor(() => expect(screen.queryByText('Более ранние записи не загрузились.')).toBeNull());
  });
});

// Хвост R6: сохранение из быстрой записи перезагружает первую страницу — и
// сбрасывало догруженное, «Показать ещё» приходилось жать заново.
describe('DiarySection — догруженное переживает сохранение из быстрой записи', () => {
  it('после «Записать → Сохранить» старые записи на месте, новая сверху, лишнего запроса нет', async () => {
    let saved = false;
    mockApi.createSchemaDiary.mockImplementation(async () => { saved = true; return entry(32); });
    mockApi.getDiaryPage.mockImplementation(async (kind: string, before?: number) => {
      if (kind !== 'schema') return EMPTY;
      if (before !== undefined) return { items: [entry(1)], hasMore: false };
      return saved
        ? { items: [entry(32), ...newest.slice(0, 29)], hasMore: true } // 32..3: запись 2 уехала на вторую страницу
        : { items: newest, hasMore: true };
    });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Показать ещё' }));
    await screen.findByText('Запись номер 1');

    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));
    fireEvent.change(screen.getByPlaceholderText('Можно одним предложением. Можно без точки.'), { target: { value: 'Новая мысль' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Запись номер 32');

    expect(screen.getByText('Запись номер 2')).toBeTruthy();
    expect(screen.getByText('Запись номер 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull();
    expect(mockApi.getDiaryPage.mock.calls.filter((c) => c[1] !== undefined)).toHaveLength(1);
  });
});

describe('useDiaryLists — курсор и склейка страниц', () => {
  it('курсор — последняя (самая старая) запись; пустой список — без курсора', () => {
    expect(oldestId([{ id: 9 }, { id: 4 }])).toBe(4);
    expect(oldestId([])).toBeUndefined();
  });
});
