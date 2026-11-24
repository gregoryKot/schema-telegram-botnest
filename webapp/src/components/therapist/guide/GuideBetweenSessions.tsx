import type { BetweenSessionsItem } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import { PLAN_RUBRIC_LABEL } from '../../../../../shared/src/therapy/plan/planItem';
import { GuideCard } from './GuideCard';
import { GuideSection } from './GuideSection';
import { betweenSeed, type PlanSeed } from './guidePlan';
import { PlanButton } from './PlanButton';

/** «Между сессиями»: карточки заданий — название, первая фраза пояснения (тап — целиком), «давали …», «Дать заданием». */
export function GuideBetweenSessions({ items, address, onAssign, onPlan, notes }: {
  items: BetweenSessionsItem[]; address?: string; onAssign?: (item: BetweenSessionsItem) => void; onPlan?: (seed: PlanSeed) => void; notes?: GuideNotes;
}) {
  if (items.length === 0) return null;
  return (
    <GuideSection title={PLAN_RUBRIC_LABEL.between} address={address}>
      <ul className="gd-cards">
        {items.map((item, i) => {
          const plan = onPlan && <PlanButton label={item.title} onClick={() => onPlan(betweenSeed(item))} />;
          const history = notes?.task(item);
          return (
            <GuideCard
              key={`${i}:${item.title}`} title={item.title} text={item.kind === 'task' ? item.note : item.text}
              // одно тихое «+ В план» стоит в строке названия; с «Дать заданием» действия — рядом под текстом
              action={!onAssign && plan}
              footer={(history || onAssign) && (
                <>
                  {history && <div className="ds-sub">{history}</div>}
                  {onAssign && (
                    <div className="gd-acts">
                      <button type="button" className="ds-btn ds-btn--secondary" aria-label={`Дать заданием: ${item.title}`} onClick={() => onAssign(item)}>
                        Дать заданием
                      </button>
                      {plan}
                    </div>
                  )}
                </>
              )}
            />
          );
        })}
      </ul>
    </GuideSection>
  );
}
