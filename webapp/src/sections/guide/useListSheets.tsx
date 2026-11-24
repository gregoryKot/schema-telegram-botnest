import { useMemo, useState } from 'react';
import { api } from '../../api';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { NeedId, Tr } from '../../../../shared/src/needs/types';
import { NeedGuideSheet } from '../../components/therapist/guide/NeedGuideSheet';
import { ConcernGuideSheet } from '../../components/therapist/guide/ConcernGuideSheet';
import type { ReferenceItem } from './guideReferenceModel';
import { buildNeedGuides } from './guideReferenceNeeds';
import { usePhaseSheet, type PhaseLinks } from './usePhaseSheet';

/**
 * Листы «Справочника», которых нет в схеме случая: потребность, статья «Запросов» и фаза «Пути терапии». `open` открывает
 * лист строки своего вида и отвечает true; чужую строку не трогает. `under(links)` — листы потребности, запроса и фазы
 * до листов схемы, режима и техники: открытый из них лист встаёт поверх порядком в DOM.
 */
export function useListSheets(texts: Guide, tr: Tr) {
  const [needId, setNeedId] = useState<NeedId | null>(null);
  const [concernId, setConcernId] = useState<string | null>(null);
  const need = useMemo(() => (needId ? buildNeedGuides(texts, tr).find((n) => n.id === needId) : undefined), [texts, tr, needId]);
  const phase = usePhaseSheet(texts, tr);
  const concern = concernId ? texts.buildConcernGuides(tr).find((c) => c.id === concernId) : undefined;
  const open = (item: ReferenceItem): boolean => {
    if (item.kind === 'need') {
      api.trackEvent('cabinet_guide_need_open');
      setNeedId(item.id);
    } else if (item.kind === 'concern') {
      api.trackEvent('cabinet_guide_concern_open');
      setConcernId(item.id);
    } else if (item.kind === 'phase') phase.open(item.id);
    else return false;
    return true;
  };
  const techniques = useMemo(
    () => (concern?.techniques ?? []).flatMap((id) => texts.techniqueGuide(tr, id) ?? []),
    [texts, tr, concern],
  );
  const under = (links: PhaseLinks & { onOpenSchema: (id: string) => void }) => (
    <>
      {need && <NeedGuideSheet need={need} onOpenSchema={links.onOpenSchema} onClose={() => setNeedId(null)} />}
      {concern && (
        <ConcernGuideSheet
          concern={concern} techniques={techniques} onOpenMode={links.onOpenMode} onOpenSchema={links.onOpenSchema}
          onOpenTechnique={links.onOpenTechnique} onClose={() => setConcernId(null)}
        />
      )}
      {phase.sheet(links)}
    </>
  );
  return { open, under };
}
