import type { TherapyClientSummary } from '../../api';
import { fmtDate, todayStr } from '../../utils/format';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { SessionDateTimeFields } from '../../../../shared/src/therapy/SessionDateTimeFields';
import { sessionInputHint, sessionToSave, startDateHint } from '../../../../shared/src/therapy/sessionInput';
import { DAY_NAMES, nextSessionLabel } from './clientSheetHelpers';
import type { ClientDetail } from './clientSheetTypes';
import { EditFormActions } from './EditFormActions';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

/** «Следующая сессия» — единственная акцентная карточка «Обзора» (#906) — с редактированием даты. */
export function NextSessionCard({ selectedClient, detail }: Props) {
  const { editingNextSession, setEditingNextSession, localNextSession, setLocalNextSession, saveSessionInfo, sessionInfoSaving, sessionInfoError } = detail;
  const days = selectedClient.meetingDays ?? [];
  const upcoming = upcomingSession(selectedClient.nextSession, days);
  const hint = sessionInputHint(localNextSession);
  return (
    <div className="ds-card ds-card--row ds-card--accent">
      <h2 className="ds-label">Следующая сессия</h2>
      {editingNextSession ? (
        <div className="tk-edit-form">
          <SessionDateTimeFields className="ds-input" value={localNextSession} onChange={setLocalNextSession} />
          <EditFormActions saving={sessionInfoSaving} error={sessionInfoError} hint={hint} onAccent onCancel={() => setEditingNextSession(false)}
            onSave={async () => { if (await saveSessionInfo({ nextSession: sessionToSave(localNextSession) })) setEditingNextSession(false); }} />
        </div>
      ) : (
        <>
          <div className="ds-h3 tk-next">{upcoming ? nextSessionLabel(upcoming) : 'Не установлена'}</div>
          {days.length > 0 && <div className="ds-sub">{days.map(d => DAY_NAMES[d]).join(', ')} еженедельно</div>}
          <div className="tk-start">
            <button className="ds-link" onClick={() => { setEditingNextSession(true); setLocalNextSession(upcoming ?? ''); }}>Изменить →</button>
          </div>
        </>
      )}
    </div>
  );
}

/** «Начало терапии» с редактированием даты. */
export function StartDateCard({ selectedClient, detail }: Props) {
  const { editingStartDate, setEditingStartDate, localStartDate, setLocalStartDate, saveSessionInfo, sessionInfoSaving, sessionInfoError } = detail;
  const start = selectedClient.therapyStartDate;
  const hint = startDateHint(localStartDate);
  return (
    <div className="ds-card ds-card--row">
      <h2 className="ds-label">Начало терапии</h2>
      {editingStartDate ? (
        <div className="tk-edit-form">
          <input className="ds-input" type="date" max={todayStr()} value={localStartDate} onChange={e => setLocalStartDate(e.target.value)} />
          <EditFormActions saving={sessionInfoSaving} error={sessionInfoError} hint={hint} onCancel={() => setEditingStartDate(false)}
            onSave={async () => { if (await saveSessionInfo({ therapyStartDate: localStartDate || null })) setEditingStartDate(false); }} />
        </div>
      ) : (
        <div className="tk-start">
          <span>{start ? fmtDate(start) : <span className="ds-empty">Не указана</span>}</span>
          <button className="ds-link" onClick={() => { setEditingStartDate(true); setLocalStartDate(start ?? ''); }}>{start ? 'Изменить →' : 'Указать →'}</button>
        </div>
      )}
    </div>
  );
}
