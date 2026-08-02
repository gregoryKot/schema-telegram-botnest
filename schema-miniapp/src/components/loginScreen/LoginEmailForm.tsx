import { useState, type FormEvent } from 'react';
import { useTr } from '../../utils/addressForm';
import { BASE } from '../../utils/apiBase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'open' | 'sending' | 'sent';

async function sendLink(email: string): Promise<void> {
  const res = await fetch(`${BASE}/api/auth/email/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-requested-with': 'miniapp', // CSRF-заголовок, как у сайта
    },
    body: JSON.stringify({ email }),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  throw new Error(body.message ?? `Ошибка ${res.status}`);
}

/** Вход по письму со ссылкой — тот же эндпоинт, что у сайта
 * (webapp/src/pages/LoginPage.tsx), вёрстка своя (правило CLAUDE.md №3). */
export function LoginEmailForm() {
  const tr = useTr();
  const [status, setStatus] = useState<Status>('idle');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError(tr('Введи корректный email', 'Введите корректный email'));
      return;
    }
    setError(null);
    setStatus('sending');
    try {
      await sendLink(email);
      setStatus('sent');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось отправить письмо',
      );
      setStatus('open');
    }
  };

  if (status === 'idle') {
    return (
      <button
        className="btn-ghost"
        style={{ width: '100%', marginTop: 12, minHeight: 44 }}
        onClick={() => setStatus('open')}
      >
        Войти по email
      </button>
    );
  }

  if (status === 'sent') {
    return (
      <div
        className="card"
        style={{ marginTop: 12, padding: '14px 16px', textAlign: 'center' }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
          Письмо отправлено
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: 0 }}>
          {tr(
            'Проверь почту и перейди по ссылке — она действует 30 минут',
            'Проверьте почту и перейдите по ссылке — она действует 30 минут',
          )}
        </p>
      </div>
    );
  }

  return (
    // noValidate: браузерный тултип конструктора валидации не звучит в
    // выбранной форме ты/вы и не показывается стабильно в PWA-режиме —
    // ошибку всегда показывает наш текст (правило CLAUDE.md «ошибки не глотаем»).
    <form onSubmit={submit} noValidate style={{ marginTop: 12 }}>
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '11px 14px',
          fontSize: 15,
          border: '1.5px solid var(--border-color)',
          borderRadius: 12,
          background: 'rgba(var(--fg-rgb), 0.04)',
          color: 'var(--text)',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          outline: 'none',
          marginBottom: 8,
        }}
      />
      <button
        type="submit"
        className="btn-primary"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Отправляем…' : 'Отправить ссылку'}
      </button>
      {error && (
        <p
          style={{
            color: 'var(--accent-red)',
            fontSize: 13,
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          {error}
        </p>
      )}
    </form>
  );
}
