import type { TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { GuideSignArt } from '../../art/GuideSigns';
import { TECHNIQUE_SIGN } from '../../art/guideSignsModel';
import { GuideSection } from './GuideSection';
import { GuidePage, GuidePoints, GuideVoice } from './GuideSheet';
import { TechniqueMarkRow, type TechniqueMarkProps } from './TechniqueMarkRow';

/**
 * Лист техники (#995): герой с сутью и знаком техники, «Как это звучит», когда
 * применять, шаги крупными номерами; под «Подробнее» — пункты `more`, когда не
 * делать и доказательность; мелко источники. Каркас — GuidePage, общий с листами
 * режима и схемы: лист техники рисуется позже в DOM и встаёт поверх листа режима.
 * `mark` — лист открыт из схемы случая клиента: под героем «Делали сегодня» и
 * сколько раз делали (TechniqueMarkRow); без клиента — нет.
 */
export function TechniqueSheet({ technique: t, mark, onClose }: {
  technique: TechniqueGuide; mark?: TechniqueMarkProps; onClose: () => void;
}) {
  return (
    <GuidePage
      label="Техника" title={t.name} lede={t.summary} onClose={onClose}
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
