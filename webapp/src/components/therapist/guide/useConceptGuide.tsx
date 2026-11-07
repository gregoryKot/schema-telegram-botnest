import { useState } from 'react';
import { api } from '../../../api';
import type { BetweenSessionsItem } from '../../../../../shared/src/schemaTherapy/guide';
import type { ConceptGuideActions } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import type { AssignPreset } from '../assignTemplates';
import { guideAssignPreset } from './guideAssign';
import { ConceptGuideSheets, type GuideOpen } from './ConceptGuideSheets';

const CLOSED: GuideOpen = { sheet: null, technique: null };

/**
 * Подсказки терапевту на сайте (#995): колбэки плашки «Обычно в методе»
 * (`actions` → ConceptGraph `guide`) и листы, которые они открывают (`sheets`
 * рисуются после схемы случая — и после её листа «На весь экран», на том же
 * слое). Лист техники из листа режима или схемы ложится поверх него,
 * «Закрыть» у техники возвращает к разделу. «Дать заданием» отдаёт пункт
 * наверх готовым шаблоном листа «Новое задание» (guideAssignPreset) — с
 * режима и со схемы одинаково: лист назначения режим или схему снаружи не
 * принимает; без onAssign кнопки нет. События — concept_guide_*
 * (src/analytics/concept-events.constants.ts), без меты.
 */
export function useConceptGuide(onAssign?: (preset: AssignPreset) => void) {
  const [open, setOpen] = useState<GuideOpen>(CLOSED);
  const actions: ConceptGuideActions = {
    onOpenMode: (id) => {
      api.trackEvent('concept_guide_mode_open');
      setOpen({ sheet: { kind: 'mode', id }, technique: null });
    },
    onOpenSchema: (id) => {
      api.trackEvent('concept_guide_schema_open');
      setOpen({ sheet: { kind: 'schema', id }, technique: null });
    },
    onOpenTechnique: (technique) => {
      api.trackEvent('concept_guide_technique_open');
      setOpen((o) => ({ ...o, technique }));
    },
    onAssign: onAssign && ((item: BetweenSessionsItem) => {
      api.trackEvent('concept_guide_assign');
      onAssign(guideAssignPreset(item));
    }),
  };
  const sheets = (
    <ConceptGuideSheets
      open={open} actions={actions}
      onCloseSheet={() => setOpen(CLOSED)}
      onCloseTechnique={() => setOpen((o) => ({ ...o, technique: null }))}
    />
  );
  return { actions, sheets };
}
