// Эмуляция единственного сырого запроса, который встречается в смоуке, —
// захвата аренды крона (src/infra/cron-leader.service.ts).
//
// Семантика повторяет Postgres: вставка при первом прогоне, обновление только
// если прошлый прогон старше окна. Заглушка «всегда лидер» была бы проще и
// снова развела бы фейк с реальностью на зелёных тестах — ровно тот класс, из-за
// которого ключевые e2e гоняются вторым прогоном на живой БД.
//
// Вынесено из fake-prisma.ts, чтобы тот не пробил потолок размера (правило №10).

interface LeaseRow {
  name: string;
  runAt: Date;
  instanceId: string;
}

/**
 * Делегат `$executeRaw` фейка. Любой сырой SQL, кроме захвата аренды, — громкая
 * ошибка, а не молчаливый 0: неверный ответ на неэмулируемый запрос хуже, чем
 * его отсутствие.
 */
export function makeFakeExecuteRaw(rows: LeaseRow[]) {
  return jest.fn((chunks: string[], ...values: unknown[]) => {
    const sql = Array.isArray(chunks) ? chunks.join(' ') : String(chunks);
    if (!sql.includes('"CronLease"')) {
      throw new Error(`fake prisma: неэмулируемый $executeRaw: ${sql.trim()}`);
    }
    return applyCronLeaseClaim(rows, values);
  });
}

/**
 * Возвращает число «обновлённых строк», как настоящий $executeRaw: 1 — прогон
 * забран этим вызовом, 0 — его уже забрали внутри окна.
 */
export function applyCronLeaseClaim(rows: LeaseRow[], values: unknown[]) {
  const [name, runAt, instanceId] = values as [string, Date, string];
  const notAfter = values[values.length - 1] as Date;
  const existing = rows.find((r) => r.name === name);
  if (!existing) {
    rows.push({ name, runAt, instanceId });
    return 1;
  }
  if (existing.runAt > notAfter) return 0;
  existing.runAt = runAt;
  existing.instanceId = instanceId;
  return 1;
}
