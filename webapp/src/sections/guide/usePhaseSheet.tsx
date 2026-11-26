import { useMemo, useState } from 'react';
import { api } from '../../api';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../shared/src/needs/types';
import { PhaseGuideSheet, type PhaseLinks } from '../../components/therapist/guide/PhaseGuideSheet';
import { phaseView } from './guideReferencePhases';

/**
 * Лист вкладки «Путь терапии»: `open` открывает лист по id (и соседний — из самого листа, на том же месте),
 * `sheet(links)` — открытый лист с переходами на режим, технику и заметку. Рисуется до их листов: открытый из фазы
 * встаёт поверх порядком в DOM.
 */
export type { PhaseLinks };

export function usePhaseSheet(texts: Guide, tr: Tr) {
  const [id, setId] = useState<string | null>(null);
  const phases = useMemo(() => texts.buildPhaseGuides(tr), [texts, tr]);
  const view = useMemo(() => (id ? phaseView(texts, tr, phases, id) : null), [texts, tr, phases, id]);
  const open = (phaseId: string) => {
    api.trackEvent('cabinet_guide_phase_open');
    setId(phaseId);
  };
  const sheet = (links: PhaseLinks) =>
    view && <PhaseGuideSheet view={view} {...links} onOpenPhase={open} onClose={() => setId(null)} />;
  return { open, sheet };
}
