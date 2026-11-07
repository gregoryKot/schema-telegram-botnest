import type { ReactNode } from 'react';
import type { ConceptTechniqueMark } from '../../apiTypes';
import type {
  ConceptGuideActions,
  GuideFrom,
  GuideHintView,
} from './conceptGuide';
import { guideNotes } from './guideHistory';
import { MethodHint } from './MethodHint';
import {
  HintBetweenSessions,
  HintTechniques,
  wordBtn,
} from './ConceptGuideHintSections';

// «Подробнее…» ведёт в лист своего раздела.
const MORE: Record<
  GuideFrom['kind'],
  { label: string; open: (a: ConceptGuideActions, id: string) => void }
> = {
  mode: { label: 'Подробнее о режиме', open: (a, id) => a.onOpenMode(id) },
  schema: { label: 'Подробнее о схеме', open: (a, id) => a.onOpenSchema(id) },
};

/**
 * Плашка «Обычно в методе» для режима или схемы со своим разделом (#995):
 * цель, техники «На сессии», задания «Между сессиями» и «Подробнее…». `from`
 * — чей раздел: колбэки получают его, «Подробнее» ведёт в лист режима или
 * схемы. `take` — «Взять за основу» (её показывает ConceptStrategy, пока
 * поле пустое; у схемы своего поля нет). Без `actions` техники и задания —
 * только текст, без кнопок. История серым: «давали …» — по `actions.tasks`,
 * «делали …» — по `marks`, отметкам связи этого режима или схемы.
 */
export function ConceptGuideHint({
  view,
  from,
  actions,
  take,
  marks,
}: {
  view: GuideHintView;
  from: GuideFrom;
  actions?: ConceptGuideActions;
  take?: ReactNode;
  marks?: ConceptTechniqueMark[];
}) {
  const { guide, techniques } = view;
  const more = MORE[from.kind];
  const notes = guideNotes(from, actions?.tasks, marks);
  return (
    <MethodHint text={guide.goal} take={take}>
      <HintTechniques
        techniques={techniques}
        from={from}
        actions={actions}
        notes={notes}
      />
      <HintBetweenSessions
        items={guide.betweenSessions}
        from={from}
        assign={actions?.onAssign}
        notes={notes}
      />
      {actions && (
        <button
          type="button"
          style={{ ...wordBtn, margin: 0, fontSize: 13, fontWeight: 600 }}
          onClick={() => more.open(actions, from.id)}
        >
          {more.label}
        </button>
      )}
    </MethodHint>
  );
}
