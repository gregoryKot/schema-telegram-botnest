// Сверка (правило №4): id справочника заданий на бэкенде и ключи текстов «зачем» в shared —
// один список. Разъехались — сервер отвечает 400 на задание из справочника или пускает id без текста.
import { readFileSync } from 'fs';
import { join } from 'path';
import { TASK_CATALOG_ID_MAX, TASK_CATALOG_IDS } from './task-catalog-ids';

const DIR = join(__dirname, '..', '..', 'shared', 'src', 'tasks', 'catalog');

function sharedIds(): string[] {
  return [
    'taskWhyModes.ts',
    'taskWhyAbandoned.ts',
    'taskWhyChildModes.ts',
    'taskWhyHealthy.ts',
    'taskWhySchemas.ts',
  ].flatMap((file) =>
    [
      ...readFileSync(join(DIR, file), 'utf8').matchAll(
        /^ {2}'([a-zа-я0-9-]+)':/gm,
      ),
    ].map((m) => m[1]),
  );
}

describe('id справочника заданий: бэкенд ↔ shared', () => {
  it('списки совпадают, повторов нет, каждый id влезает в предел DTO', () => {
    const shared = sharedIds();
    expect(shared.length).toBeGreaterThanOrEqual(60);
    expect([...TASK_CATALOG_IDS].sort()).toEqual([...shared].sort());
    expect(new Set(shared).size).toBe(shared.length);
    for (const id of shared)
      expect(id.length).toBeLessThanOrEqual(TASK_CATALOG_ID_MAX);
  });
});
