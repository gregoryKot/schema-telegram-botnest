import { useMemo, useState } from 'react';
import '../../../../styles/therapist-path.css';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import { phaseDraftsFromTemplate } from '../../../../../../shared/src/therapy/path/pathPlan';
import { buildPathTemplates } from '../../../../../../shared/src/therapy/path/templates';
import { useTr } from '../../../../utils/addressForm';
import { Skeleton } from '../../../Skeleton';
import type { RenderPlanRow } from '../planRows';
import { PathCreateSheet } from './PathCreateSheet';
import { PathEmpty } from './PathEmpty';
import type { PlanItems } from '../usePlanItems';
import { PathTimeline } from './PathTimeline';
import type { PathState } from './usePath';

interface Props {
  path: PathState;
  plan: PlanItems;
  items: PlanItem[];
  renderRow: RenderPlanRow;
}

/** Силуэт ленты: три фазы «номер — название — срок». */
function PathSkeleton() {
  return (
    <div className="ph-track" aria-hidden>
      {[62, 48, 55].map((w) => (
        <div key={w} className="pp-leaf ph-card">
          <div className="ph-head">
            <Skeleton width={30} height={30} radius={15} />
            <div className="ph-title"><Skeleton width={`${w}%`} height={16} /><Skeleton width="40%" height={12} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Раскладка «По фазам» (#1522): лента фаз пути; пути нет — объяснение и «Собрать путь». */
export function PathLayout({ path, plan, items, renderRow }: Props) {
  const tr = useTr();
  const templates = useMemo(() => buildPathTemplates(tr), [tr]);
  const [creating, setCreating] = useState(false);

  let content;
  if (path.failed) {
    content = (
      <div className="pl-fail" role="alert">
        <span className="tb-error">Путь не загрузился.</span>
        <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={path.reload}>Повторить</button>
      </div>
    );
  } else if (path.path === undefined) content = <PathSkeleton />;
  else if (path.path === null) content = <PathEmpty onCreate={() => { path.clearError(); setCreating(true); }} />;
  else content = <PathTimeline path={path} plan={plan} current={path.path} items={items} templates={templates} renderRow={renderRow} />;

  return (
    <div className="ph-wrap">
      {content}
      {path.error && !creating && <div className="tb-error" role="alert">{path.error}</div>}
      {creating && (
        <PathCreateSheet
          templates={templates} busy={path.busy} error={path.error}
          onCreate={(startDate, t) => path.create(startDate, t?.id ?? null, t ? phaseDraftsFromTemplate(t) : [])}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
