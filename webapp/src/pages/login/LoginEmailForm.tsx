import { useEffect, useRef, useState } from 'react';
import { useTr } from '../../utils/addressForm';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

// Вход по ссылке из письма. Ошибки отдаёт наверх (общая строка ошибки страницы).
export function LoginEmailForm({ setError }: { setError: (e: string | null) => void }) {
  const tr = useTr();
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show && !sent) inputRef.current?.focus();
  }, [show, sent]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(value)) { setError(tr('Введи корректный email', 'Введите корректный email')); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/email/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `Ошибка ${res.status}`);
      setSent(true);
    } catch (err) {
      setError((err as Error).message || 'Не удалось отправить письмо');
    } finally {
      setLoading(false);
    }
  };

  if (!show) {
    return (
      <button className="al-linkbtn" onClick={() => { setShow(true); setError(null); }}>
        Войти по email
      </button>
    );
  }
  if (sent) {
    return (
      <div className="al-email-sent">
        <p>Письмо отправлено</p>
        <p>{tr('Проверь почту и перейди по ссылке — она действует 30 минут', 'Проверьте почту и перейдите по ссылке — она действует 30 минут')}</p>
        <button className="al-linkbtn" onClick={() => { setSent(false); setValue(''); }}>
          Ввести другой email
        </button>
      </div>
    );
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
