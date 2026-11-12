// Привязка email в кабинете: строка способа входа, «зачем» (почтой входят на сайт),
// форма адреса и экран с кодом из письма. После отправки не обещаем
// «письмо отправлено»: ответ одинаков для свободного и занятого адреса (B-16).
import { useEffect, useRef, useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { EmailIcon, ProviderRow } from './ProviderRows';
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
  onError,
  onLinked,
}: {
  accessToken: string | null;
  linked: boolean;
  /** Привязанный адрес — подпись строки. */
  email?: string | null;
  busy: boolean;
  onUnlink: () => void;
  unlinkBlocked?: boolean;
  /** Ошибку показывает страница одним блоком на весь кабинет. */
  onError: (message: string | null) => void;
  onLinked: () => void; // адрес привязан кодом из письма — перечитать способы входа
}) {
  const tr = useTr();
  const [showForm, setShowForm] = useState(false);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stepUp = useStepUpFetch(); // у аккаунта с 2FA новый способ входа — только с кодом (S12)

  useEffect(() => {
    if (showForm && !linked && !sent) inputRef.current?.focus();
  }, [showForm, linked, sent]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    onError(null);
    try {
      const res = await stepUp(sessionPost('/api/auth/email/link-to-account', accessToken, { email: value }));
      if (!res) return; // окно кода закрыто — письмо не отправлено, форма на месте
      if (!res.ok) throw new Error((await readHumanError(res, 'Не удалось отправить письмо')).message);
      setSent(true);
    } catch (e) {
      onError(humanizeThrown(e, 'Не удалось отправить письмо'));
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
        onLink={() => {
          setShowForm(true);
          setSent(false);
          setValue('');
        }}
      />
      {!linked && <p className="aa-email-why">Почтой входят на сайт и в приложение на экране телефона. Пригодится и как запасной вход.</p>}
      {showForm &&
        !linked &&
        (sent ? (
          <div className="aa-email-sent">
            Если адрес свободен, письмо придёт в течение минуты на <b>{value}</b>.{' '}
            {tr('В письме — код и ссылка. Введи код здесь или перейди по ссылке в этом же браузере.', 'В письме — код и ссылка. Введите код здесь или перейдите по ссылке в этом же браузере.')}
            <EmailLinkCodeForm accessToken={accessToken} onLinked={onLinked} onError={onError} />
            <button className="aa-email-again" onClick={() => { setSent(false); setValue(''); }}>
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
