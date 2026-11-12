// Привязка email в кабинете: строка способа входа, «зачем» (почтой входят на сайт),
// форма адреса и экран с кодом из письма; ошибка — у своего поля (b27). После отправки не обещаем
// «письмо отправлено»: ответ одинаков для свободного и занятого адреса (B-16).
import { useEffect, useRef, useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { EmailIcon, ProviderRow } from './ProviderRows';
import { OkMark } from './OkMark';
import type { EmailLinkNotice } from './emailLinkNotice';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import { useStepUpFetch } from '../../components/stepUp/stepUpContext';
import { sessionPost } from '../../components/stepUp/sessionRequest';
import { EmailLinkCodeForm } from './EmailLinkCodeForm';

export function EmailLinkRow({
  accessToken,
  linked,
  email,
  busy,
  onUnlink,
  unlinkBlocked,
  notice = null,
  onLinked,
}: {
  accessToken: string | null;
  linked: boolean;
  /** Привязанный адрес — подпись строки. */
  email?: string | null;
  busy: boolean;
  onUnlink: () => void;
  unlinkBlocked?: boolean;
  /** Возврат по ссылке из письма (?linked=email, ?error=…) — статус или причина у этой строки. */
  notice?: EmailLinkNotice | null;
  onLinked: () => void; // адрес привязан кодом из письма — перечитать способы входа
}) {
  const tr = useTr();
  const [showForm, setShowForm] = useState(false);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null); // код из письма не подошёл — под полем кода
  const inputRef = useRef<HTMLInputElement>(null);
  const stepUp = useStepUpFetch(); // у аккаунта с 2FA новый способ входа — только с кодом (S12)

  useEffect(() => {
    if (showForm && !linked && !sent) inputRef.current?.focus();
  }, [showForm, linked, sent]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await stepUp(sessionPost('/api/auth/email/link-to-account', accessToken, { email: value }));
      if (!res) return; // окно кода закрыто — письмо не отправлено, форма на месте
      if (!res.ok) throw new Error((await readHumanError(res, 'Не удалось отправить письмо')).message);
      setSent(true);
    } catch (e) {
      setError(humanizeThrown(e, 'Не удалось отправить письмо'));
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
        unlinkBlocked={unlinkBlocked}
        onLink={() => { setShowForm(true); setSent(false); setValue(''); }}
      />
      {notice?.kind === 'ok' && <p role="status" className="aa-field-ok"><OkMark />{notice.text}</p>}
      {notice?.kind === 'error' && !showForm && <p role="alert" className="aa-field-err">{notice.text}</p>}
      {!linked && <p className="aa-email-why">Почтой входят на сайт и в приложение на экране телефона. Пригодится и как запасной вход.</p>}
      {showForm &&
        !linked &&
        (sent ? (
          <div className="aa-email-sent">
            Если адрес свободен, письмо придёт в течение минуты на <b>{value}</b>.{' '}
            {tr('В письме — код и ссылка. Введи код здесь или перейди по ссылке в этом же браузере.', 'В письме — код и ссылка. Введите код здесь или перейдите по ссылке в этом же браузере.')}
            <EmailLinkCodeForm accessToken={accessToken} onLinked={onLinked} onError={setCodeError} error={codeError} />
            <button className="aa-email-again" onClick={() => { setSent(false); setValue(''); setCodeError(null); }}>
              Ввести другой email
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="aa-email-form">
            <input
              type="email"
              aria-invalid={error ? true : undefined}
              required
              ref={inputRef}
              placeholder="your@email.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="ds-input"
            />
            <button type="submit" disabled={sending} className="ds-btn ds-btn--sm ds-btn--secondary" aria-busy={sending || undefined}>
              {sending ? '…' : 'Отправить'}
            </button>
            {error && <p role="alert" className="aa-field-err aa-email-err">{error}</p>}
          </form>
        ))}
    </div>
  );
}
