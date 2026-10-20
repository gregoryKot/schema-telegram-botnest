import { useState } from 'react';
import type { TherapyClientSummary } from '../../api';
import { MEETING_DAYS_ORDER, toggleMeetingDay, sortMeetingDays } from '../../../../shared/src/therapy/meetingDays';
import { DAY_NAMES } from './clientSheetHelpers';
import type { ClientDetail } from './clientSheetTypes';

/** «Дни встреч» — еженедельные дни сессий; правка как в мини-аппе (SessionCard). */
export function MeetingDaysCard({ selectedClient, detail }: { selectedClient: TherapyClientSummary; detail: ClientDetail }) {
  const { saveSessionInfo, sessionInfoSaving, sessionInfoError } = detail;
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<number[]>([]);
  const saved = sortMeetingDays(selectedClient.meetingDays ?? []);

  return (
    <div className="ds-card">
      <div className="tk-card-label">Дни встреч</div>
      {editing ? (
        <div className="tk-edit-form">
          <div className="tk-days" role="group" aria-label="Дни встреч">
            {MEETING_DAYS_ORDER.map(d => (
              <button key={d} type="button" className={`tk-day${local.includes(d) ? ' is-on' : ''}`} aria-pressed={local.includes(d)}
                onClick={() => setLocal(prev => toggleMeetingDay(prev, d))}>
                {DAY_NAMES[d]}
              </button>
            ))}
          </div>
          <div className="tk-edit-actions">
            <button className="ds-btn ds-btn--sm" disabled={sessionInfoSaving}
              onClick={async () => { if (await saveSessionInfo({ meetingDays: local })) setEditing(false); }}>
              {sessionInfoSaving ? '...' : 'Сохранить'}
            </button>
            <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setEditing(false)}>Отмена</button>
          </div>
          {sessionInfoError && <div role="alert" className="tk-error">{sessionInfoError}</div>}
        </div>
      ) : (
        <div className="tk-start">
          <span>{saved.length > 0 ? saved.map(d => DAY_NAMES[d]).join(', ') : <span className="tk-hint">Не указаны</span>}</span>
          <button className="ds-link" onClick={() => { setLocal(saved); setEditing(true); }}>{saved.length > 0 ? 'изменить' : 'указать'}</button>
        </div>
      )}
    </div>
  );
}
