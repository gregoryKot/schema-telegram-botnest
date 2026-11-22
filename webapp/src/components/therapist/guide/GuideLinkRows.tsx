/** Строка-переход на другой лист справочника: название и строка под ним. */
export interface GuideLink { id: string; name: string; sub?: string }

/** Переходы листа справочника строками: тап открывает лист поверх (схемы потребности, режимы и заметки фазы). */
export function GuideLinkRows({ items, onOpen }: { items: GuideLink[]; onOpen: (id: string) => void }) {
  return (
    <div>
      {items.map((item) => (
        <button
          key={item.id} type="button" className="ds-list-row ds-list-row--hover ds-list-row--nav ds-list-row--inset"
          onClick={() => onOpen(item.id)}
        >
          <span className="ds-list-body">
            <span className="ds-list-title">{item.name}</span>
            {item.sub?.trim() && <span className="ds-list-sub">{item.sub}</span>}
          </span>
          <span className="ds-chev" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
