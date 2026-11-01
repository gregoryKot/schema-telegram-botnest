import type { TherapyClientSummary } from '../../api';
import { fmtDate, todayStr } from '../../utils/format';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { SessionDateTimeFields } from '../../../../shared/src/therapy/SessionDateTimeFields';
import { sessionInputHint, sessionToSave, startDateHint } from '../../../../shared/src/therapy/sessionInput';
import { DAY_NAMES, nextSessionLabel } from './clientSheetHelpers';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}

/** «Следующая сессия» (акцентная карточка) с редактированием даты. */
export function NextSessionCard({ selectedClient, detail }: Props) {
  const { editingNextSession, setEditingNextSession, localNextSession, setLocalNextSession, saveSessionInfo, sessionInfoSaving, sessionInfoError } = detail;
  const days = selectedClient.meetingDays ?? [];
  const upcoming = upcomingSession(selectedClient.nextSession, days);
  const hint = sessionInputHint(localNextSession);
  return (
    <div className="ds-card ds-card--accent">
      <div className="tk-card-label">Следующая сессия</div>
      {editingNextSession ? (
        <div className="tk-edit-form">
          <SessionDateTimeFields className="ds-input" value={localNextSession} onChange={setLocalNextSession} />
          <div className="tk-edit-actions">
            <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={sessionInfoSaving || hint !== null}
              onClick={async () => { if (await saveSessionInfo({ nextSession: sessionToSave(localNextSession) })) setEditingNextSession(false); }}>
              {sessionInfoSaving ? '...' : 'Сохранить'}
            </button>
            <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setEditingNextSession(false)}>Отмена</button>
          </div>
          {(hint ?? sessionInfoError) && <div role="alert" className="tk-next-sub">{hint ?? sessionInfoError}</div>}
        </div>
      ) : (
        <>
          <div className="tk-next">{upcoming ? nextSessionLabel(upcoming) : 'Не установлена'}</div>
          {days.length > 0 && <div className="tk-next-sub">{days.map(d => DAY_NAMES[d]).join(', ')} еженедельно</div>}
          <button className="tk-next-edit" onClick={() => { setEditingNextSession(true); setLocalNextSession(upcoming ?? ''); }}>Изменить →</button>
        </>
      )}
    </div>
  );
}

/** «Начало терапии» с редактированием даты. */
export function StartDateCard({ selectedClient, detail }: Props) {
  const { editingStartDate, setEditingStartDate, localStartDate, setLocalStartDate, saveSessionInfo, sessionInfoSaving, sessionInfoError } = detail;
  const hint = startDateHint(localStartDate);
  return (
    <div className="ds-card">
      <div className="tk-card-label">Начало терапии</div>
      {editingStartDate ? (
        <div className="tk-edit-form">
          <input className="ds-input" type="date" max={todayStr()} value={localStartDate} onChange={e => setLocalStartDate(e.target.value)} />
          <div className="tk-edit-actions">
            <button className="ds-btn ds-btn--sm" disabled={sessionInfoSaving || hint !== null}
              onClick={async () => { if (await saveSessionInfo({ therapyStartDate: localStartDate || null })) setEditingStartDate(false); }}>
              {sessionInfoSaving ? '...' : 'Сохранить'}
            </button>
            <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setEditingStartDate(false)}>Отмена</button>
          </div>
          {(hint ?? sessionInfoError) && <div role="alert" className="tk-error">{hint ?? sessionInfoError}</div>}
        </div>
      ) : (
        <div className="tk-start">
          <span>{selectedClient.therapyStartDate ? fmtDate(selectedClient.therapyStartDate) : <span className="tk-hint">Не указана</span>}</span>
          <button className="ds-link" onClick={() => { setEditingStartDate(true); setLocalStartDate(selectedClient.therapyStartDate ?? ''); }}>изменить</button>
        </div>
      )}
    </div>
  );
}
