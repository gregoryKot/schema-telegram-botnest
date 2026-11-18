import type { BetweenSessionsItem } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import { PLAN_RUBRIC_LABEL } from '../../../../../shared/src/therapy/plan/planItem';
import { GuideSection } from './GuideSection';
import { betweenSeed, type PlanSeed } from './guidePlan';
import { PlanButton } from './PlanButton';

/** «Между сессиями»: название, серым пояснение или инструкция и «давали …», «Дать заданием». */
export function GuideBetweenSessions({ items, onAssign, onPlan, notes }: {
  items: BetweenSessionsItem[]; onAssign?: (item: BetweenSessionsItem) => void; onPlan?: (seed: PlanSeed) => void; notes?: GuideNotes;
}) {
  if (items.length === 0) return null;
  return (
    <GuideSection title={PLAN_RUBRIC_LABEL.between}>
      <ul className="tcp-guide-list">
        {items.map((item, i) => {
          const sub = item.kind === 'task' ? item.note : item.text;
          return (
            <li key={`${i}:${item.title}`} className="tcp-guide-task">
              <div className="gd-min">
                <div className="gd-text gd-text--strong">{item.title}</div>
                {sub && <div className="ds-sub">{sub}</div>}
                <GuideNote text={notes?.task(item)} />
              </div>
              {(onAssign || onPlan) && (
                <div className="gd-acts">
                  {onPlan && <PlanButton label={item.title} onClick={() => onPlan(betweenSeed(item))} />}
                  {onAssign && (
                    <button
                      type="button" className="ds-btn ds-btn--secondary"
                      aria-label={`Дать заданием: ${item.title}`} onClick={() => onAssign(item)}
                    >
                      Дать заданием
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </GuideSection>
  );
}

/** Строка истории: мелко и серым, нечего сказать — ничего. */
function GuideNote({ text }: { text?: string | null }) {
  return text ? <div className="ds-sub">{text}</div> : null;
}
