import { useState } from 'react';
import type { TherapyClientSummary } from '../../api';
import { MEETING_DAYS_ORDER, toggleMeetingDay, sortMeetingDays } from '../../../../shared/src/therapy/meetingDays';
import { hueStyle } from '../../lib/tone';
import { DAY_NAMES } from './clientSheetHelpers';
import type { ClientDetail } from './clientSheetTypes';
import { EditFormActions } from './EditFormActions';

/** «Дни встреч» — еженедельные дни сессий; правка как в мини-аппе (SessionCard). */
export function MeetingDaysCard({ selectedClient, detail }: { selectedClient: TherapyClientSummary; detail: ClientDetail }) {
  const { saveSessionInfo, sessionInfoSaving, sessionInfoError } = detail;
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<number[]>([]);
  const saved = sortMeetingDays(selectedClient.meetingDays ?? []);

  return (
    <div className="ds-card ds-card--row">
      <h2 className="ds-label">Дни встреч</h2>
      {editing ? (
        <div className="tk-edit-form">
          <div className="tk-days" role="group" aria-label="Дни встреч" style={hueStyle(undefined)}>
            {MEETING_DAYS_ORDER.map(d => (
              <button key={d} type="button" className={`ds-chip ds-chip--toggle${local.includes(d) ? ' is-on' : ''}`} aria-pressed={local.includes(d)} onClick={() => setLocal(prev => toggleMeetingDay(prev, d))}>
                {DAY_NAMES[d]}
              </button>
            ))}
          </div>
          <EditFormActions saving={sessionInfoSaving} error={sessionInfoError} onCancel={() => setEditing(false)}
            onSave={async () => { if (await saveSessionInfo({ meetingDays: local })) setEditing(false); }} />
        </div>
      ) : (
        <div className="tk-start">
          <span>{saved.length > 0 ? saved.map(d => DAY_NAMES[d]).join(', ') : <span className="ds-empty">Не указаны</span>}</span>
          <button className="ds-link" onClick={() => { setLocal(saved); setEditing(true); }}>{saved.length > 0 ? 'Изменить →' : 'Указать →'}</button>
        </div>
      )}
    </div>
  );
}
