import { useState } from 'react';
import { api, type TherapyClientSummary } from '../../api';
import { useTr } from '../../utils/addressForm';
import { TherapistInviteShare } from '../../share/TherapistInviteShare';
import { CopyFailedHint } from '../../../../shared/src/components/CopyFailedHint';
import { InviteCodeBox } from '../../../../shared/src/therapy/InviteCodeBox';
import { inviteExpiryLabel } from '../../../../shared/src/therapy/PendingInviteRow';
import {
  inviteCreateErrorText,
  offlineClientInvite,
  usePendingInvites,
} from '../../../../shared/src/therapy/therapyInvites';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { useSingleFlight } from '../../../../shared/src/utils/useSingleFlight';
import '../../styles/therapist-clients.css';

interface Props {
  selectedClient: TherapyClientSummary;
}

// Карточка «Приложение» в сайдбаре «Обзора» офлайн-клиента: пригласить его в
// приложение; записи карточки переедут на аккаунт после сверки (S8, CardClaimBanner).
export function OfflineInviteCard({ selectedClient }: Props) {
  const tr = useTr();
  const once = useSingleFlight();
  const pending = usePendingInvites(api);
  const { copied, failed, copy } = useCopyToClipboard();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const invite = offlineClientInvite(pending.invites, selectedClient.telegramId);

  const create = () =>
    once(async () => {
      setSubmitting(true);
      setError('');
      try {
        await api.createOfflineClientInvite(selectedClient.telegramId);
        pending.reload();
      } catch (e: unknown) {
        setError(inviteCreateErrorText(e, tr));
      } finally {
        setSubmitting(false);
      }
    });

  return (
    <div className="ds-card ds-card--row">
      <h2 className="ds-label">Приложение</h2>
      {pending.invites !== undefined && !invite && (
        <>
          <p className="ds-sub">
            У клиента пока нет приложения. Когда по коду подключится аккаунт, кабинет спросит, тот ли
            это человек. После «Да» задания, заметки, карта режимов и концептуализация переедут на его аккаунт.
          </p>
          <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={create} disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? '…' : 'Пригласить в приложение'}
          </button>
          {error && <div role="alert" className="tk-error">{error}</div>}
        </>
      )}
      {invite && (
        <>
          <p className="ds-sub">Ждёт подключения · {inviteExpiryLabel(invite.expiresAt)}</p>
          <div className="tc-invite">
            <code>{invite.url}</code>
            <button className="ds-btn ds-btn--sm" onClick={() => void copy(invite.url)}>
              {copied ? '✓ Скопировано' : 'Скопировать'}
            </button>
            <TherapistInviteShare invite={invite} />
          </div>
          <CopyFailedHint show={failed} />
          <InviteCodeBox code={invite.code} />
          <p className="ds-sub">
            Когда человек подключится, над списком клиентов появится вопрос «Это тот же человек?». До ответа записи карточки ему не видны.
          </p>
        </>
      )}
    </div>
  );
}
