import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanItem, PlanRubric } from '../../../../../shared/src/therapy/plan/planItem';
import { useTr } from '../../../utils/addressForm';
import { PaperEmpty } from '../../art/PaperEmpty';
import { PlanItemForm } from './PlanItemForm';
import { groupPlan, isEmptyPlan } from './planModel';
import type { RenderPlanRow } from './planRows';
import type { PlanItems } from './usePlanItems';

interface Props {
  items: PlanItem[];
  plan: PlanItems;
  renderRow: RenderPlanRow;
}

/** Раскладка «По каналам»: пункты по рубрикам справочника, «+ Свой пункт», приглашение у пустого плана. */
export function PlanChannels({ items, plan, renderRow }: Props) {
  const tr = useTr();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [rubric, setRubric] = useState<PlanRubric>('custom');
  const addButton = <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setAdding(true)}>+ Свой пункт</button>;
  return (
    <>
      {groupPlan(items).map((g) => (
        <section key={g.rubric} className="pl-group">
          <h3 className="ds-label">{g.label}</h3>
          <div className="pp-leaf pl-list">
            {g.items.map((item, idx) => renderRow(item, { canUp: idx > 0, canDown: idx < g.items.length - 1 }))}
          </div>
        </section>
      ))}

      {adding ? (
        <div className="pp-leaf pl-add">
          <PlanItemForm
            rubric={rubric} onRubric={setRubric} busy={plan.busyId === 'new'}
            onSave={(text) => plan.add(rubric, text)} onClose={() => setAdding(false)}
          />
        </div>
      ) : isEmptyPlan(items) ? (
        <div>
          <PaperEmpty title="В плане пока пусто">
            {tr(
              'Запиши сюда, что планируешь делать с клиентом: свои пункты или идеи из справочника: у рубрик «Как работать», «На сессии» и «Между сессиями» там есть кнопка «В план».',
              'Запишите сюда, что планируете делать с клиентом: свои пункты или идеи из справочника: у рубрик «Как работать», «На сессии» и «Между сессиями» там есть кнопка «В план».',
            )}
          </PaperEmpty>
          <div className="tb-actions tb-mt16">
            <button type="button" className="ds-btn" onClick={() => navigate('/cabinet/guide')}>Открыть справочник</button>
            {addButton}
          </div>
        </div>
      ) : <div>{addButton}</div>}
    </>
  );
}
