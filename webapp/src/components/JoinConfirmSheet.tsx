import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { Dialog } from './Dialog';
import { joinConfirmExplain, joinConfirmTitle } from '../../../shared/src/therapy/joinConfirmCopy';
import { useJoinConfirm } from '../../../shared/src/therapy/useJoinConfirm';
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
export function JoinConfirmSheet({ joinKind, joinCode, onClose, onJoined }: Props) {
  const tr = useTr();
  const isPair = joinKind === 'pair';

  const title = joinConfirmTitle(isPair);
  const explain = joinConfirmExplain(isPair, tr);

  const { busy, failMsg, confirm } = useJoinConfirm(
    isPair,
    tr,
    () => (isPair ? api.joinPair(joinCode) : api.joinTherapy(joinCode)),
    () => onJoined(joinKind),
  );

  return (
    <Dialog label={title} onClose={busy ? undefined : onClose} closeOnEscape={!busy} zIndex={350}>
      <h2 className="ds-h2 sk-dialog-title">{title}</h2>
      <p className="sk-dialog-text">{explain}</p>
      {failMsg && <p role="alert" className="ef-error">{failMsg}</p>}
      <div className="sk-dialog-actions">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onClose} disabled={busy}>
          Не сейчас
        </button>
        <button type="button" className="ds-btn" onClick={confirm} disabled={busy}>
          {busy ? 'Присоединяю…' : 'Присоединиться'}
        </button>
      </div>
    </Dialog>
  );
}
