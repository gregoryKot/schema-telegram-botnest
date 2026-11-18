// Задания из справочника в общем поиске: поиск по названию, лимит, условия показа.
import { describe, it, expect, vi } from 'vitest';
import type { CatalogTask } from '../../../../shared/src/tasks/catalog/taskCatalog';
import type { PaletteInput } from './paletteRows';
import { TASKS_SHOWN, allTaskRows, taskRows } from './taskRows';

const task = (id: string, title: string, group: CatalogTask['group'] = 'modes'): CatalogTask =>
  ({ id, title, variants: [{ text: 'Что делать', forModes: [], forSchemas: [] }], why: '', group });
const TASKS = [task('pismo', 'Письмо Критику'), task('dnevnik', 'Дневник гнева', 'schemas'), ...Array.from({ length: 8 }, (_, i) => task(`p${i}`, `Пауза ${i}`))];
const input = (query: string, over: Partial<PaletteInput> = {}) => ({
  query, clients: [{ telegramId: 1 }], screenShare: false, guide: { tasks: TASKS }, run: { pickAssignee: vi.fn() }, ...over,
}) as unknown as PaletteInput;

describe('taskRows', () => {
  it('ищет по названию; подзаголовок — группа каталога', () => {
    const hits = taskRows(input('дневник'));
    expect(hits.map((h) => h.row)).toMatchObject([{ key: 'task:dnevnik', kind: 'task', label: 'Дневник гнева', sub: 'Дать клиенту · При схемах', stay: true }]);
  });

  it('не больше лимита, лучшие первыми', () => {
    const hits = taskRows(input('пауза'));
    expect(hits).toHaveLength(TASKS_SHOWN);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[TASKS_SHOWN - 1].score);
  });

  it('нет клиентов, «Показ экрана» или справочник не загружен — строк нет', () => {
    for (const over of [{ clients: [] }, { screenShare: true }, { guide: null }]) {
      expect(taskRows(input('письмо', over))).toEqual([]);
      expect(allTaskRows(input('', over))).toEqual([]);
    }
    expect(allTaskRows(input(''))).toHaveLength(TASKS.length);
  });
});
