import { pressable } from '../../utils/a11y';
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { RosterSparkline } from './Sparklines';
import { indexColor, isVirtualClient } from './clientSheetHelpers';
import { clientSubline, meetingLabel } from './rosterModel';

export const WELLBEING_HINT = 'Индекс дня по пяти потребностям и динамика за 14 дней';

interface Props {
  client: TherapyClientSummary;
  today: string;
  showState: boolean;
  onOpen: (client: TherapyClientSummary) => void;
}

// Строка таблицы клиентов: имя, ближайшая встреча, самочувствие, схемы.
// Офлайн-клиент узнаётся по отрицательному telegramId, а не по name:
// name у него — имя из карточки, непустое.
export function RosterRow({ client, today, showState, onOpen }: Props) {
  const virtual = isVirtualClient(client);
  const meeting = meetingLabel(client, today);
  const name = client.clientAlias ?? client.name ?? `ID ${client.telegramId}`;
  return (
    <div className="r-row" {...pressable(() => onOpen(client))} style={{ cursor: 'pointer' }}>
      <div style={{ minWidth: 0 }}>
        <div className="u-ac8">
          <span className="text-base u-w600">{name}</span>
          {client.lastActiveDate === today && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-moss)', flexShrink: 0 }} />
          )}
        </div>
        <div className="text-xs faint u-mt3">{clientSubline(client, today)}</div>
      </div>
      <div className="text-sm" style={{ color: meeting ? 'var(--text)' : undefined }}>
        {meeting ?? <span className="faint">—</span>}
      </div>
      {showState && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} title={WELLBEING_HINT}>
          {virtual ? (
            <span className="text-sm faint">—</span>
          ) : (
            <>
              {client.todayIndex != null ? (
                <span className="num" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: indexColor(client.todayIndex) }}>
                  {client.todayIndex.toFixed(1)}
                </span>
              ) : <span className="text-sm faint">–</span>}
              <RosterSparkline values={(client.recentIndexHistory ?? []).slice().reverse()} />
            </>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}>
        {client.schemaIds.length > 0 ? client.schemaIds.slice(0, 3).map(id => {
          const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === id));
          const schema = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === id);
          return (
            <span key={id} className="tag-mini">
              <span style={{ width: 8, height: 8, borderRadius: 'var(--r-2)', background: domain?.color ?? 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
              {schema?.name ?? id}
            </span>
          );
        }) : <span className="text-xs faint">–</span>}
        {client.schemaIds.length > 3 && <span className="text-xs faint">+{client.schemaIds.length - 3}</span>}
      </div>
    </div>
  );
}
