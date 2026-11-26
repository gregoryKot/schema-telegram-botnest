// Счёт нечитаемого шифротекста по колонке для пробы encryptionReadable
// (probe-encryption-readable.ts). Два вида колонок: строка-шифротекст и
// массив снапшотов. ClientConceptualization.history — JSON-массив, у каждого
// снапшота поле зашифровано ОТДЕЛЬНОЙ строкой
// (src/cli/rotate-encryption/rotate-history.ts); до 2026-11 проба его
// пропускала. Обход тот же, что у ротации: каждое строковое поле снапшота.
import { tryDecrypt } from '../../utils/crypto';

export interface ColumnTally {
  column: string;
  checked: number;
  unreadable: number;
}

/** Колонки со снапшотами по таблицам из TARGETS (читаются тем же запросом). */
export const NESTED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  clientConceptualization: ['history'],
};

type Rows = ReadonlyArray<Record<string, unknown>>;

/** Строковая колонка: каждое непустое значение — шифротекст. */
export function tallyColumn(
  column: string,
  key: string,
  rows: Rows,
): ColumnTally {
  const tally: ColumnTally = { column, checked: 0, unreadable: 0 };
  for (const row of rows) {
    const v = row[key];
    // Шифротекст — строка. null и легаси-JSON (массив/объект) не трогаем.
    if (typeof v !== 'string' || v === '') continue;
    tally.checked++;
    const r = tryDecrypt(v);
    if (!r.ok && r.looksCipher) tally.unreadable++;
  }
  return tally;
}

function isSnapshot(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Счёт по колонке со снапшотами. В `checked` — только шифротекст (читаемый или
 * похожий на наш): открытые поля снапшота (`savedAt`, версия) и легаси-текст
 * не шифруются и в счёт не идут, иначе «проверено» считало бы даты.
 */
export function tallyNested(
  column: string,
  key: string,
  rows: Rows,
): ColumnTally {
  const tally: ColumnTally = { column, checked: 0, unreadable: 0 };
  for (const row of rows) {
    const snaps = row[key];
    if (!Array.isArray(snaps)) continue;
    for (const v of snaps.filter(isSnapshot).flatMap((s) => Object.values(s))) {
      if (typeof v !== 'string' || v === '') continue;
      const r = tryDecrypt(v);
      if (!r.ok && !r.looksCipher) continue;
      tally.checked++;
      if (!r.ok) tally.unreadable++;
    }
  }
  return tally;
}
