import type { CSSProperties } from 'react';
import type { SheetLook } from '../../../../../shared/src/theme/entityLook';
import { GuideSection } from './GuideSection';
import type { GuideLink } from './GuideLinkRows';

/** Чипы-переходы: тап открывает лист поверх; точка — оттенок листа, куда ведёт чип. */
export interface RelatedChipsProps {
  items: GuideLink[];
  look: (id: string) => SheetLook | null;
  onOpen: (id: string) => void;
}

/** Группа блока «Связано»: подпись, адрес раздела статьи (нет — адрес у блока), переходы и вид их листов. */
export interface RelatedGroup extends Omit<RelatedChipsProps, 'onOpen'> {
  title: string; address?: string;
  /** Тап по чипу — лист поверх; нет — названия строкой. */
  onOpen?: (id: string) => void;
}

export function RelatedChips({ items, look, onOpen }: RelatedChipsProps) {
  return (
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
  );
}

/**
 * Блок «Связано» листа справочника: переходы на соседние листы чипами с цветом группы или домена. Группа — свой
 * раздел; адрес — у группы или у всего блока (`address`, «Где применяется» техники). Пустая группа не рисуется,
 * нет ни одной — нет и блока.
 */
export function GuideRelated({ groups, title = 'Связано', address }: { groups: RelatedGroup[]; title?: string; address?: string }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  return (
    <GuideSection title={title} address={address}>
      {shown.map(({ title: lead, address: at, items, look, onOpen }) => (
        <GuideSection key={lead} title={lead} address={at} text={onOpen ? undefined : items.map((i) => i.name).join(', ')}>
          {onOpen && <RelatedChips items={items} look={look} onOpen={onOpen} />}
        </GuideSection>
      ))}
    </GuideSection>
  );
}
