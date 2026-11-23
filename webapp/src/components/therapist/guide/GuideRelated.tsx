import type { CSSProperties } from 'react';
import type { SheetLook } from '../../../../../shared/src/theme/entityLook';
import { GuideSection } from './GuideSection';
import type { GuideLink } from './GuideLinkRows';

/** Группа блока «Связано»: подпись, адрес раздела статьи, переходы и вид листа, куда ведёт переход (цвет точки). */
export interface RelatedGroup {
  title: string; address: string; items: GuideLink[];
  look: (id: string) => SheetLook | null;
  /** Тап по чипу — лист поверх; нет — названия строкой. */
  onOpen?: (id: string) => void;
}

/**
 * Блок «Связано» листа справочника: переходы на соседние листы чипами с цветом группы или домена. Каждая группа —
 * свой раздел с адресом («Про клиента» как раньше); пустая не рисуется, нет ни одной — нет и блока.
 */
export function GuideRelated({ groups }: { groups: RelatedGroup[] }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  return (
    <GuideSection title="Связано">
      {shown.map(({ title, address, items, look, onOpen }) => (
        <GuideSection key={title} title={title} address={address} text={onOpen ? undefined : items.map((i) => i.name).join(', ')}>
          {onOpen && (
            <div className="gd-rel">
              {items.map((item) => {
                const hue = look(item.id)?.hue;
                return (
                  <button
                    key={item.id} type="button" className="ds-chip ds-chip--toggle gd-rel-chip"
                    style={hue === undefined ? undefined : { '--h': hue } as CSSProperties}
                    onClick={(e) => { e.stopPropagation(); onOpen(item.id); }}
                  >
                    <span className="gd-rel-dot" aria-hidden="true" />{item.name}
                  </button>
                );
              })}
            </div>
          )}
        </GuideSection>
      ))}
    </GuideSection>
  );
}
