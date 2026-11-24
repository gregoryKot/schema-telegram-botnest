import type { SheetLook } from '../../../../../shared/src/theme/entityLook';
import { SignArt } from '../../art/SignArt';

/** Строка-переход на другой лист справочника: название и строка под ним. */
export interface GuideLink { id: string; name: string; sub?: string }

/**
 * Переходы листа справочника строками списка, как в самом «Справочнике»: знак листа слева (`look`; без знака — без
 * картинки), название, строка под ним и шеврон. Тап открывает лист поверх (связанные листы, режимы и заметки фазы).
 */
export function GuideLinkRows({ items, onOpen, look }: { items: GuideLink[]; onOpen: (id: string) => void; look?: (id: string) => SheetLook | null }) {
  return (
    <div className="gd-rows">
      {items.map((item) => {
        const sign = look?.(item.id)?.sign;
        return (
          <button
            key={item.id} type="button" className="ds-list-row ds-list-row--hover ds-list-row--nav gd-row"
            onClick={(e) => { e.stopPropagation(); onOpen(item.id); }}
          >
            {sign && <span className="pp-row-art"><SignArt sign={sign} size="row" /></span>}
            <span className="ds-list-body">
              <span className="ds-list-title">{item.name}</span>
              {item.sub?.trim() && <span className="ds-list-sub">{item.sub}</span>}
            </span>
            <span className="ds-chev" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
