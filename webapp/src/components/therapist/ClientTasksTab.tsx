import { pressable } from '../../utils/a11y';
import { fmtDate } from '../../utils/format';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  detail: ClientDetail;
}

export function ClientTasksTab({ detail }: Props) {
  const { clientTasks, setShowAssign } = detail;
  const activeTasks  = clientTasks.filter(t => !t.done);
  const doneTasks    = clientTasks.filter(t => t.done === true);

  return (
    <div className="page-inner-wide" style={{ paddingTop: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Домашние задания</div>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
            {activeTasks.length > 0
              ? <>{activeTasks.length} <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-sub)' }}>активных</span></>
              : 'Нет активных'}
          </h2>
        </div>
        <button onClick={() => setShowAssign(true)} className="btn btn-primary">+ Назначить</button>
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>В работе</h3>
            <span className="hint">{activeTasks.length}</span>
          </div>
          {activeTasks.map(t => (
            <div key={t.id} className="list-line">
              <span style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: '2px solid var(--accent)', background: 'transparent',
                display: 'inline-block'
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-md" style={{ fontWeight: 600 }}>{t.text}</div>
                {t.dueDate && (
                  <div className="text-xs faint" style={{ marginTop: 3 }}>
                    до {fmtDate(t.dueDate)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3 style={{ color: 'var(--text-sub)' }}>Выполнено</h3>
            <span className="hint" style={{ color: 'var(--c-moss)' }}>{doneTasks.length}</span>
          </div>
          {doneTasks.map(t => (
            <div key={t.id} className="list-line" style={{ opacity: 0.55 }}>
              <span style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                background: 'var(--c-moss)', border: 'none',
                display: 'grid', placeItems: 'center',
                fontSize: 10, color: 'var(--on-accent)', fontWeight: 700
              }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-md" style={{ fontWeight: 500, textDecoration: 'line-through' }}>{t.text}</div>
                {t.dueDate && (
                  <div className="text-xs faint" style={{ marginTop: 3 }}>до {fmtDate(t.dueDate)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {clientTasks.length === 0 && (
        <div style={{ padding: '48px 0 24px' }}>
          <div style={{ fontSize: 15, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
            Нет назначенных заданий. Домашние практики помогают закрепить работу между сессиями.
          </div>
          <button onClick={() => setShowAssign(true)} className="btn btn-primary">
            + Назначить первое задание
          </button>
        </div>
      )}

      {/* Divider + templates */}
      <hr className="hr-soft" style={{ margin: '48px 0 32px' }} />
      <div className="eyebrow" style={{ marginBottom: 20 }}>Шаблоны заданий</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { t: 'Схема-карточка', sub: 'Триггеры · чувства · мысли · корни · реальность · поведение' },
          { t: 'Дневник режима', sub: '5–7 эпизодов, фокус на конкретном режиме' },
          { t: 'Письмо себе', sub: 'От Здорового Взрослого к Уязвимому Ребёнку' },
          { t: 'Imagery rescripting', sub: 'Аудио-практика, 12 минут' },
        ].map(card => (
          <div key={card.t} className="list-line" {...pressable(() => setShowAssign(true))} style={{ cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-md" style={{ fontWeight: 600 }}>{card.t}</div>
              <div className="text-sm muted" style={{ marginTop: 3, lineHeight: 1.5 }}>{card.sub}</div>
            </div>
            <span className="link" style={{ flexShrink: 0 }}>назначить →</span>
          </div>
        ))}
      </div>
    </div>
  );
}
