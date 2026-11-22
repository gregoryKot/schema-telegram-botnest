import { needLook } from '../../../../../shared/src/theme/entityLook';
import type { NeedGuideView } from '../../../sections/guide/guideReferenceNeeds';
import { GuideLinkRows } from './GuideLinkRows';
import { GuideSection } from './GuideSection';
import { GuidePage } from './GuideSheet';

/**
 * Лист потребности «Справочника» на каркасе GuidePage: герой — название, описание и знак потребности;
 * «Когда потребность не закрыта» — домен схем и его «общее для домена»; «Схемы» — схемы домена со строкой
 * «какая потребность не закрыта», тап открывает лист схемы поверх. Тексты — из потребностей и листов схем.
 */
export function NeedGuideSheet({ need, onOpenSchema, onClose }: {
  need: NeedGuideView; onOpenSchema: (schemaId: string) => void; onClose: () => void;
}) {
  return (
    <GuidePage label="Потребность" title={need.name} lede={need.desc} look={needLook(need.id)} sources="" onClose={onClose}>
      <GuideSection title="Когда потребность не закрыта">
        <p className="gd-text gd-text--strong">{need.domain.name}</p>
        {need.domain.note.trim() && <p className="gd-text">{need.domain.note}</p>}
      </GuideSection>
      <GuideSection title="Схемы">
        <GuideLinkRows items={need.schemas.map((s) => ({ id: s.id, name: s.name, sub: s.need }))} onOpen={onOpenSchema} />
      </GuideSection>
    </GuidePage>
  );
}
