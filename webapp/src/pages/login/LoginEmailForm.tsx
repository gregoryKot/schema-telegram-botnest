import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import { useResendPause } from './useResendPause';
import { LoginEmailSent } from './LoginEmailSent';
import { returnToForEmailLink } from '../../auth/emailReturnTo';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
const SEND_FAILED = 'Не удалось отправить письмо';

// Вход по ссылке из письма. Ошибки отдаёт наверх (общая строка ошибки страницы).
// `?via=email` открывает форму сразу: так ведёт «Ссылка устарела» (authErrorScreens.ts).
export function LoginEmailForm({ setError }: { setError: (e: string | null) => void }) {
  const { search } = useLocation();
  const [show, setShow] = useState(() => new URLSearchParams(search).get('via') === 'email');
  const [value, setValue] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pause = useResendPause();
  const inputRef = useRef<HTMLInputElement>(null);
  const sent = sentCount > 0;

  useEffect(() => { if (show && !sent) inputRef.current?.focus(); }, [show, sent]);

  // Первая отправка и «Отправить ещё раз» — один и тот же запрос.
  const send = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/email/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
        body: JSON.stringify({ email: value, returnTo: returnToForEmailLink() }), // письмо откроют новой вкладкой (E14)
      });
      if (!res.ok) throw new Error((await readHumanError(res, SEND_FAILED)).message);
      setSentCount(n => n + 1);
      pause.start();
    } catch (err) {
      setError(humanizeThrown(err, SEND_FAILED));
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(value)) { setError('Адрес почты выглядит неверно'); return; }
    void send();
  };

  if (!show) {
    return (
      <button className="al-linkbtn" onClick={() => { setShow(true); setError(null); }}>
        Войти по email
      </button>
    );
  }
  if (sent) {
    return <LoginEmailSent sentCount={sentCount} left={pause.left} loading={loading}
      onResend={() => void send()} onOtherEmail={() => { setSentCount(0); setValue(''); }} />;
  }
  return (
    <form onSubmit={submit} className="al-email">
      <input
        type="email"
        ref={inputRef}
        className="ds-input"
        placeholder="your@email.com"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <button type="submit" disabled={loading} className="al-submit">
        {loading ? 'Отправляем…' : 'Отправить ссылку'}
      </button>
      <button type="button" className="al-linkbtn" onClick={() => { setShow(false); setError(null); }}>
        Отмена
      </button>
    </form>
  );
}
