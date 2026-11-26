import { ExternalLink } from '../../host/ExternalLink';
import type { Row } from './useMoreRows';
import { groupMoreRows } from './moreGroups';

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

/** Строки «Ещё» группами с короткими заголовками (moreGroups.ts). */
export function MoreRows({ rows }: { rows: Row[] }) {
  return (
    <>
      {groupMoreRows(rows).map(g => (
        <section key={g.id} className={g.phoneOnly ? 'cm-group cm-phone-only' : 'cm-group'} aria-labelledby={`cm-group-${g.id}`}>
          <h2 className="ds-eyebrow cm-group-head" id={`cm-group-${g.id}`}>{g.title}</h2>
          <RowList rows={g.rows} />
        </section>
      ))}
    </>
  );
}

/** Список строк: ссылка наружу (href) или кнопка; картинка слева по таблице мотивов. */
function RowList({ rows }: { rows: Row[] }) {
  return (
    <div className="ds-rows">
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
