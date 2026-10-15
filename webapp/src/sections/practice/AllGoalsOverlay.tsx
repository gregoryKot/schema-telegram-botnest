import { GlyphArrowLeft } from '../../components/exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import type { UserTask } from '../../api';
import { pressable } from '../../utils/a11y';
import { fmtDate } from '../../utils/format';
import { resolveTaskText } from './exerciseLibrary';

export function AllGoalsOverlay({ tasks, taskHistory, onClose, onOpen, onAdd }: {
  tasks: UserTask[]; taskHistory: UserTask[];
  onClose: () => void; onOpen: (t: UserTask) => void; onAdd: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <div className="ex-topbar"><button className="ex-back" onClick={goBack}><GlyphArrowLeft /> Назад</button></div>
      <div style={{ overflowY: 'auto', padding: '32px 24px 80px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>Все цели</h1>
        {tasks.map(t => (
          <div key={t.id} className="list-line u-pointer" {...pressable(() => onOpen(t))}>
            <div className="u-fill">
              <div className="text-md" style={{ fontWeight: 500 }}>{resolveTaskText(t)}</div>
              {t.dueDate && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>до {fmtDate(t.dueDate)}</div>}
            </div>
            <span className="link">открыть →</span>
          </div>
        ))}
        {taskHistory.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 20, marginBottom: 8 }}>Выполнено</div>
            {taskHistory.map(t => (
              <div key={t.id} className="list-line" style={{ opacity: 0.5 }}>
                <div className="u-flex1"><div className="text-sm">{resolveTaskText(t)}</div></div>
                <span className="text-xs faint">{t.done === true ? 'готово' : 'отменено'}</span>
              </div>
            ))}
          </>
        )}
        <button className="ex-btn ex-btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={onAdd}>
          + Поставить цель
        </button>
      </div>
    </div>
  );
}
