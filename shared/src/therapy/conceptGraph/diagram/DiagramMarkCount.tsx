import type { DiagramNode } from './diagramTypes';

/** Ключ статьи справочника у узла — как начало адреса отметки (`schema:<id>`, `mode:<id>`). */
export function nodeArticleKey(n: DiagramNode): string | null {
  if (n.kind === 'mode' && n.modeId) return `mode:${n.modeId}`;
  if (n.kind === 'schema' && n.schemaId) return `schema:${n.schemaId}`;
  return null;
}

/** Счётчик отметок «Про клиента» в углу узла (#1484); на картинке схемы его нет. */
export function DiagramMarkCount({
  node,
  count,
}: {
  node: DiagramNode;
  count: number;
}) {
  return (
    <span
      data-export-skip
      className="cg-mark-count"
      title={`Из справочника: ${count}`}
      aria-label={`Из справочника: ${count}`}
      style={{
        position: 'absolute',
        left: node.x + node.w - 10,
        top: node.y - 8,
      }}
    >
      {count}
    </span>
  );
}
