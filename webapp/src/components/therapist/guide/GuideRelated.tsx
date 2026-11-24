import type { SheetLook } from '../../../../../shared/src/theme/entityLook';
import { GuideSection } from './GuideSection';
import { GuideLinkRows, type GuideLink } from './GuideLinkRows';

/** Группа блока «Связано»: подпись, адрес раздела статьи (нет — адрес у блока), переходы и вид их листов. */
export interface RelatedGroup {
  title: string; address?: string;
  items: GuideLink[];
  look: (id: string) => SheetLook | null;
  /** Тап по строке — лист поверх; нет — названия строкой. */
  onOpen?: (id: string) => void;
}

/**
 * Блок «Связано» листа справочника: соседние листы строками со знаком, по группам «Схемы», «Режимы», «Техники».
 * Группа — свой раздел; адрес — у группы или у всего блока (`address`, «Где применяется» техники). Пустая группа
 * не рисуется, нет ни одной — нет и блока.
 */
export function GuideRelated({ groups, title = 'Связано', address }: { groups: RelatedGroup[]; title?: string; address?: string }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  return (
    <GuideSection title={title} address={address}>
      {shown.map(({ title: lead, address: at, items, look, onOpen }) => (
        <GuideSection key={lead} title={lead} address={at} text={onOpen ? undefined : items.map((i) => i.name).join(', ')}>
          {onOpen && <GuideLinkRows items={items} look={look} onOpen={onOpen} />}
        </GuideSection>
      ))}
    </GuideSection>
  );
}
