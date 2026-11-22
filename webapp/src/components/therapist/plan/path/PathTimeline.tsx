import { useState } from 'react';
import { todayStr } from '../../../../../../shared/src/utils/format';
import type { TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import type { PathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import type { RenderPlanRow } from '../planRows';
import { PathPhaseCard } from './PathPhaseCard';
import { buildPathView, toggleCriterion, type PhaseRow } from './pathView';
import type { PathState } from './usePath';

interface Props {
  path: PathState;
  current: TherapyPath;
  items: PlanItem[];
  templates: PathTemplate[];
  renderRow: RenderPlanRow;
}

/** Лента фаз и группа «Без фазы». Раскрытая на телефоне — выбранная руками, до выбора — из модели. */
export function PathTimeline({ path, current, items, templates, renderRow }: Props) {
  const view = buildPathView(current, items, templates);
  const [picked, setPicked] = useState<number | null>(null);
  const openId = picked ?? view.rows[view.openIndex]?.phase.id ?? null;

  const act = (row: PhaseRow) => {
    // переход — днём терапевта: он отмечает, когда фаза началась на деле
    const today = todayStr();
    if (row.action === 'advance') void path.advance(row.phase.id, today);
    else if (row.action === 'start') void path.patchPhase(row.phase.id, { startedAt: today }, 'Не удалось начать фазу');
    else if (row.action === 'finish') void path.patchPhase(row.phase.id, { endedAt: today }, 'Не удалось завершить фазу');
  };

  return (
    <>
      <div className="ph-track">
        {view.rows.length === 0 && <p className="ds-sub">В пути пока нет фаз.</p>}
        {view.rows.map((row) => (
          <PathPhaseCard
            key={row.phase.id} row={row} busy={path.busy} renderRow={renderRow}
            open={openId === row.phase.id}
            onToggle={() => setPicked(openId === row.phase.id ? -1 : row.phase.id)}
            onCriterion={(n) => void path.patchPhase(row.phase.id, { criteriaDone: toggleCriterion(row.phase.criteriaDone, n) }, 'Не удалось отметить критерий')}
            onAction={() => act(row)}
          />
        ))}
      </div>
      {view.unphased.length > 0 && (
        <section className="ph-unphased">
          <h3 className="ds-label">Без фазы</h3>
          <div className="pp-leaf pl-list">{view.unphased.map((item) => renderRow(item))}</div>
        </section>
      )}
    </>
  );
}
