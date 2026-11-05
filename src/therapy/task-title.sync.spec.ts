// Правило №4: названия схем и режимов в task-title.data.ts — копия из shared/
// (бэкенд его не импортирует). Тест падает при рассинхроне.
import { readFileSync } from 'fs';
import { join } from 'path';
import { MODE_NAMES, SCHEMA_NAMES } from './task-title.data';
import { taskNotificationTitle } from './task-title';

const read = (f: string): Record<string, string> => {
  const src = readFileSync(
    join(__dirname, '..', '..', 'shared', 'src', 'schemaTherapy', 'content', f),
    'utf8',
  );
  const re = /id: '([a-z_]+)',\s*\n\s*name: '([^']+)'/g;
  const out: Record<string, string> = {};
  for (const m of src.matchAll(re)) out[m[1]] = m[2];
  return out;
};

describe('task-title.data ↔ shared', () => {
  it('названия схем совпадают', () => {
    const shared = read('schemaDomains.ts');
    expect(Object.keys(shared)).toHaveLength(20);
    expect(SCHEMA_NAMES).toEqual(shared);
  });
  it('названия режимов совпадают', () => {
    const shared = read('modeGroups.ts');
    expect(Object.keys(shared)).toHaveLength(35);
    expect(MODE_NAMES).toEqual(shared);
  });

  // Формулировки — те же, что показывает сайт (getTaskDisplayText): префиксы
  // и фолбэки без названия берутся из текста shared-файла, а не выдумываются.
  it('префиксы и фолбэки совпадают с shared/src/tasks/taskTitle.ts', () => {
    const src = readFileSync(
      join(__dirname, '..', '..', 'shared', 'src', 'tasks', 'taskTitle.ts'),
      'utf8',
    );
    for (const literal of [
      '`Карточка схемы: ${',
      '`Карточка режима: ${',
      "'Карточка схемы'",
      "'Карточка режима'",
    ])
      expect(src).toContain(literal);
    expect(taskNotificationTitle('schema_intro', 'nope')).toBe('Карточка схемы');
    expect(taskNotificationTitle('mode_intro', 'nope')).toBe('Карточка режима');
  });
});
