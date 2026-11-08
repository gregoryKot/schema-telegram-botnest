import { ExternalLink } from '../../host/ExternalLink';
import type { Row } from './useMoreRows';

const ROW_CLASS = 'ds-list-row ds-list-row--nav ds-list-row--hover';
const rowClass = (r: Row) => r.phoneOnly ? `${ROW_CLASS} cm-phone-only` : ROW_CLASS;
/** Счётчик новых у заголовка строки: число видно глазом, «новых: N» — скринридеру. */
function NewBadge({ n }: { n: number }) {
  return <span className="new-badge" aria-label={`новых: ${n}`}>{n}</span>;
}
function RowBody({ row }: { row: Row }) {
  return (
    <>
      {row.art && <span className="pp-row-art">{row.art}</span>}<span className="ds-list-body"><span className="ds-list-title">{row.title}{!!row.badge && <NewBadge n={row.badge} />}</span><span className="ds-list-sub">{row.sub}</span></span>
      <span className="ds-chev" aria-hidden="true" />
    </>
  );
}

/** Список строк «Ещё»: ссылка наружу (href) или кнопка; картинка слева по таблице мотивов. */
export function MoreRows({ rows }: { rows: Row[] }) {
  return (
    <div className="ds-card ds-card--flush">
      {rows.map(r => r.href ? (
        <ExternalLink key={r.id} className={rowClass(r)} href={r.href} onClick={r.onClick}>
          <RowBody row={r} />
        </ExternalLink>
      ) : (
        <button key={r.id} type="button" className={rowClass(r)} onClick={r.onClick}>
          <RowBody row={r} />
        </button>
      ))}
    </div>
  );
}
