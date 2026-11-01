import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { Dialog } from './Dialog';
import { joinConfirmExplain, joinConfirmTitle } from '../../../shared/src/therapy/joinConfirmCopy';
import { useJoinConfirm } from '../../../shared/src/therapy/useJoinConfirm';
import { useInvitePreview } from '../../../shared/src/therapy/useInvitePreview';
import { inviteFromLine, inviteInvalidText, JOIN_DONE_TITLE, joinDoneText } from '../../../shared/src/therapy/therapistLinkCopy';
import '../styles/entry-flows.css';

interface Props {
  joinKind: 'pair' | 'therapy';
  joinCode: string;
  onClose: () => void;
  /** Присоединение прошло (после явного «Присоединиться»). */
  onJoined: (joinKind: 'pair' | 'therapy') => void;
}

// M1 (аудит 2026-08): экран-согласие перед присоединением по ссылке-приглашению.
// pair_/therapy_ в адресе подконтрольны отправителю, а присоединение —
// приватное действие с расшариванием данных. Поэтому api.join* зовётся ТОЛЬКО
// после явного «Присоединиться»; закрытие любым способом (фон, Escape,
// «Не сейчас») = отказ без сетевого вызова (fail-closed). Порт
// schema-miniapp/src/components/JoinConfirmSheet.tsx.
// Терапевт (инцидент 2026-10-26): до согласия видно, чей код (имя с сервера,
// без выдумки) и что код уже не действует; после — что теперь видит терапевт.
export function JoinConfirmSheet({ joinKind, joinCode, onClose, onJoined }: Props) {
  const tr = useTr();
  const isPair = joinKind === 'pair';
  const preview = useInvitePreview(api.previewTherapyInvite, joinCode, !isPair);
  const name = preview.state === 'ok' ? preview.therapistName : null;

  const { busy, failMsg, confirm, done } = useJoinConfirm(
    isPair,
    tr,
    () => (isPair ? api.joinPair(joinCode) : api.joinTherapy(joinCode)),
    () => onJoined(joinKind),
  );

  if (done && !isPair) {
    return (
      <Dialog label={JOIN_DONE_TITLE} onClose={onClose} closeOnEscape zIndex={350}>
        <h2 className="ds-h2 sk-dialog-title">{JOIN_DONE_TITLE}</h2>
        <p className="sk-dialog-text" role="status">{joinDoneText(name, tr)}</p>
        <div className="sk-dialog-actions">
          <button type="button" className="ds-btn" onClick={onClose}>Понятно</button>
        </div>
      </Dialog>
    );
  }

  const title = joinConfirmTitle(isPair);
  const invalid = preview.state === 'invalid';
  return (
    <Dialog label={title} onClose={busy ? undefined : onClose} closeOnEscape={!busy} zIndex={350}>
      <h2 className="ds-h2 sk-dialog-title">{title}</h2>
      {name && <p className="sk-dialog-text"><strong>{inviteFromLine(name)}</strong></p>}
      <p className="sk-dialog-text">{joinConfirmExplain(isPair, tr)}</p>
      {invalid && <p role="alert" className="ef-error">{inviteInvalidText(tr)}</p>}
      {failMsg && <p role="alert" className="ef-error">{failMsg}</p>}
      <div className="sk-dialog-actions">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onClose} disabled={busy}>
          {invalid ? 'Закрыть' : 'Не сейчас'}
        </button>
        {!invalid && (
          <button type="button" className="ds-btn" onClick={confirm} disabled={busy}>
            {busy ? 'Присоединяю…' : 'Присоединиться'}
          </button>
        )}
      </div>
    </Dialog>
  );
}
