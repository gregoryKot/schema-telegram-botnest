import type { MutableRefObject } from 'react';
import type { TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideUsageGroup } from '../../../../../shared/src/schemaTherapy/guide/backlinks';
import type { SheetBack } from '../ConceptFullscreenSheet';
import { GuideSection } from './GuideSection';
import { techniqueGuideLook } from './guideLook';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { GuidePage } from './GuideSheet';
import { TechniqueMarkRow, type TechniqueMarkProps } from './TechniqueMarkRow';
import { articleAddress } from './marks/guideMarkModel';

/**
 * Лист техники (#995): герой с сутью и знаком техники, «Как это звучит», когда
 * применять, шаги крупными номерами; под «Подробнее» — пункты `more`, когда не
 * делать и доказательность; мелко источники. Каркас — GuidePage, общий с листами
 * режима и схемы: лист техники рисуется позже в DOM и встаёт поверх листа режима.
 * `mark` — лист открыт из схемы случая или журнала техник клиента: под героем
 * «Делали сегодня» и сколько раз делали, за «делали …» — «журнал →»
 * (TechniqueMarkRow); без клиента — нет. `backRef` — goBack листа для «журнал →»
 * (useConceptGuide). `usages` — «Где применяется» под «Подробнее»: режимы, схемы и запросы, которые зовут технику.
 */
export function TechniqueSheet({ technique: t, usages = [], mark, onClose, backRef }: {
  technique: TechniqueGuide; usages?: GuideUsageGroup[]; mark?: TechniqueMarkProps; onClose: () => void;
  backRef?: MutableRefObject<SheetBack | null>;
}) {
  const used = usages.map((g) => ({ lead: g.lead, text: g.items.map((i) => i.name).join(', ') }));
  const at = articleAddress('technique', t.id);
  return (
    <GuidePage
      label={t.approach ? `Из другого подхода · ${t.approach}` : 'Техника'} title={t.name} lede={t.summary} onClose={onClose} backRef={backRef}
      look={techniqueGuideLook(t)}
      more={t.more} sources={t.sources}
      moreParts={[
        { title: 'Когда не делать', text: t.cautions, address: at('cautions') },
        { title: 'Доказательность', text: t.evidence, address: at('evidence') },
        { title: 'Где применяется', address: at('usages'), children: used.length > 0 ? <GuidePoints items={used} /> : undefined },
      ]}
    >
      {mark && <TechniqueMarkRow {...mark} />}
      <GuideVoice lines={t.voice} address={at('voice')} />
      <GuideSection title="Когда" text={t.when} address={at('when')} />
      <GuideSection title="В схема-терапии" text={t.pairsWith} address={at('pairsWith')} />
      {t.steps.length > 0 && (
        <GuideSection title="Как проводить" address={at('steps')}>
          <GuidePoints items={t.steps} ordered />
        </GuideSection>
      )}
    </GuidePage>
  );
}
