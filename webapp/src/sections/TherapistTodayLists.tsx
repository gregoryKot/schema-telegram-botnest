import type { TherapyClientSummary, UserId } from '../api';
import { clientHue, hueStyle, indexLevel } from '../lib/tone';
import { clientAvatarInitials, clientDisplayName } from '../../../shared/src/therapy/clientInitials';
import { activityStatus, latestIndex, sparkPoints } from './therapistTodayModel';
import { fmtIndex } from '../../../shared/src/needs/dayIndex';

interface RowProps { client: TherapyClientSummary; onOpen: (id: UserId) => void }

/** Плотная строка «Активности клиентов»: имя одной строкой с многоточием — рядом спарклайн и индекс. */
export function ActivityRow({ client, onOpen }: RowProps) {
  const name = clientDisplayName(client);
  const status = activityStatus(client);
  const idx = latestIndex(client);
  const level = indexLevel(idx);
  return (
    <button type="button" className="ds-list-row ds-list-row--hover tt-act tt-reset"
      onClick={() => onOpen(client.telegramId)}>
      <span className="ds-avatar" style={hueStyle(clientHue(client.telegramId))}>{clientAvatarInitials(client)}</span>
      <span className="tt-who">
        <span className="tt-act-name">{name}</span>
        <span className={`tt-act-status is-${status.tone}`}>{status.text}</span>
      </span>
      <span className="ds-spark" aria-hidden="true">
        {sparkPoints(client.recentIndexHistory).map((p, i) => (
          <i key={i} className={p.level === 'none' ? undefined : `is-${p.level}`}
            style={{ height: p.height ? `${p.height}%` : undefined }} />
        ))}
      </span>
      <span className={`tt-idx ds-idx-${level}`}>{fmtIndex(idx)}</span><span className="ds-chev" aria-hidden="true" />
    </button>
  );
}

/** Строка «Требуют внимания»: имя переносится на вторую строку, подпись — сколько молчит. */
export function AttentionRow({ client, onOpen }: RowProps) {
  const name = clientDisplayName(client);
  return (
    <button type="button" className="tt-attn tt-reset" onClick={() => onOpen(client.telegramId)}>
      <span className="ds-avatar" style={hueStyle(clientHue(client.telegramId))}>{clientAvatarInitials(client)}</span>
      <span className="tt-who">
        <span className="tt-name">{name}</span>
        <span className="tt-row-sub">{activityStatus(client).text}</span>
      </span>
      <span className="ds-chev" aria-hidden="true" />
    </button>
  );
}
