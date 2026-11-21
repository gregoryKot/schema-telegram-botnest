import { useMemo, useState } from 'react';
import { api } from '../../api';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { NeedId, Tr } from '../../../../shared/src/needs/types';
import { NeedGuideSheet } from '../../components/therapist/guide/NeedGuideSheet';
import { ConcernGuideSheet } from '../../components/therapist/guide/ConcernGuideSheet';
import type { ReferenceItem } from './guideReferenceModel';
import { buildNeedGuides } from './guideReferenceNeeds';

/**
 * Листы «Справочника», которых нет в схеме случая: потребность и статья «Запросов». `open` открывает лист строки
 * своего вида и отвечает true; чужую строку не трогает. `under(onOpenSchema)` — лист потребности до листов схемы:
 * лист схемы, открытый из него, встаёт поверх порядком в DOM; `over` — статья, в слот `over` useConceptGuide
 * (внутри контекста отметок «Про клиента», как лист «Для терапевта»).
 */
export function useListSheets(texts: Guide, tr: Tr) {
  const [needId, setNeedId] = useState<NeedId | null>(null);
  const [concernId, setConcernId] = useState<string | null>(null);
  const need = useMemo(() => (needId ? buildNeedGuides(texts, tr).find((n) => n.id === needId) : undefined), [texts, tr, needId]);
  const concern = concernId ? texts.buildConcernGuides(tr).find((c) => c.id === concernId) : undefined;
  const open = (item: ReferenceItem): boolean => {
    if (item.kind === 'need') {
      api.trackEvent('cabinet_guide_need_open');
      setNeedId(item.id);
    } else if (item.kind === 'concern') {
      api.trackEvent('cabinet_guide_concern_open');
      setConcernId(item.id);
    } else return false;
    return true;
  };
  const under = (onOpenSchema: (id: string) => void) =>
    need && <NeedGuideSheet need={need} onOpenSchema={onOpenSchema} onClose={() => setNeedId(null)} />;
  const over = concern && <ConcernGuideSheet concern={concern} onClose={() => setConcernId(null)} />;
  return { open, under, over };
}
