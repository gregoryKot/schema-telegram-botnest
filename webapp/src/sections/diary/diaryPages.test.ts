// Хвост R6 (аудит 2026-11): догруженная страница вставала в хвост, а
// перезагрузка после сохранения из быстрой записи сбрасывала догруженное.
import { describe, it, expect } from 'vitest';
import { byNewest, mergePage, refreshFirstPage } from './diaryPages';

type E = { id: number; at: string; v?: string };
const e = (id: number, day: number, v?: string): E => ({ id, at: `2026-08-${String(day).padStart(2, '0')}T10:00:00.000Z`, v });
const key = (r: E) => r.at;
const ids = (rows: E[]) => rows.map((r) => r.id);

describe('byNewest', () => {
  it('новые сверху; при равном моменте выше больший id (как сервер)', () => {
    const rows = [e(1, 3), e(5, 1), e(4, 3), e(2, 9)];
    expect(ids(rows.sort(byNewest(key)))).toEqual([2, 4, 1, 5]);
  });
});

describe('mergePage', () => {
  it('страница встаёт по дате, а не в хвост; повторов нет, свежая копия побеждает', () => {
    const list = [e(10, 20), e(9, 15), e(7, 3)]; // запись дня 3 добавлена локально раньше догрузки
    const page = [e(9, 15, 'свежая'), e(8, 10), e(6, 1)];
    const merged = mergePage(list, page, key);
    expect(ids(merged)).toEqual([10, 9, 8, 7, 6]);
    expect(merged[1].v).toBe('свежая');
  });
});

describe('refreshFirstPage', () => {
  const loaded = [e(31, 31), e(30, 30), e(3, 3), e(2, 2), e(1, 1)]; // 31..30 + догружено 3..1

  it('после сохранения: первая страница заменяет свой диапазон, догруженное старше — остаётся', () => {
    const page = { items: [e(32, 31), e(31, 31), e(30, 30), e(3, 3)], hasMore: true };
    const r = refreshFirstPage(loaded, false, page, key);
    expect(ids(r.rows)).toEqual([32, 31, 30, 3, 2, 1]);
    expect(r.more).toBe(false); // старше 1 на сервере ничего — кнопка не возвращается
  });

  it('удалённая на сервере запись из диапазона первой страницы не воскресает', () => {
    const page = { items: [e(31, 31), e(3, 3)], hasMore: true }; // 30 удалили в другой вкладке
    expect(ids(refreshFirstPage(loaded, true, page, key).rows)).toEqual([31, 3, 2, 1]);
  });

  it('догружать было нечего: признак «есть ещё» — от сервера', () => {
    const page = { items: [e(31, 31), e(30, 30)], hasMore: true };
    expect(refreshFirstPage([], false, page, key)).toEqual({ rows: page.items, more: true });
    expect(refreshFirstPage([e(31, 31), e(30, 30)], true, page, key).more).toBe(true);
  });

  it('сервер говорит «всё на первой странице» — список равен ей', () => {
    const page = { items: [e(31, 31)], hasMore: false };
    expect(refreshFirstPage(loaded, true, page, key)).toEqual({ rows: page.items, more: false });
  });
});
