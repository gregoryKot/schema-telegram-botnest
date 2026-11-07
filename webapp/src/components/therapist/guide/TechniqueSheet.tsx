import type { MutableRefObject } from 'react';
import type { TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { GuideSignArt } from '../../art/GuideSigns';
import { TECHNIQUE_SIGN } from '../../art/guideSignsModel';
import type { SheetBack } from '../ConceptFullscreenSheet';
import { GuideSection } from './GuideSection';
import { GuidePage, GuidePoints, GuideVoice } from './GuideSheet';
import { TechniqueMarkRow, type TechniqueMarkProps } from './TechniqueMarkRow';

/**
 * Лист техники (#995): герой с сутью и знаком техники, «Как это звучит», когда
 * применять, шаги крупными номерами; под «Подробнее» — пункты `more`, когда не
 * делать и доказательность; мелко источники. Каркас — GuidePage, общий с листами
 * режима и схемы: лист техники рисуется позже в DOM и встаёт поверх листа режима.
 * `mark` — лист открыт из схемы случая или журнала техник клиента: под героем
 * «Делали сегодня» и сколько раз делали, за «делали …» — «журнал →»
 * (TechniqueMarkRow); без клиента — нет. `backRef` — goBack листа для «журнал →»
 * (useConceptGuide).
 */
export function TechniqueSheet({ technique: t, mark, onClose, backRef }: {
  technique: TechniqueGuide; mark?: TechniqueMarkProps; onClose: () => void; backRef?: MutableRefObject<SheetBack | null>;
}) {
  return (
    <GuidePage
      label="Техника" title={t.name} lede={t.summary} onClose={onClose} backRef={backRef}
      art={<GuideSignArt sign={TECHNIQUE_SIGN[t.id]} size="hero" />}
      more={t.more} sources={t.sources}
      moreParts={[{ title: 'Когда не делать', text: t.cautions }, { title: 'Доказательность', text: t.evidence }]}
    >
      {mark && <TechniqueMarkRow {...mark} />}
      <GuideVoice lines={t.voice} />
      <GuideSection title="Когда" text={t.when} />
      {t.steps.length > 0 && (
        <GuideSection title="Как проводить">
          <GuidePoints items={t.steps} ordered />
        </GuideSection>
      )}
    </GuidePage>
  );
}
