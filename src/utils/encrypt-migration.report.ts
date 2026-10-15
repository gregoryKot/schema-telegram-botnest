// Текст итога миграции клинических меток для владельца: один и тот же уходит в
// logger.error (DM через AlertLogger) и в детали пробы `clinicalLabels`
// (/stats, DM). Правило №8 CLAUDE.md: язык простой, без жаргона и без
// числительных, которые надо согласовывать со словом («1 строк» — нельзя),
// поэтому число стоит после двоеточия. Только имена таблиц и счётчики —
// содержимое меток в текст не попадает (они клинические).

export interface ClinicalProblems {
  /** Строки под нечитаемым ключом, по таблицам. */
  unknownKey: Record<string, number>;
  /** Сколько строк не удалось записать. */
  failures: number;
}

const total = (m: Record<string, number>): number =>
  Object.values(m).reduce((a, b) => a + b, 0);

/** Остаток по пунктам; пустой массив — остатка нет (на чистой БД текста нет вовсе). */
export function describeClinicalProblems(r: ClinicalProblems): string[] {
  const parts: string[] = [];
  const lost = total(r.unknownKey);
  if (lost > 0) {
    const tables = Object.entries(r.unknownKey)
      .map(([t, n]) => `${t}: ${n}`)
      .join(', ');
    parts.push(
      `строк под нечитаемым ключом: ${lost} (${tables}) — старый ключ ` +
        'шифрования убран раньше, чем дошифровались строки',
    );
  }
  if (r.failures > 0) parts.push(`не удалось записать строк: ${r.failures}`);
  return parts;
}
