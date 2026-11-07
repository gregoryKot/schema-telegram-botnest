import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';

const columnStyle = { display: 'flex', flexDirection: 'column' } as const;

/**
 * Список «Справочника»: подпись группы (группа режимов, домен схем, раздел в
 * поиске) и карточка строк-переходов — тот же ds-list-row, что у списков
 * кабинета. Тап по строке открывает её лист.
 */
export function GuideReferenceList({ groups, onOpen }: {
  groups: ReferenceGroup[];
  onOpen: (item: ReferenceItem) => void;
}) {
  return (
    <div style={{ ...columnStyle, gap: 'var(--space-20)' }}>
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title} style={{ ...columnStyle, gap: 'var(--space-8)' }}>
          {g.title && <h2 className="ds-label" style={{ margin: 0 }}>{g.title}</h2>}
          <div className="ds-card ds-card--flush">
            {g.items.map((item) => (
              <button
                key={`${item.kind}:${item.id}`} type="button"
                className="ds-list-row ds-list-row--nav ds-list-row--hover" onClick={() => onOpen(item)}
              >
                <span className="ds-list-body">
                  <span className="ds-list-title">{item.name}</span>
                  {item.sub && <span className="ds-list-sub">{item.sub}</span>}
                </span>
                <span className="ds-chev" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
