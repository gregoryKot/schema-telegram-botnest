// Порядок фигур в колонках. Режимы идут группами Критики → Детские → Копинги,
// внутри группы и среди схем фигура встаёт туда, где в среднем стоят её
// партнёры по линиям: так линии пересекаются реже. Без линий — в конец, в
// исходном порядке (домены схем, порядок реестра режимов).
import type {
  ConceptGraphModel,
  GraphModeCard,
  GraphSchemaCard,
} from '../conceptGraphTypes';

/** Среднее положение партнёров; нет партнёров — Infinity (в конец группы). */
function byBarycenter<T>(
  items: T[],
  idOf: (item: T) => string,
  partners: Map<string, string[]>,
  pos: Map<string, number>,
): T[] {
  const bary = (item: T): number => {
    const xs = (partners.get(idOf(item)) ?? [])
      .map((p) => pos.get(p))
      .filter((x): x is number => x !== undefined);
    return xs.length === 0
      ? Infinity
      : xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  return items
    .map((item, i) => ({ item, i, b: bary(item) }))
    .sort((a, b) => (a.b === b.b ? a.i - b.i : a.b - b.b))
    .map((e) => e.item);
}

const indexMap = (ids: string[]) => new Map(ids.map((id, i) => [id, i]));

export interface Ordered {
  /** Режимы без здоровых: критики, дети, копинги. */
  modes: GraphModeCard[];
  schemas: GraphSchemaCard[];
}

export function orderColumns(graph: ConceptGraphModel): Ordered {
  const { critic, child, coping } = graph.lanes;
  const groups = [critic, child, coping];
  const initial = groups.flat();

  // схема → режимы, которые на неё ссылаются (здоровые схем не включают)
  const modesOf = new Map<string, string[]>();
  const schemasOf = new Map<string, string[]>();
  for (const card of initial) {
    schemasOf.set(
      card.modeId,
      card.schemas.map((s) => s.id),
    );
    for (const s of card.schemas) {
      modesOf.set(s.id, [...(modesOf.get(s.id) ?? []), card.modeId]);
    }
  }

  const schemas = byBarycenter(
    graph.schemas,
    (s) => s.id,
    modesOf,
    indexMap(initial.map((c) => c.modeId)),
  );
  const schemaPos = indexMap(schemas.map((s) => s.id));
  const modes = groups.flatMap((g) =>
    byBarycenter(g, (c) => c.modeId, schemasOf, schemaPos),
  );
  return { modes, schemas };
}
