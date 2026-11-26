import type { ConcernGuide, TechniqueGuide, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import { CONCERN_TITLES } from '../../../../../shared/src/schemaTherapy/guide/address/addressTitlesConcern';
import { getModeById, getSchemaById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import { concernGuideLook } from '../../../sections/guide/guideReferenceConcerns';
import { GuideRelated } from './GuideRelated';
import { GuideSection } from './GuideSection';
import { GuideTechniques } from './GuideTechniques';
import { modeGuideLook, schemaGuideLook } from './guideLook';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { GuidePage } from './GuideSheet';
import { FoldText } from './GuideText';
import { articleAddress } from './marks/guideMarkModel';

/** Строковые и списочные разделы статьи; режимы, схемы и техники — переходами (ниже). Вкладка — по guideTabsModel. */
type TextKey =
  | 'goal' | 'criteria' | 'origins' | 'comorbidity' | 'differential' | 'modeModel' | 'inSession'
  | 'course' | 'crisis' | 'relationship' | 'psychoeducation' | 'formats' | 'evidence' | 'stuck';
const WHOLE = new Set<string>(['goal', 'inSession']);

/**
 * Лист статьи «Запросы и расстройства» на каркасе GuidePage с вкладками: «Кратко» — цель, реплики, режимная модель и
 * типичные режимы со схемами строками (тап — их лист поверх); «Диагностика»; «На сессии» — техники и работа в кабинете;
 * «Теория». Строка раздела — абзац, свёрнутый до первой фразы (кроме WHOLE), список — пунктами; пустой не рисуется.
 */
export function ConcernGuideSheet({ concern, techniques = [], onOpenMode, onOpenSchema, onOpenTechnique, onClose }: {
  concern: ConcernGuide; techniques?: TechniqueGuide[]; onClose: () => void;
  onOpenMode?: (id: string) => void; onOpenSchema?: (id: string) => void; onOpenTechnique?: (id: TechniqueId) => void;
}) {
  const at = articleAddress('concern', concern.id);
  const part = (key: TextKey) => {
    const value = concern[key];
    const points = Array.isArray(value) ? value.filter((p) => p.trim()) : [];
    const text = typeof value === 'string' && value.trim() ? value : undefined;
    if (points.length === 0 && !text) return null;
    return (
      <GuideSection key={key} title={CONCERN_TITLES[key]} text={WHOLE.has(key) ? text : undefined} address={at(key)}>
        {points.length > 0 ? <GuidePoints items={points} /> : !WHOLE.has(key) && <p className="gd-text"><FoldText text={text!} /></p>}
      </GuideSection>
    );
  };
  const named = (ids: string[] = [], find: (id: string) => { name: string } | undefined) =>
    ids.flatMap((id) => { const x = find(id); return x ? [{ id, name: x.name }] : []; });
  const groups = [
    { title: CONCERN_TITLES.modeIds, address: at('modeIds'), items: named(concern.modeIds, getModeById), look: modeGuideLook, onOpen: onOpenMode },
    { title: CONCERN_TITLES.schemaIds, address: at('schemaIds'), items: named(concern.schemaIds, getSchemaById), look: schemaGuideLook, onOpen: onOpenSchema },
  ];
  return (
    <GuidePage
      label="Запрос" title={concern.name} lede={concern.essence} onClose={onClose}
      look={concernGuideLook(concern.id)} more={concern.more} sources={concern.sources}
      tabs={{ kind: 'concern', articleId: concern.id, panels: {
        brief: <>{part('goal')}<GuideVoice lines={concern.voice} address={at('voice')} />{part('modeModel')}<GuideRelated groups={groups} /></>,
        diagnosis: <>{(['criteria', 'origins', 'comorbidity', 'differential'] as const).map(part)}</>,
        session: (
          <>
            {onOpenTechnique && <GuideTechniques techniques={techniques} address={at('techniques')} onOpen={onOpenTechnique} />}
            {(['inSession', 'relationship', 'crisis', 'psychoeducation', 'formats', 'course'] as const).map(part)}
          </>
        ),
        theory: <>{part('evidence')}{part('stuck')}</>,
      } }}
    />
  );
}
