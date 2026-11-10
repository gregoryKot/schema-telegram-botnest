import { pressable } from '../../utils/a11y';
import { SignArt } from '../../components/art/SignArt';
import { PRACTICE_LOOK, type PracticeEntity } from './practiceLook';
import '../../styles/client-practice.css';

/** Строка «Каталогов»: знак — сущности строки из ENTITY_LOOK («Что питает» — Leaf, «Планы» — Check, «Карта режимов» — Cluster). */
export interface CatalogRow { id: string; look: PracticeEntity; label: string; sub: string; onClick: () => void }
/** «Каталоги» («Что питает», «Планы», «Карта режимов»): без строк раздел не рисуется. */
export function CatalogsBlock({ rows, compact = false }: { rows: CatalogRow[]; compact?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section className="cp-block">
      <div className="ds-head-row"><h3 className="ds-h2">Каталоги</h3></div>
      <div className="cp-tasks">
        {rows.map(item => (
          <div key={item.id} className="ds-card ds-card--row ds-card--nav ds-card--hover cp-task" {...pressable(item.onClick)}>
            <span className="pp-row-art"><SignArt sign={PRACTICE_LOOK[item.look].sign} size="row" /></span>
            <div className="cp-task-body"><div className="cp-task-title">{item.label}</div><div className="ds-sub">{item.sub}</div></div>
            {compact ? <span className="ds-chev" aria-hidden="true" /> : <span className="ds-link">открыть →</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
