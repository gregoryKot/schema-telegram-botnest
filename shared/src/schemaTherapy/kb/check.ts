// Чистые функции сторожа базы знаний (.claude/rules/knowledge-base.md): проверки на
// произвольных данных, чтобы тест гейта гонял их на фейках (оба исхода).

export type KbKind = 'mode' | 'schema' | 'technique' | 'need';

export const KB_KIND_LABEL: Record<KbKind, string> = {
  mode: 'режима',
  schema: 'схемы',
  technique: 'техники',
  need: 'потребности',
};

export interface KbTable {
  /** Путь от корня репозитория. */
  file: string;
  kind: KbKind;
  coverage: 'all' | 'subset';
  /** Обязателен для subset: почему таблица частичная. */
  why?: string;
  /** id таблицы; без keys полнота сверяется по тексту файла (только coverage 'all'). */
  keys?: () => readonly string[];
  /** Старые id, которые таблица держит законно (данные клиентов). */
  legacy?: readonly string[];
  /** Файл вне shared/: тест, который сверяет его с источником. */
  syncSpec?: string;
}

export interface KbIgnore {
  /** Файл или каталог (с `/` на конце) от корня репозитория. */
  file: string;
  why: string;
}

/** Каких id вида не хватает и какие лишние (нет в источнике и не legacy). */
export function coverage(
  keys: readonly string[],
  ids: readonly string[],
  legacy: readonly string[] = [],
): { missing: string[]; extra: string[] } {
  const have = new Set(keys);
  const known = new Set([...ids, ...legacy]);
  return {
    missing: ids.filter((id) => !have.has(id)),
    extra: [...have].filter((k) => !known.has(k)),
  };
}

// Строковый литерал (можно с префиксом вида: 'technique:chairwork') или ключ объекта.
const TOKEN =
  /(['"`])(?:[a-z]+:)?([a-z][a-z0-9_]*)\1|(?:^|[{,\s])([a-z][a-z0-9_]*)\s*:/gm;

/** Все слова-кандидаты в id из текста файла. */
export function textTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(TOKEN)) out.add(m[2] ?? m[3]);
  return out;
}

/** Сколько разных id из списка встречается в тексте литералом или ключом. */
export function discover(text: string, ids: readonly string[]): number {
  const tokens = textTokens(text);
  return ids.filter((id) => tokens.has(id)).length;
}

/** Ошибки записи реестра, кроме полноты: subset без why, нет файла, нет сверки. */
export function entryProblems(
  t: KbTable,
  exists: (file: string) => boolean,
): string[] {
  const out: string[] = [];
  const at = `${t.file} (${t.kind})`;
  if (!exists(t.file))
    out.push(`${at}: файла нет — исправить путь в kb/tables*.ts`);
  if (t.coverage === 'subset' && !t.why?.trim())
    out.push(`${at}: subset без why — объяснить, почему таблица частичная`);
  const outside = !t.file.startsWith('shared/');
  if (t.syncSpec && !exists(t.syncSpec))
    out.push(`${at}: syncSpec ${t.syncSpec} не существует`);
  if (outside && !t.syncSpec && t.coverage === 'subset')
    out.push(
      `${at}: частичная таблица вне shared/ — нужен syncSpec (тест-сверка)`,
    );
  if (!outside && !t.keys && t.coverage === 'subset')
    out.push(
      `${at}: частичная таблица без keys — нужна функция, возвращающая её id`,
    );
  return out;
}

/** Ошибки полноты: что добавить и что убрать, с именем файла и id. */
export function coverageProblems(
  t: KbTable,
  ids: readonly string[],
  readText: (file: string) => string,
): string[] {
  const label = KB_KIND_LABEL[t.kind];
  if (t.keys) {
    const { missing, extra } = coverage(t.keys(), ids, t.legacy);
    return [
      ...(t.coverage === 'all' ? missing : []).map(
        (id) => `добавить строку для ${label} ${id} в ${t.file}`,
      ),
      ...extra.map(
        (id) =>
          `${t.file}: id ${id} нет среди id ${label} — исправить опечатку, удалить строку или внести id в legacy`,
      ),
    ];
  }
  if (t.coverage !== 'all') return [];
  const tokens = textTokens(readText(t.file));
  return ids
    .filter((id) => !tokens.has(id))
    .map((id) => `добавить строку для ${label} ${id} в ${t.file}`);
}

/** Рёбра, ведущие в несуществующий id. */
export function danglingEdges(
  pairs: readonly (readonly [string, string])[],
  ids: readonly string[],
): [string, string][] {
  const known = new Set(ids);
  return pairs.filter(([, to]) => !known.has(to)).map(([a, b]) => [a, b]);
}

/** Сверка списка дыр с фактом: дыра без строки, строка без дыры, строка про чужой id. */
export function gapProblems(
  holes: readonly string[],
  listed: readonly string[],
  ids: readonly string[],
): { unlisted: string[]; stale: string[]; unknown: string[] } {
  const holeSet = new Set(holes);
  const known = new Set(ids);
  return {
    unlisted: holes.filter((h) => !listed.includes(h)),
    stale: listed.filter((l) => known.has(l) && !holeSet.has(l)),
    unknown: listed.filter((l) => !known.has(l)),
  };
}
