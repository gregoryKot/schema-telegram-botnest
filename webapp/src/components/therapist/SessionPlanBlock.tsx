import '../../styles/therapist-path.css';
import type { UserId } from '../../api';
import type { PlanItem, PlanStatus } from '../../../../shared/src/therapy/plan/planItem';
import { useTr } from '../../utils/addressForm';
import { Skeleton } from '../Skeleton';
import { PLAN_STATUS_LABEL } from './plan/planModel';
import { useSessionPlan } from './useSessionPlan';

interface Props {
  clientId: UserId;
  selected: number[];
  onChange: (ids: number[]) => void;
  /** Меняется после сохранения записи: статусы пунктов перечитываются. */
  reloadKey?: number;
}

/** «Из плана» в форме итогов (#1522): отметка «работали» по пунктам плана и быстрые «Сделано» / «Отложить». Нет кандидатов — ничего. */
export function SessionPlanBlock({ clientId, selected, onChange, reloadKey }: Props) {
  const tr = useTr();
  const plan = useSessionPlan(clientId, reloadKey);
  if (plan.loading) {
    return (
      <section className="sw-block" aria-hidden>
        <Skeleton width={90} height={11} />
        {[78, 64, 70].map((w) => <Skeleton key={w} width={`${w}%`} height={44} />)}
      </section>
    );
  }
  if (plan.groups.length === 0) return null;
  const flip = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const shown = (item: PlanItem): PlanStatus => plan.statuses[item.id] ?? (selected.includes(item.id) && item.status === 'planned' ? 'active' : item.status);
  const quick = (item: PlanItem, target: 'done' | 'postponed', label: string) => (
    <button
      type="button" className={`ds-chip ds-chip--toggle sw-opt${shown(item) === target ? ' is-on' : ''}`}
      aria-pressed={shown(item) === target} aria-label={`${label}: ${item.text}`}
      disabled={plan.busyId !== null} onClick={() => void plan.toggle(item, target)}
    >{label}</button>
  );
  return (
    <section className="sw-block" aria-label="Из плана">
      <div className="ds-label">Из плана</div>
      <p className="ds-sub">
        {tr(
          'Отметь, над чем из плана работали сегодня — в плане будет видно, сколько раз и когда.',
          'Отметьте, над чем из плана работали сегодня — в плане будет видно, сколько раз и когда.',
        )}
      </p>
      {plan.groups.map((g) => (
        <div key={g.phaseId ?? 'none'} className="spb-group" role="group" aria-label={g.name ?? 'Без фазы'}>
          {plan.hasPath && <div className="tb-meta">{g.name ?? 'Без фазы'}{g.current && ' · сейчас'}</div>}
          {g.items.map((item) => (
            <div key={item.id} className="spb-row">
              <label className="ph-check">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => flip(item.id)} />
                <span>{item.text} <span className="ds-sub spb-st">· {PLAN_STATUS_LABEL[shown(item)]}</span></span>
              </label>
              <div className="spb-acts">{quick(item, 'done', 'Сделано')}{quick(item, 'postponed', 'Отложить')}</div>
            </div>
          ))}
        </div>
      ))}
      {plan.error && <div className="tb-error" role="alert">{plan.error}</div>}
    </section>
  );
}
