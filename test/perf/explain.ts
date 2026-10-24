// EXPLAIN (ANALYZE, BUFFERS) по записанным запросам + сведение плана к тем
// числам, по которым можно поставить гейт.
//
// Что меряем и почему именно это:
//   • Seq Scan по большой таблице с большим отбросом строк — главный признак
//     отсутствующего индекса. Сам по себе Seq Scan не грех: `count(DISTINCT
//     "userId") FROM "UserPractice"` читает таблицу целиком законно, индекс
//     тут не поможет. Грех — прочитать миллион строк и выбросить 99% (ровно
//     так жил `/stats` до индекса `Rating.date`). Поэтому гейт смотрит не на
//     «есть Seq Scan», а на «сколько прочитанного выброшено».
//   • Блоки (shared hit + read) — сколько страниц тронул запрос. Число
//     детерминированное при фиксированной синтетике, в отличие от миллисекунд
//     на шумном раннере: по нему можно ставить храповик, по времени — только
//     грубый потолок-страховку.
//   • Loops у Seq Scan — повторный полный проход внутри Nested Loop. Один
//     план, прочитавший таблицу 50 раз, в миллисекундах выглядит как «долго»,
//     а в плане виден как причина.
import { Client } from 'pg';
import { RecordedStatement } from './record-sql';

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Parallel Aware'?: boolean;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Rows Removed by Filter'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  Plans?: PlanNode[];
}

interface ExplainRoot {
  Plan: PlanNode;
  'Execution Time'?: number;
  'Planning Time'?: number;
}

export interface SeqScanHit {
  table: string;
  /** Строк отдано наружу (суммарно по всем проходам). */
  kept: number;
  /** Строк прочитано и выброшено фильтром (суммарно по всем проходам). */
  removed: number;
  loops: number;
  /**
   * Параллельный скан. У такого узла `loops` — это число воркеров, поделивших
   * между собой ОДИН проход, а не повторные проходы: считать его повтором
   * значило бы ругаться на то, что Postgres распараллелил законное чтение.
   */
  parallel: boolean;
}

export interface StatementPlan {
  sql: string;
  calls: number;
  ms: number;
  blocks: number;
  seqScans: SeqScanHit[];
  /** Чем именно читались таблицы: «Index Only Scan Rating по Rating_date_idx». */
  access: string[];
}

const READ_ONLY = /^\s*(?:SELECT|WITH)\b/i;

function walk(node: PlanNode, visit: (n: PlanNode) => void): void {
  visit(node);
  for (const child of node.Plans ?? []) walk(child, visit);
}

/** Seq Scan-узлы с суммой по проходам: `Actual Rows` в плане — среднее на один проход. */
function collectSeqScans(root: PlanNode): SeqScanHit[] {
  const hits: SeqScanHit[] = [];
  walk(root, (node) => {
    if (node['Node Type'] !== 'Seq Scan') return;
    const loops = node['Actual Loops'] ?? 1;
    hits.push({
      table: node['Relation Name'] ?? '?',
      kept: (node['Actual Rows'] ?? 0) * loops,
      removed: (node['Rows Removed by Filter'] ?? 0) * loops,
      loops,
      parallel: node['Parallel Aware'] === true,
    });
  });
  return hits;
}

/**
 * Пути доступа к таблицам — ради читаемости отчёта-артефакта: по красной джобе
 * должно быть видно, каким индексом (или без индекса) читался запрос, не
 * переснимая EXPLAIN руками.
 */
function collectAccess(root: PlanNode): string[] {
  const seen = new Set<string>();
  walk(root, (node) => {
    const table = node['Relation Name'];
    if (!table) return;
    const index = node['Index Name'];
    seen.add(
      `${node['Node Type']} ${table}${index ? ` по ${index}` : ''}` +
        ` (${node['Actual Rows'] ?? 0}×${node['Actual Loops'] ?? 1})`,
    );
  });
  return [...seen];
}

/**
 * Блоки берём с корня плана: в EXPLAIN счётчики буферов узла включают
 * потомков, поэтому корень — это всё, что тронул запрос, и складывать узлы
 * нельзя (получится кратный пересчёт).
 */
function blocksOf(root: PlanNode): number {
  return (root['Shared Hit Blocks'] ?? 0) + (root['Shared Read Blocks'] ?? 0);
}

/**
 * Записанный запрос + его параметры → план. `null`, если запрос не читающий:
 * EXPLAIN ANALYZE исполняет запрос по-настоящему, и для INSERT/UPDATE это
 * означало бы правку данных замера (гейт на записи — отдельная задача, см.
 * docs/PERF_PLANS.md, «Чего гейт не видит»).
 */
export async function explainStatement(
  client: Client,
  stmt: RecordedStatement & { calls: number },
): Promise<StatementPlan | null> {
  if (!READ_ONLY.test(stmt.sql)) return null;
  const res = await client.query<{ 'QUERY PLAN': ExplainRoot[] }>({
    text: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${stmt.sql}`,
    values: stmt.values,
  });
  const root = res.rows[0]?.['QUERY PLAN']?.[0];
  if (!root) return null;
  return {
    sql: stmt.sql,
    calls: stmt.calls,
    ms: root['Execution Time'] ?? 0,
    blocks: blocksOf(root.Plan),
    seqScans: collectSeqScans(root.Plan),
    access: collectAccess(root.Plan),
  };
}

/** Живые размеры таблиц после ANALYZE — без них «большая таблица» не определить. */
export async function tableRowCounts(
  client: Client,
): Promise<Record<string, number>> {
  const res = await client.query<{ relname: string; n_live_tup: string }>(
    `SELECT relname, n_live_tup FROM pg_stat_user_tables`,
  );
  const out: Record<string, number> = {};
  for (const row of res.rows) out[row.relname] = Number(row.n_live_tup);
  return out;
}
