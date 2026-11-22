import type { ConcernGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { CONCERN_TITLES } from '../../../../../shared/src/schemaTherapy/guide/address/addressTitlesConcern';
import { concernGuideLook } from '../../../sections/guide/guideReferenceConcerns';
import { GuideSection } from './GuideSection';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { GuidePage } from './GuideSheet';
import { articleAddress } from './marks/guideMarkModel';

/** Разделы листа по порядку: строка — абзацем, список — пунктами; пустой раздел не рисуется. */
const SECTIONS = [
  'goal', 'criteria', 'origins', 'comorbidity', 'differential', 'modeModel', 'inSession',
  'course', 'crisis', 'relationship', 'psychoeducation', 'formats', 'evidence', 'stuck',
] as const satisfies readonly (keyof ConcernGuide)[];

/**
 * Лист статьи вкладки «Запросы и расстройства»: каркас GuidePage, общий с листами режима, схемы и
 * «Для терапевта», — в шапке «Запрос», герой с сутью (`essence`) и знаком статьи на бирюзе вкладки,
 * разделы — через GuideSection с адресом («Про клиента»), «Как это звучит», под «Подробнее» — `more`.
 */
export function ConcernGuideSheet({ concern, onClose }: { concern: ConcernGuide; onClose: () => void }) {
  const at = articleAddress('concern', concern.id);
  return (
    <GuidePage
      label="Запрос" title={concern.name} lede={concern.essence} onClose={onClose}
      look={concernGuideLook(concern.id)} more={concern.more} sources={concern.sources}
    >
      {SECTIONS.map((key) => {
        const value = concern[key];
        const points = Array.isArray(value) ? value.filter((p) => p.trim()) : [];
        if (Array.isArray(value) && points.length === 0) return null;
        return (
          <GuideSection key={key} title={CONCERN_TITLES[key]} text={Array.isArray(value) ? undefined : value} address={at(key)}>
            {points.length > 0 && <GuidePoints items={points} />}
          </GuideSection>
        );
      })}
      <GuideVoice lines={concern.voice} address={at('voice')} />
    </GuidePage>
  );
}
