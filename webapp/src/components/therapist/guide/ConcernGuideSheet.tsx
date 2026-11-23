import type { ConcernGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { CONCERN_TITLES } from '../../../../../shared/src/schemaTherapy/guide/address/addressTitlesConcern';
import { concernGuideLook } from '../../../sections/guide/guideReferenceConcerns';
import { GuideSection } from './GuideSection';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { GuidePage } from './GuideSheet';
import { FoldText } from './GuideText';
import { articleAddress } from './marks/guideMarkModel';

/** Разделы по порядку: строка — абзацем, свёрнутым до первой фразы (кроме WHOLE), список — пунктами; пустой не рисуется. */
const SECTIONS = [
  'goal', 'criteria', 'origins', 'comorbidity', 'differential', 'modeModel', 'inSession',
  'course', 'crisis', 'relationship', 'psychoeducation', 'formats', 'evidence', 'stuck',
] as const satisfies readonly (keyof ConcernGuide)[];
const WHOLE = new Set<string>(['goal', 'inSession']);

/** Лист статьи «Запросы и расстройства» на каркасе GuidePage: разделы с адресом («Про клиента»), «Как это звучит», `more`. */
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
        const text = typeof value === 'string' && value.trim() ? value : undefined;
        if (points.length === 0 && !text) return null;
        return (
          <GuideSection key={key} title={CONCERN_TITLES[key]} text={WHOLE.has(key) ? text : undefined} address={at(key)}>
            {points.length > 0 ? <GuidePoints items={points} /> : !WHOLE.has(key) && <p className="gd-text"><FoldText text={text!} /></p>}
          </GuideSection>
        );
      })}
      <GuideVoice lines={concern.voice} address={at('voice')} />
    </GuidePage>
  );
}
