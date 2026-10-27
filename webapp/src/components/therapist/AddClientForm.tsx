import { TherapistInviteShare } from '../../share/TherapistInviteShare';
import { CLIENT_NAME_MAX } from '../../../../shared/src/limits/textLimits';
import { CopyFailedHint } from '../../../../shared/src/components/CopyFailedHint';
import { InviteCodeBox } from '../../../../shared/src/therapy/InviteCodeBox';
import type { useAddClient } from './useAddClient';
import '../../styles/therapist-clients.css';

interface Props {
  addClient: ReturnType<typeof useAddClient>;
  /** «к списку» после создания: родитель сворачивает форму. */
  onClose?: () => void;
}

export function AddClientForm({ addClient, onClose }: Props) {
  const {
    name: addName, setName: setAddName,
    withInvite, setWithInvite,
    created: addCreated, submitting: addSubmitting, error: addError, copied: addCopied, copyFailed: addCopyFailed, valid: addValid,
    inputRef: addInputRef,
    submit: submitAddClient, reset: resetAddClient, copyInvite: copyAddInvite,
  } = addClient;

  if (addCreated) {
    const invite = addCreated.invite;
    return (
      <div className="tc-add">
        <div className="tc-add-done">
          <div className="ds-eyebrow">{invite ? 'Приглашение создано' : 'Клиент добавлен'}</div>
          <h2 className="tc-add-done-name">{addCreated.name}</h2>
          {invite ? (
            <div>
              <div className="ds-label">Ссылка-приглашение</div>
              <div className="tc-invite">
                <code>{invite.url}</code>
                <button className="ds-btn ds-btn--sm" onClick={copyAddInvite}>
                  {addCopied ? '✓ Скопировано' : 'Скопировать'}
                </button>
                <TherapistInviteShare inviteUrl={invite.url} />
              </div>
              <CopyFailedHint show={addCopyFailed} />
              <InviteCodeBox code={invite.code} />
              <p className="ds-sub">Карточка с этим именем появится в списке, когда клиент подключится. До этого — в блоке «Ждут подключения».</p>
            </div>
          ) : (
            <p className="ds-sub">Добавлен как оффлайн-клиент — записи и концептуализация без привязки к боту.</p>
          )}
          <div className="tc-actions">
            <button className="ds-btn ds-btn--sm" onClick={resetAddClient}>Добавить ещё</button>
            <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => { resetAddClient(); onClose?.(); }}>к списку</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tc-add">
      <input
        className="tc-add-name"
        id="add-client-name" ref={addInputRef}
        aria-label="Имя клиента"
        value={addName}
        onChange={e => setAddName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submitAddClient()}
        placeholder="Имя клиента, например Анна К."
        autoComplete="off"
        maxLength={CLIENT_NAME_MAX}
      />
      <button className="ds-btn ds-btn--accent" onClick={submitAddClient} disabled={!addValid || addSubmitting}>
        {addSubmitting ? '...' : withInvite ? 'Создать приглашение' : 'Создать карточку'}
      </button>
      <label className="tc-add-check">
        <input type="checkbox" checked={withInvite} onChange={e => setWithInvite(e.target.checked)} />
        Пригласить в приложение (ссылка и код)
      </label>
      {withInvite && (
        <p className="tc-add-note">Оффлайн-карточка не создаётся: карточка с этим именем появится, когда клиент подключится по ссылке или коду</p>
      )}
      {addError && <div className="tc-add-err">{addError}</div>}
    </div>
  );
}
