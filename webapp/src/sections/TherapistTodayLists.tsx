import type { TherapyClientSummary, UserId } from '../api';
import { clientHue, hueStyle } from '../lib/tone';
import { clientAvatarInitials, clientDisplayName } from '../../../shared/src/therapy/clientInitials';
import { activityStatus, latestIndex, sparkPoints } from './therapistTodayModel';
import { fmtIndex } from '../../../shared/src/needs/dayIndex';

interface RowProps { client: TherapyClientSummary; onOpen: (id: UserId) => void }

/** Строка «Активности клиентов»: имя до двух строк, рядом спарклайн и индекс. Без светофора (r1): столбики — одни
 *  чернила, пропуск — бледный паз, число — Literata --text, подпись — --text-sub, как трекер в карточке клиента. */
export function ActivityRow({ client, onOpen }: RowProps) {
  const name = clientDisplayName(client);
  const status = activityStatus(client);
  const idx = latestIndex(client);
  return (
    <button type="button" className="ds-list-row ds-list-row--hover tt-act tt-reset"
      onClick={() => onOpen(client.telegramId)}>
      <span className="ds-avatar ds-avatar--paper" style={hueStyle(clientHue(client.telegramId))}>{clientAvatarInitials(client)}</span>
      <span className="tt-who">
        <span className="tt-name tt-act-name">{name}</span>
        <span className="tt-act-status">{status.text}</span>
      </span>
      <span className="ds-spark ds-spark--ink" aria-hidden="true">
        {sparkPoints(client.recentIndexHistory).map((p, i) => (
          <i key={i} className={p.level === 'none' ? 'is-none' : undefined}
            style={{ height: p.height ? `${p.height}%` : undefined }} />
        ))}
      </span>
      <span className={idx == null ? 'tt-idx is-none' : 'tt-idx'}>{fmtIndex(idx)}</span><span className="ds-chev" aria-hidden="true" />
    </button>
  );
}

/** Строка «Требуют внимания»: имя переносится на вторую строку, подпись — сколько молчит. */
export function AttentionRow({ client, onOpen }: RowProps) {
  const name = clientDisplayName(client);
  return (
    <button type="button" className="tt-attn tt-reset" onClick={() => onOpen(client.telegramId)}>
      <span className="ds-avatar ds-avatar--paper" style={hueStyle(clientHue(client.telegramId))}>{clientAvatarInitials(client)}</span>
      <span className="tt-who">
        <span className="tt-name">{name}</span>
        <span className="tt-row-sub">{activityStatus(client).text}</span>
      </span>
      <span className="ds-chev" aria-hidden="true" />
    </button>
  );
}
