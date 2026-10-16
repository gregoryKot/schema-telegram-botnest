// orderBy/take для findMany фейковой Prisma. Раньше фейк их игнорировал, и e2e
// на срез («take: 100») на фейке не могло краснеть — срез проверялся только на
// живом Postgres. Сравнение устойчивое: строки без поля (фейк не заполняет
// createdAt/updatedAt сам) сохраняют порядок вставки.
type Row = Record<string, any>;
type OrderTerm = Record<string, 'asc' | 'desc'>;

const norm = (v: unknown) => (v instanceof Date ? v.getTime() : v);

function compareBy(terms: OrderTerm[]) {
  return (a: Row, b: Row): number => {
    for (const term of terms) {
      const [key, dir] = Object.entries(term)[0];
      const x = norm(a[key]);
      const y = norm(b[key]);
      if (x == null || y == null || x === y) continue;
      const sign = (x as number | string) < (y as number | string) ? -1 : 1;
      return dir === 'desc' ? -sign : sign;
    }
    return 0;
  };
}

/** findMany фейка: where (предикат движка) → orderBy → take. */
export function selectRows(
  rows: Row[],
  args: { where?: Row; orderBy?: OrderTerm | OrderTerm[]; take?: number },
  matches: (row: Row) => boolean,
): Row[] {
  const { orderBy, take } = args;
  const terms = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  const found = rows.filter(matches);
  const ordered = terms.length ? found.sort(compareBy(terms)) : found;
  return typeof take === 'number' ? ordered.slice(0, take) : ordered;
}
