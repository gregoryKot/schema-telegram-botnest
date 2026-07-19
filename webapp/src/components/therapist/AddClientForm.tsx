import { useTr } from '../../utils/addressForm';
import type { useAddClient } from './useAddClient';

interface Props {
  addClient: ReturnType<typeof useAddClient>;
}

export function AddClientForm({ addClient }: Props) {
  const tr = useTr();

  const {
    name: addName, setName: setAddName,
    withInvite, setWithInvite,
    created: addCreated, submitting: addSubmitting, error: addError, copied: addCopied, valid: addValid,
    inputRef: addInputRef,
    submit: submitAddClient, reset: resetAddClient, copyInvite: copyAddInvite,
  } = addClient;

  return (
    <div style={{ paddingBottom: 48, borderBottom: '1px solid var(--line)', marginBottom: 48 }}>
      {addCreated ? (
        /* Success state */
        <div style={{ animation: 'fade-in 0.25s ease' }}>
          <div className="eyebrow" style={{ marginBottom: 20, color: 'var(--c-moss)' }}>Клиент добавлен</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 20px', lineHeight: 1.1, color: 'var(--text)' }}>
            {addCreated.name}
          </h2>
          {addCreated.inviteUrl ? (
            <div style={{ marginBottom: 24, maxWidth: 520 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Ссылка-приглашение</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: 'var(--text-sub)', background: 'rgba(var(--fg-rgb),0.05)', padding: '9px 13px', borderRadius: 8, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {addCreated.inviteUrl}
                </code>
                <button
                  onClick={copyAddInvite}
                  style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: addCopied ? 'var(--c-moss)' : 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.2s' }}
                >
                  {addCopied ? '✓ Скопировано' : 'Скопировать'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
                Клиент перейдёт по ссылке и автоматически подключится через бот
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.6, marginBottom: 24, maxWidth: 440 }}>
              Добавлен как оффлайн-клиент — записи и концептуализация без привязки к боту.
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={resetAddClient}
              style={{ padding: '9px 20px', borderRadius: 20, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Добавить ещё
            </button>
            <button
              onClick={resetAddClient}
              style={{ padding: '9px 20px', borderRadius: 20, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}
            >
              к списку
            </button>
          </div>
        </div>
      ) : (
        /* Form state */
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Новый клиент</div>
          <h1 className="hub-title" style={{ marginBottom: 8 }}>Добавить клиента</h1>
          <p className="hub-sub" style={{ marginBottom: 28 }}>
            {tr('Введи имя — создастся оффлайн-карточка. Ссылку для подключения через бот — опционально.', 'Введите имя — создастся оффлайн-карточка. Ссылку для подключения через бот — опционально.')}
          </p>

          {/* Underline field */}
          <div style={{ borderBottom: `1.5px solid ${addName.length >= 2 ? 'var(--text)' : 'rgba(var(--fg-rgb),0.2)'}`, display: 'flex', alignItems: 'center', gap: 16, maxWidth: 480, marginBottom: 20, transition: 'border-color 0.2s' }}>
            <input
              ref={addInputRef}
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAddClient()}
              placeholder="Имя клиента"
              autoComplete="off"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 22, fontFamily: 'var(--serif)', color: 'var(--text)', padding: '6px 0', letterSpacing: '-0.01em' }}
            />
            <button
              onClick={submitAddClient}
              disabled={!addValid || addSubmitting}
              style={{ padding: '7px 18px', borderRadius: 20, border: 'none', background: addValid ? 'var(--text)' : 'rgba(var(--fg-rgb),0.1)', color: addValid ? 'var(--bg)' : 'var(--text-faint)', fontSize: 13, fontWeight: 500, cursor: addValid ? 'pointer' : 'default', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}
            >
              {addSubmitting ? '...' : 'Добавить'}
            </button>
          </div>

          {/* Invite toggle */}
          <button
            onClick={() => setWithInvite(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 480, background: 'none', border: 'none', padding: '11px 0', cursor: 'pointer', borderBottom: '1px solid rgba(var(--fg-rgb),0.07)' }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>Создать ссылку-приглашение</span>
            <div style={{ width: 38, height: 20, borderRadius: 10, background: withInvite ? 'var(--accent)' : 'var(--surface-3)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: withInvite ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
            </div>
          </button>
          {withInvite && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, maxWidth: 440 }}>
              После добавления появится ссылка — клиент перейдёт по ней и подключится через Telegram-бот
            </p>
          )}

          {addError && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-rose)' }}>{addError}</div>}
        </div>
      )}
    </div>
  );
}
