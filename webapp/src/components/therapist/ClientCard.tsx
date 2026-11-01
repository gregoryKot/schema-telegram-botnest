import { pressable } from '../../utils/a11y';
import type { TherapyClientSummary } from '../../api';
import { DOMAIN_HUE, clientHue, hueStyle } from '../../lib/tone';
import {
  clientCaption, clientStatus, domainBar, meetingLabel, rosterInitials, rosterName, schemaChips,
} from './rosterModel';

interface Props {
  client: TherapyClientSummary;
  today: string;
  onOpen: (client: TherapyClientSummary) => void;
}

// Карточка клиента в сетке «Все клиенты»: полоса доменов схем, аватар, статус,
// ближайшая встреча, чипы всех схем. Счётчиков сессий/заданий в сводке клиента
// нет — футер без них (показываем только реальные данные).
export function ClientCard({ client, today, onOpen }: Props) {
  const name = rosterName(client);
  const status = clientStatus(client);
  const caption = clientCaption(client);
  const meeting = meetingLabel(client, today);
  return (
    <div className="ds-card ds-card--flush ds-card--hover tc-card" {...pressable(() => onOpen(client))}>
      <div className="tc-bar" aria-hidden>
        {domainBar(client.schemaIds).map((seg) => (
          <i key={seg.domainId} className="tone-fill" style={{ flex: seg.count, ...hueStyle(DOMAIN_HUE[seg.domainId]) }} />
        ))}
      </div>
      <div className="tc-body">
        <div className="tc-top">
          <div className="ds-avatar ds-avatar--serif tc-avatar" style={hueStyle(clientHue(client.telegramId))}>
            {rosterInitials(name)}
          </div>
          <div className="tc-who">
            <div className="tc-name">{name}</div>
            <div className="tc-meta">
              <span className={status.inBot ? 'ds-badge ds-badge--ok' : 'ds-badge'}>{status.label}</span>
              {caption && <span>{caption}</span>}
            </div>
          </div>
        </div>
        <div className="tc-meeting">
          <span className="ds-label">Встреча</span>
          <span className={meeting ? 'tc-meeting-val' : 'tc-meeting-val tc-meeting-val--none'}>
            {meeting ?? 'не назначена'}
          </span>
        </div>
        {client.schemaIds.length > 0 && (
          <div className="tc-chips">
            {schemaChips(client.schemaIds).map((ch) => (
              <span key={ch.id} className="ds-chip tone-tint" style={hueStyle(DOMAIN_HUE[ch.domainId])}>{ch.name}</span>
            ))}
          </div>
        )}
        <div className="tc-foot">
          <span className="ds-link">Открыть →</span>
        </div>
      </div>
    </div>
  );
}
