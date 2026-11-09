import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { Dialog } from './Dialog';
import { EntryHead } from './paper/EntryHead';
import { PaperAlert } from './paper/PaperAlert';
import { alertParts, joinLook } from './paper/entryLook';
import { joinSheetView } from '../../../shared/src/therapy/joinSheetView';
import { useJoinConfirm } from '../../../shared/src/therapy/useJoinConfirm';
import { useInvitePreview } from '../../../shared/src/therapy/useInvitePreview';
import { inviteFromLine, JOIN_DONE_TITLE, joinDoneText } from '../../../shared/src/therapy/therapistLinkCopy';

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
// «Не сейчас») = отказ без сетевого вызова (fail-closed). Порт из удалённого мини-аппа.
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
      <Dialog label={JOIN_DONE_TITLE} onClose={onClose} closeOnEscape zIndex={350} maxWidth={480}>
        <EntryHead look={joinLook(isPair, preview.state, true)} title={JOIN_DONE_TITLE} />
        <p className="sk-dialog-text" role="status">{joinDoneText(name, tr)}</p>
        <div className="sk-dialog-actions">
          <button type="button" className="ds-btn" onClick={onClose}>Понятно</button>
        </div>
      </Dialog>
    );
  }

  // Согласие — только когда присоединиться можно; иначе одна причина (М1).
  const view = joinSheetView(isPair, preview, tr);
  const notice = view.notice; // причина, а не сбой: смысл несёт шапка (Cup — устарело), текст спокойный
  return (
    <Dialog label={view.title} onClose={busy ? undefined : onClose} closeOnEscape={!busy} zIndex={350} maxWidth={480}>
      <EntryHead look={joinLook(isPair, preview.state)} title={view.title} sub={name ? inviteFromLine(name) : undefined} />
      {view.explain && <p className="sk-dialog-text">{view.explain}</p>}
      {notice && <p role={notice.role} className="sk-dialog-text">{notice.text}</p>}
      {failMsg && <PaperAlert className="ef-alert" {...alertParts(failMsg)} />}
      <div className="sk-dialog-actions">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onClose} disabled={busy}>
          {view.closeLabel}
        </button>
        {view.canJoin && (
          <button type="button" className="ds-btn" onClick={confirm} disabled={busy}>
            {busy ? 'Присоединяю…' : 'Присоединиться'}
          </button>
        )}
      </div>
    </Dialog>
  );
}
