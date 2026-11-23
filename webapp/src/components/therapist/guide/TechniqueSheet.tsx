import type { MutableRefObject } from 'react';
import type { TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideUsageGroup } from '../../../../../shared/src/schemaTherapy/guide/backlinks';
import { concernGuideLook } from '../../../sections/guide/guideReferenceConcerns';
import type { SheetBack } from '../ConceptFullscreenSheet';
import { GuideSection } from './GuideSection';
import { modeGuideLook, schemaGuideLook, techniqueGuideLook } from './guideLook';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { GuideRelated } from './GuideRelated';
import { GuidePage } from './GuideSheet';
import { TechniqueMarkRow, type TechniqueMarkProps } from './TechniqueMarkRow';
import { articleAddress } from './marks/guideMarkModel';

const LOOKS = { mode: modeGuideLook, schema: schemaGuideLook, concern: concernGuideLook };

/**
 * Лист техники (#995), вариант A: герой с сутью, «Когда не делать» жёлтой плашкой сразу под ним, «Как это звучит»,
 * когда применять, шаги крупными номерами, «Где применяется» — чипы режимов и схем (тап — их лист вместо этого;
 * запросы — строкой). Под «Подробнее» — `more` и доказательность. `mark` — лист открыт из схемы случая или журнала:
 * «Делали сегодня» и «журнал →» (TechniqueMarkRow); `backRef` — goBack листа для «журнал →» (useConceptGuide).
 */
export function TechniqueSheet({ technique: t, usages = [], mark, onOpenMode, onOpenSchema, onClose, backRef }: {
  technique: TechniqueGuide; usages?: GuideUsageGroup[]; mark?: TechniqueMarkProps; onClose: () => void;
  onOpenMode?: (id: string) => void; onOpenSchema?: (id: string) => void; backRef?: MutableRefObject<SheetBack | null>;
}) {
  const open = { mode: onOpenMode, schema: onOpenSchema, concern: undefined };
  const used = usages.map((g) => ({ title: g.lead, items: g.items, look: LOOKS[g.kind], onOpen: open[g.kind] }));
  const at = articleAddress('technique', t.id);
  return (
    <GuidePage
      label={t.approach ? `Из другого подхода · ${t.approach}` : 'Техника'} title={t.name} lede={t.summary} onClose={onClose} backRef={backRef}
      look={techniqueGuideLook(t)} more={t.more} sources={t.sources}
      moreParts={[{ title: 'Доказательность', text: t.evidence, address: at('evidence') }]}
    >
      {t.cautions?.trim() && <div className="gd-caution"><GuideSection title="Когда не делать" text={t.cautions} address={at('cautions')} /></div>}
      {mark && <TechniqueMarkRow {...mark} />}
      <GuideVoice lines={t.voice} address={at('voice')} />
      <GuideSection title="Когда" text={t.when} address={at('when')} />
      <GuideSection title="В схема-терапии" text={t.pairsWith} address={at('pairsWith')} />
      {t.steps.length > 0 && (
        <GuideSection title="Как проводить" address={at('steps')}>
          <GuidePoints items={t.steps} ordered />
        </GuideSection>
      )}
      <GuideRelated title="Где применяется" address={at('usages')} groups={used} />
    </GuidePage>
  );
}
