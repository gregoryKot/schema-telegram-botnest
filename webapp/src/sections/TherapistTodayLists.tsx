import type { TherapyClientSummary, UserId } from '../api';
import { clientHue, hueStyle, indexLevel } from '../lib/tone';
import {
  activityStatus, clientName, daysSinceActive, initials, latestIndex, sessionTime, sparkPoints,
} from './therapistTodayModel';

interface RowProps { client: TherapyClientSummary; onOpen: (id: UserId) => void }

export function SessionRow({ client, onOpen }: RowProps) {
  const time = sessionTime(client);
  return (
    <button type="button" className="ds-card ds-card--row ds-card--hover tt-session tt-reset"
      onClick={() => onOpen(client.telegramId)}>
      <span className="tt-time">{time || '—'}</span>
      <span className="tt-bar tone-fill" style={hueStyle(clientHue(client.telegramId))} />
      <span>
        <span className="tt-name" style={{ display: 'block' }}>{clientName(client)}</span>
        <span className="tt-row-sub" style={{ display: 'block' }}>{activityStatus(client).text}</span>
      </span>
      <span className="tt-arrow">→</span>
    </button>
  );
}

export function ActivityRow({ client, onOpen }: RowProps) {
  const name = clientName(client);
  const status = activityStatus(client);
  const idx = latestIndex(client);
  const level = indexLevel(idx);
  return (
    <button type="button" className="ds-list-row ds-list-row--hover tt-act tt-reset"
      onClick={() => onOpen(client.telegramId)}>
      <span className="ds-avatar" style={hueStyle(clientHue(client.telegramId))}>{initials(name)}</span>
      <span>
        <span className="tt-act-name" style={{ display: 'block' }}>{name}</span>
        <span className={`tt-act-status is-${status.tone}`} style={{ display: 'block' }}>{status.text}</span>
      </span>
      <span className="ds-spark" aria-hidden="true">
        {sparkPoints(client.recentIndexHistory).map((p, i) => (
          <i key={i} className={p.level === 'none' ? undefined : `is-${p.level}`}
            style={{ height: p.height ? `${p.height}%` : undefined }} />
        ))}
      </span>
      <span className={`tt-idx ds-idx-${level}`}>{idx != null ? idx.toFixed(1) : '—'}</span>
    </button>
  );
}

export function AttentionRow({ client, onOpen }: RowProps) {
  const name = clientName(client);
  const days = daysSinceActive(client);
  return (
    <button type="button" className="ds-card ds-card--row ds-card--warn tt-attn tt-reset"
      onClick={() => onOpen(client.telegramId)}>
      <span className="ds-avatar" style={hueStyle(clientHue(client.telegramId))}>{initials(name)}</span>
      <span className="tt-attn-body">
        <span className="tt-name" style={{ display: 'block' }}>{name}</span>
        <span className="tt-row-sub" style={{ display: 'block' }}>
          {days == null ? 'нет данных' : `нет активности ${days} дн.`}
        </span>
      </span>
      <span className="tt-arrow">→</span>
    </button>
  );
}
