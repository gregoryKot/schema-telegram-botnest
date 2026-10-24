// Привязка email в кабинете: строка способа входа, «зачем» (почта — запасной
// ключ), форма адреса и экран «письмо отправлено». После отправки не обещаем
// «письмо отправлено»: ответ одинаков для свободного и занятого адреса (B-16).
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
    <div className="aa-row-wrap">
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
      {!linked && <p className="aa-email-why">Пригодится, если пропадёт доступ к Telegram или другому способу входа.</p>}
      {showForm &&
        !linked &&
        (sent ? (
          <div className="aa-email-sent">
            Если адрес свободен, письмо придёт в течение минуты на <b>{value}</b>.{' '}
            {tr(
              'Перейди по ссылке в письме — она привяжет email к аккаунту.',
              'Перейдите по ссылке в письме — она привяжет email к аккаунту.',
            )}
            <button
              className="aa-email-again"
              onClick={() => {
                setSent(false);
                setValue('');
              }}
            >
              Ввести другой email
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="aa-email-form">
            <input
              type="email"
              required
              ref={inputRef}
              placeholder="your@email.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="ds-input"
            />
            <button type="submit" disabled={sending} className="ds-btn ds-btn--sm">
              {sending ? '…' : 'Отправить'}
            </button>
          </form>
        ))}
    </div>
  );
}
