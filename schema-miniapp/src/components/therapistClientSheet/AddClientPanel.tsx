import type { AddClientState } from './types';
import type { AddMode } from '../therapist/useAddClient';

interface Props {
  addClient: AddClientState;
}

export function AddClientPanel({ addClient }: Props) {
  const {
    addMode,
    setAddMode,
    addInput,
    setAddInput,
    addLoading,
    addError,
    setAddError,
    inviteUrl,
    setInviteUrl,
    inviteCopied,
    setInviteCopied,
    inviteLoading,
    inviteInputRef,
    createInvite,
    copyInvite,
    shareInvite,
    addByTelegramId,
    addVirtualClient,
  } = addClient;

  return (
    addMode !== null && (
      <div
        style={{
          background: 'rgba(var(--fg-rgb),0.03)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
          animation: 'fade-in 0.18s ease',
        }}
      >
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(
            [
              ['invite', '🔗', 'Ссылка'],
              ['telegram', '📱', 'Telegram ID'],
              ['virtual', '👤', 'Оффлайн'],
            ] as [AddMode, string, string][]
          ).map(([mode, icon, label]) => (
            <button
              key={mode}
              onClick={() => {
                setAddMode(mode);
                setAddInput('');
                setAddError('');
              }}
              style={{
                flex: 1,
                padding: '9px 4px',
                borderRadius: 12,
                border: 'none',
                background:
                  addMode === mode
                    ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                    : 'rgba(var(--fg-rgb),0.05)',
                color:
                  addMode === mode
                    ? 'var(--accent)'
                    : 'rgba(var(--fg-rgb),0.4)',
                fontSize: 12,
                fontWeight: addMode === mode ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Invite form */}
        {addMode === 'invite' && (
          <>
            {!inviteUrl ? (
              <button
                onClick={createInvite}
                disabled={inviteLoading}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  background:
                    'color-mix(in srgb, var(--accent) 20%, transparent)',
                  color: 'var(--accent)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: inviteLoading ? 0.6 : 1,
                }}
              >
                {inviteLoading ? 'Создаю...' : 'Создать ссылку'}
              </button>
            ) : (
              <>
                <input
                  ref={inviteInputRef}
                  readOnly
                  value={inviteUrl}
                  onClick={() => inviteInputRef.current?.select()}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: 10,
                    background: 'rgba(var(--fg-rgb),0.05)',
                    border: '1px solid rgba(var(--fg-rgb),0.1)',
                    borderRadius: 10,
                    padding: '9px 12px',
                    outline: 'none',
                    cursor: 'text',
                    color: 'var(--text-sub)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={copyInvite}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 10,
                      border: 'none',
                      background: inviteCopied
                        ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)'
                        : 'rgba(var(--fg-rgb),0.07)',
                      color: inviteCopied
                        ? '#06d6a0'
                        : 'rgba(var(--fg-rgb),0.6)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {inviteCopied ? '✓ Скопировано' : 'Скопировать'}
                  </button>
                  <button
                    onClick={shareInvite}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 10,
                      border: 'none',
                      background:
                        'color-mix(in srgb, var(--accent) 15%, transparent)',
                      color: 'var(--accent)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Поделиться
                  </button>
                </div>
                <button
                  onClick={() => {
                    setInviteUrl('');
                    setInviteCopied(false);
                  }}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-faint)',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  Создать новую
                </button>
              </>
            )}
          </>
        )}

        {/* Telegram ID form */}
        {addMode === 'telegram' && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={addInput}
                onChange={(e) => {
                  setAddInput(e.target.value);
                  setAddError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && addByTelegramId()}
                placeholder="Telegram ID клиента"
                inputMode="numeric"
                autoFocus
                style={{
                  flex: 1,
                  background: 'rgba(var(--fg-rgb),0.06)',
                  border: `1px solid ${addError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
                  borderRadius: 10,
                  padding: '9px 12px',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
              <button
                onClick={addByTelegramId}
                disabled={addLoading || !addInput.trim()}
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: addInput.trim()
                    ? 'rgba(var(--fg-rgb),0.12)'
                    : 'rgba(var(--fg-rgb),0.05)',
                  color: addInput.trim()
                    ? 'var(--text)'
                    : 'rgba(var(--fg-rgb),0.3)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: addInput.trim() ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              >
                {addLoading ? '...' : 'Добавить'}
              </button>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                marginTop: 6,
              }}
            >
              Клиент должен хотя бы раз открыть приложение
            </div>
          </>
        )}

        {/* Virtual client form */}
        {addMode === 'virtual' && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={addInput}
                onChange={(e) => {
                  setAddInput(e.target.value);
                  setAddError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && addVirtualClient()}
                placeholder="Имя клиента"
                autoFocus
                style={{
                  flex: 1,
                  background: 'rgba(var(--fg-rgb),0.06)',
                  border: `1px solid ${addError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
                  borderRadius: 10,
                  padding: '9px 12px',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
              <button
                onClick={addVirtualClient}
                disabled={addLoading || !addInput.trim()}
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: addInput.trim()
                    ? 'var(--accent)'
                    : 'rgba(var(--fg-rgb),0.05)',
                  color: addInput.trim() ? '#fff' : 'rgba(var(--fg-rgb),0.3)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: addInput.trim() ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              >
                {addLoading ? '...' : 'Создать'}
              </button>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                marginTop: 6,
              }}
            >
              Для работы без Telegram: заметки, концептуализация, задания
            </div>
          </>
        )}

        {addError && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-red)',
              marginTop: 8,
            }}
          >
            {addError}
          </div>
        )}
      </div>
    )
  );
}
