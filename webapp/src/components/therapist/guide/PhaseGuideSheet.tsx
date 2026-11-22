import type { TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import { PHASE_TITLES } from '../../../../../shared/src/schemaTherapy/guide/address/addressTitlesPhase';
import { PHASE_LOOK, phaseLabel, type PhaseView } from '../../../sections/guide/guideReferencePhases';
import { GuideLinkRows } from './GuideLinkRows';
import { GuideSection } from './GuideSection';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { GuidePage, GuideTechniques } from './GuideSheet';
import { articleAddress } from './marks/guideMarkModel';

/** Переходы с листа фазы: открыть лист режима, техники, заметки «Для терапевта» или соседний лист пути. */
export interface PhaseLinks {
  onOpenMode: (id: string) => void;
  onOpenTechnique: (id: TechniqueId) => void;
  onOpenNote: (id: string) => void;
}

const BEFORE = ['goal', 'timing', 'tasks', 'stages', 'stance'] as const;
const AFTER = ['transition', 'mistakes', 'variants', 'stuck'] as const;

/**
 * Лист вкладки «Путь терапии»: каркас GuidePage — в шапке «Фаза N» (у обзора — «Путь терапии»), герой с тем, что в фазе
 * происходит; разделы — через GuideSection с адресом («Про клиента»). Режимы, техники и заметки — переходы: их лист
 * встаёт поверх, «Назад» возвращает к фазе. Внизу — соседние листы пути. Пустой раздел не рисуется.
 */
export function PhaseGuideSheet({ view, onOpenMode, onOpenTechnique, onOpenNote, onOpenPhase, onClose }: PhaseLinks & {
  view: PhaseView; onOpenPhase: (id: string) => void; onClose: () => void;
}) {
  const { phase, modes, techniques, notes, prev, next } = view;
  const at = articleAddress('phase', phase.id);
  const part = (key: (typeof BEFORE)[number] | (typeof AFTER)[number]) => {
    const value = phase[key];
    const points = Array.isArray(value) ? value.filter((p) => p.trim()) : undefined;
    if (points?.length === 0) return null;
    return (
      <GuideSection key={key} title={PHASE_TITLES[key]} text={Array.isArray(value) ? undefined : value} address={at(key)}>
        {points && <GuidePoints items={points} />}
      </GuideSection>
    );
  };
  const around = [
    ...(prev ? [{ id: prev.id, name: `Раньше: ${prev.name}` }] : []),
    ...(next ? [{ id: next.id, name: `Дальше: ${next.name}` }] : []),
  ];
  return (
    <GuidePage
      label={phaseLabel(view.step, phase.group)} title={phase.name} lede={phase.essence} onClose={onClose}
      look={PHASE_LOOK} more={phase.more} sources={phase.sources}
    >
      {BEFORE.map(part)}
      {modes.length > 0 && (
        <GuideSection title={PHASE_TITLES.modeIds} address={at('modeIds')}>
          <GuideLinkRows items={modes} onOpen={onOpenMode} />
        </GuideSection>
      )}
      <GuideTechniques title={PHASE_TITLES.techniques} techniques={techniques} address={at('techniques')} onOpen={onOpenTechnique} />
      {notes.length > 0 && (
        <GuideSection title={PHASE_TITLES.noteIds} address={at('noteIds')}>
          <GuideLinkRows items={notes} onOpen={onOpenNote} />
        </GuideSection>
      )}
      {AFTER.map(part)}
      <GuideVoice lines={phase.voice} address={at('voice')} />
      <GuideLinkRows items={around} onOpen={onOpenPhase} />
    </GuidePage>
  );
}
