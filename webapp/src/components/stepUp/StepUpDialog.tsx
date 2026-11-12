import { useEffect, useRef, useState, type FormEvent } from 'react';
import { buildStepUpText } from '../../../../shared/src/auth/stepUp';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { OtpCells } from '../../pages/login/OtpCells';
import { RecoveryCodeField } from '../../pages/login/RecoveryCodeField';
import { OTP_LENGTH } from '../../pages/login/otp';
import { Dialog } from '../Dialog';
import { StepUpTitle } from './StepUpTitle';
import '../../styles/auth-login.css';

export interface StepUpView {
  /** ask — первый запрос кода; wrong — код не подошёл; locked — пауза кодов приложения. */
  status: 'ask' | 'wrong' | 'locked';
  retryAfterS: number | null;
  /** Номер отказа: по нему поле очищается ровно раз на ответ сервера. */
  attempt: number;
  busy: boolean;
  /** Код подошёл — окно закрывается само. */
  done: boolean;
}

const RECOVERY_CODE_LENGTH = 10; // src/auth/totp.service.ts, RECOVERY_CODE_BYTES

// Окно кода двухфакторной защиты (StepUpProvider). Поля — те же, что на экране
// входа с 2FA (OtpCells / RecoveryCodeField): одна механика ввода кода.
// useHistorySheet: «Назад» браузера закрывает окно и отменяет действие.
export function StepUpDialog({ view, onSubmit, onClosed }: {
  view: StepUpView; onSubmit: (code: string) => void; onClosed: () => void;
}) {
  const tr = useTr();
  const copy = buildStepUpText(tr);
  const goBack = useHistorySheet(onClosed);
  // Ввод привязан к номеру отказа: новый ответ сервера — пустое поле, а на паузе
  // кодов приложения — сразу резервный код (без эффекта, чтобы не мигало старое).
  const [entry, setEntry] = useState({ attempt: -1, code: '', recovery: false });
  const fresh = entry.attempt !== view.attempt;
  const code = fresh ? '' : entry.code;
  const recovery = fresh ? entry.recovery || view.status === 'locked' : entry.recovery;
  const setCode = (next: string) => setEntry({ attempt: view.attempt, code: next, recovery });
  const toggle = () => setEntry({ attempt: view.attempt, code: '', recovery: !recovery });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (view.done) goBack(); }, [view.done, goBack]);
  useEffect(() => { inputRef.current?.focus(); }, [view.attempt, recovery]);

  const ready = code.length === (recovery ? RECOVERY_CODE_LENGTH : OTP_LENGTH);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready && !view.busy) onSubmit(code);
  };
  const error = view.status === 'locked' ? copy.locked(view.retryAfterS) : view.status === 'wrong' ? copy.wrong : null;

  return (
    <div className="light-lock">
      <Dialog label={copy.title} onClose={view.busy ? undefined : goBack} closeOnEscape={!view.busy} zIndex={400}>
        <StepUpTitle title={copy.title} />
        <p className="sk-dialog-text">{copy.lead}</p>
        <form onSubmit={submit} className="al-form">
          {recovery ? (
            <RecoveryCodeField ref={inputRef} value={code} onChange={setCode} disabled={view.busy} />
          ) : (
            <OtpCells ref={inputRef} value={code} onChange={setCode} disabled={view.busy} label="Код из приложения" />
          )}
          {error && <p role="alert" className="al-error">{error}</p>}
          <button type="button" className="al-linkbtn" onClick={toggle} disabled={view.busy}>
            {recovery ? 'Ввести код из приложения' : 'Использовать резервный код'}
          </button>
          <div className="sk-dialog-actions">
            <button type="button" className="ds-btn ds-btn--secondary" onClick={goBack} disabled={view.busy}>Отмена</button>
            <button type="submit" className="ds-btn" disabled={view.busy || !ready}>{view.busy ? 'Проверяю…' : 'Подтвердить'}</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
