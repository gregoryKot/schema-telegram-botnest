import { tableLabel } from '../../utils/mergeLabels';

// Список «таблица — сколько записей» для экранов привязки и объединения.
export function ServiceRows({ summary }: { summary: Record<string, number> }) {
  return (
    <div className="as-rows">
      {Object.entries(summary).map(([table, n]) => (
        <div key={table} className="as-row">
          <span>{tableLabel(table)}</span>
          <span className="as-row-n">{n}</span>
        </div>
      ))}
    </div>
  );
}
