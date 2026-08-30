// Привязка email в кабинете: строка способа входа + форма адреса + экран
// «письмо отправлено». Раньше всё это жило прямо в AccountPage вместе с
// четырьмя своими useState — страница из-за этого упиралась в лимит размера
// (правило №10), а ветка «письмо отправлено» тестировалась только через неё.
import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../utils/apiBase';
import { useTr } from '../../utils/addressForm';
import { EmailIcon, ProviderRow } from './ProviderRows';

export function EmailLinkRow({
  accessToken,
  linked,
  email,
  busy,
  onUnlink,
  onError,
}: {
  accessToken: string | null;
  linked: boolean;
  /** Привязанный адрес — подпись строки. */
  email?: string | null;
  busy: boolean;
  onUnlink: () => void;
  /** Ошибку показывает страница одним блоком на весь кабинет. */
  onError: (message: string | null) => void;
}) {
  const tr = useTr();
  const [showForm, setShowForm] = useState(false);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm && !linked && !sent) inputRef.current?.focus();
  }, [showForm, linked, sent]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    onError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/email/link-to-account`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'webapp',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Ошибка' }));
        throw new Error(body.message ?? `Ошибка ${res.status}`);
      }
      setSent(true);
    } catch (e) {
      onError(String(e).replace('Error: ', ''));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '14px 0' }}>
      <ProviderRow
        icon={<EmailIcon />}
        title="Email"
        linked={linked}
        busy={busy}
        emptySubtitle="не привязан"
        subtitle={email ?? 'привязан'}
        onUnlink={onUnlink}
        onLink={() => {
          setShowForm(true);
          setSent(false);
          setValue('');
        }}
      />
      {showForm &&
        !linked &&
        (sent ? (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              background: 'rgba(var(--fg-rgb),0.04)',
              borderRadius: 'var(--r-10)',
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.5,
            }}
          >
            Письмо отправлено на <b>{value}</b>.{' '}
            {tr(
              'Перейди по ссылке в письме — она привяжет email к аккаунту.',
              'Перейдите по ссылке в письме — она привяжет email к аккаунту.',
            )}
            <button
              onClick={() => {
                setSent(false);
                setValue('');
              }}
              style={{
                display: 'block',
                marginTop: 8,
                background: 'none',
                border: 'none',
                color: 'var(--text-faint)',
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Ввести другой email
            </button>
          </div>
        ) : (
          <form
            onSubmit={send}
            style={{ marginTop: 12, display: 'flex', gap: 'var(--space-8)' }}
          >
            <input
              type="email"
              required
              ref={inputRef}
              placeholder="your@email.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: 13,
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-8)',
                background: 'rgba(var(--fg-rgb),0.04)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r-8)',
                cursor: sending ? 'default' : 'pointer',
                opacity: sending ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {sending ? '…' : 'Отправить'}
            </button>
          </form>
        ))}
    </div>
  );
}
