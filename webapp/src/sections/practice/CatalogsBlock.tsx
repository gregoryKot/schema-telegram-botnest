import { pressable } from '../../utils/a11y';
import '../../styles/client-practice.css';

export interface CatalogRow { id: string; label: string; sub: string; onClick: () => void }

/** «Каталоги» («Практики», «Планы»): без строк (оба пункта скрыты в «Инструментах») раздел не рисуется. */
export function CatalogsBlock({ rows }: { rows: CatalogRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="cp-block">
      <div className="ds-head-row"><h3 className="ds-h2">Каталоги</h3></div>
      <div className="cp-tasks">
        {rows.map(item => (
          <div key={item.id} className="ds-card ds-card--row ds-card--hover cp-task" {...pressable(item.onClick)}>
            <div className="cp-task-body">
              <div className="cp-task-title">{item.label}</div>
              <div className="ds-sub">{item.sub}</div>
            </div>
            <span className="ds-link">открыть →</span>
          </div>
        ))}
      </div>
    </section>
  );
}
