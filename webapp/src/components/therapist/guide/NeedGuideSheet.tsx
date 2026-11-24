import { NEED_TITLES } from '../../../../../shared/src/schemaTherapy/guide/address/addressTitlesNeed';
import { needLook } from '../../../../../shared/src/theme/entityLook';
import type { NeedGuideView } from '../../../sections/guide/guideReferenceNeeds';
import { GuideLinkRows } from './GuideLinkRows';
import { schemaGuideLook } from './guideLook';
import { GuideSection } from './GuideSection';
import { GuidePage } from './GuideSheet';
import { articleAddress } from './marks/guideMarkModel';

/**
 * Лист потребности «Справочника» на каркасе GuidePage: герой — название, суть для терапевта и знак потребности; «Фрустрация
 * в детстве»; «Схемы домена» — текст и схемы строками со знаком (тап — лист схемы поверх); «Ограниченное родительство»; «Общее для домена».
 */
export function NeedGuideSheet({ need, onOpenSchema, onClose }: {
  need: NeedGuideView; onOpenSchema: (schemaId: string) => void; onClose: () => void;
}) {
  const at = articleAddress('need', need.id);
  const { guide } = need;
  return (
    <GuidePage label="Потребность" title={need.name} lede={guide?.essence ?? ''} look={needLook(need.id)} sources={guide?.sources ?? ''} onClose={onClose}>
      <GuideSection title={NEED_TITLES.frustration} text={guide?.frustration} address={at('frustration')} />
      <GuideSection title={NEED_TITLES.schemas} text={guide?.schemas} address={at('schemas')}>
        {!guide && <p className="gd-text gd-text--strong">{need.domain.name}</p>}
        <GuideLinkRows items={need.schemas} look={schemaGuideLook} onOpen={onOpenSchema} />
      </GuideSection>
      <GuideSection title={NEED_TITLES.care} text={guide?.care} address={at('care')} />
      <GuideSection title={NEED_TITLES.domainNote} text={need.domain.note} address={at('domainNote')} />
    </GuidePage>
  );
}
