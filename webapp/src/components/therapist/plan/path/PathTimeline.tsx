import { useState } from 'react';
import { todayStr } from '../../../../../../shared/src/utils/format';
import { PATH_PHASES_MAX, type TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import type { PathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import type { RenderPlanRow } from '../planRows';
import { HistoryConfirmDialog } from '../../../HistoryConfirmDialog';
import { PathPhaseCard } from './PathPhaseCard';
import { PathPhaseForm } from './PathPhaseForm';
import { PathPhaseTools } from './PathPhaseTools';
import { buildPathView, toggleCriterion, type PhaseRow } from './pathView';
import type { PathState } from './usePath';

interface Props {
  path: PathState;
  current: TherapyPath;
  items: PlanItem[];
  templates: PathTemplate[];
  renderRow: RenderPlanRow;
}

/** Лента фаз с правкой и группа «Без фазы». Раскрытая на телефоне — выбранная руками, до выбора — из модели. */
export function PathTimeline({ path, current, items, templates, renderRow }: Props) {
  const view = buildPathView(current, items, templates);
  const [picked, setPicked] = useState<number | null>(null);
  const openId = picked ?? view.rows[view.openIndex]?.phase.id ?? null;
  // открытая форма: id фазы или 'new'; одна за раз
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [removing, setRemoving] = useState<PhaseRow | null>(null);
  const last = view.rows.length - 1;

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
        {view.rows.map((row) => (editing === row.phase.id ? (
          <div key={row.phase.id} className="pp-leaf ph-card">
            <PathPhaseForm
              initial={row.phase} busy={path.busy} onClose={() => setEditing(null)}
              onSave={(body) => path.patchPhase(row.phase.id, body)}
            />
          </div>
        ) : (
          <PathPhaseCard
            key={row.phase.id} row={row} busy={path.busy} renderRow={renderRow}
            open={openId === row.phase.id}
            onToggle={() => setPicked(openId === row.phase.id ? -1 : row.phase.id)}
            onCriterion={(n) => void path.patchPhase(row.phase.id, { criteriaDone: toggleCriterion(row.phase.criteriaDone, n) }, 'Не удалось отметить критерий')}
            onAction={() => act(row)}
            tools={(
              <PathPhaseTools
                name={row.phase.name} busy={path.busy} canUp={row.index > 0} canDown={row.index < last}
                onEdit={() => { path.clearError(); setEditing(row.phase.id); }}
                onMove={(dir) => void path.movePhase(row.phase.id, dir)}
                onDelete={() => { path.clearError(); setRemoving(row); }}
              />
            )}
          />
        )))}
        {editing === 'new' ? (
          <div className="pp-leaf ph-card">
            <PathPhaseForm busy={path.busy} onClose={() => setEditing(null)} onSave={(body) => path.addPhase({ ...body, templatePhaseId: null })} />
          </div>
        ) : view.rows.length < PATH_PHASES_MAX && (
          <div><button type="button" className="ds-btn ds-btn--secondary" onClick={() => { path.clearError(); setEditing('new'); }}>+ Добавить фазу</button></div>
        )}
      </div>
      {view.unphased.length > 0 && (
        <section className="ph-unphased">
          <h3 className="ds-label">Без фазы</h3>
          <div className="pp-leaf pl-list">{view.unphased.map((item) => renderRow(item))}</div>
        </section>
      )}
      {removing && (
        <HistoryConfirmDialog
          title="Удалить фазу?"
          message={`Фаза «${removing.phase.name}» пропадёт из пути.${removing.items.length > 0 ? ' Её пункты останутся в плане, в группе «Без фазы».' : ''}`}
          confirmLabel="Удалить" busyLabel="Удаляю…"
          busy={path.busy} error={path.error}
          run={() => path.removePhase(removing.phase.id)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  );
}
