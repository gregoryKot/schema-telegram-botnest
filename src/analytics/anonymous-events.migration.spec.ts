// Сверка (правило №4): список анонимных событий в коде и миграция, которая
// обезличила уже накопленные строки (D-10, аудит 2026-10), обязаны совпадать.
// Добавили событие в ANONYMOUS_EVENTS, а старые строки с userId остались —
// в БД по-прежнему лежит «человек X увидел кризисную карточку».
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ANONYMOUS_EVENTS } from './anonymous-events.constants';

const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');

function migrationSql(): string {
  const dir = readdirSync(MIGRATIONS).find((d) =>
    d.endsWith('_analytics_crisis_anonymous'),
  );
  if (!dir) throw new Error('нет миграции *_analytics_crisis_anonymous');
  return readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8');
}

describe('миграция обезличивания кризисных событий ↔ ANONYMOUS_EVENTS', () => {
  const sql = migrationSql();

  it('перечисляет ровно те же имена событий, что и ANONYMOUS_EVENTS', () => {
    const inList = /"name"\s+IN\s*\(([^)]*)\)/.exec(sql);
    expect(inList).not.toBeNull();
    const names = [...inList![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...names].sort()).toEqual([...ANONYMOUS_EVENTS].sort());
  });

  it('только обнуляет userId (данные-only, строки не удаляются) и идемпотентна', () => {
    expect(sql).toMatch(
      /UPDATE\s+"AnalyticsEvent"\s+SET\s+"userId"\s*=\s*NULL/,
    );
    expect(sql).not.toMatch(/\bDELETE\b|\bDROP\b|\bALTER\b/i);
    expect(sql).toMatch(/"userId"\s+IS\s+NOT\s+NULL/);
  });
});
