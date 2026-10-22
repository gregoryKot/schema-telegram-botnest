import { useState } from 'react';
import { api, ApiError } from '../api';
import '../styles/auth-pay.css';

const PRESETS = [200, 500, 1000, 2000];

// Публичная /donate (и возврат Robokassa ?donation=ok|fail): вне RequireAuth/AddressFormProvider,
// из Telegram/MAX открывается во внешнем браузере, на визитке — гость. Форма обращения неизвестна
// по построению → тексты безличные, без useTr (как SubscribeForm.tsx); useTr тут всегда дал бы «ты».
export function DonatePage() {
  const params = new URLSearchParams(window.location.search);
  const ret = params.get('donation'); // 'ok' | 'fail' | null
  const [amount, setAmount] = useState(500);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'unavailable'>('idle');

  const submit = async () => {
    if (amount < 10) return;
    setStatus('loading');
    try {
      const res = await api.donate({ amount, source: 'app', email: email.trim() || undefined, website });
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      window.location.search = '?donation=ok'; // dev / unconfigured
    } catch (e) { setStatus(e instanceof ApiError && e.status === 503 ? 'unavailable' : 'error'); } // 503: оплата не настроена, повтор не поможет
  };

  return (
    <div className="light-lock ap-page ap-page--center">
      <div className="ds-card ap-donate">
        {ret === 'ok' ? (
          <div className="ap-thanks">
            <h1 className="ap-h1 ap-h1--sm">Спасибо за поддержку!</h1>
            <p className="ap-lead">Это очень помогает развивать проект.</p>
          </div>
        ) : (
          <>
            <div className="ds-eyebrow">Разовая поддержка</div>
            <h1 className="ap-h1">Поддержать <i>проект</i></h1>
            <p className="ap-lead">«Всё по схеме» бесплатно. Если приложение полезно, его развитие можно поддержать любой суммой.</p>
            {ret === 'fail' && <p className="ap-err" role="alert">Оплата не прошла. Можно попробовать снова.</p>}

            <div className="ap-amounts">
              {PRESETS.map((p) => (
                <button key={p} type="button" aria-pressed={amount === p} onClick={() => setAmount(p)} className={`ap-amount${amount === p ? ' is-on' : ''}`}>{p} ₽</button>
              ))}
            </div>
            <input type="number" className="ym-disable-keys ds-input ap-input" min={10} max={100000} value={amount} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value))))} placeholder="Своя сумма, ₽" />
            <input type="email" className="ym-disable-keys ds-input ap-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email для чека (необязательно)" />
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" className="ap-honey" />

            {(status === 'error' || status === 'unavailable') && <p className="ap-err" role="alert">{status === 'unavailable' ? 'Оплата сейчас недоступна: сбой на стороне сайта, о нём уже знают. Повторять бесполезно, лучше вернуться позже.' : 'Не получилось. Попробовать ещё раз.'}</p>}
            <button type="button" onClick={submit} disabled={status === 'loading' || amount < 10} className="ds-btn ds-btn--accent ap-donate-cta">
              {status === 'loading' ? 'Перехожу к оплате…' : `Поддержать ${amount.toLocaleString('ru-RU')} ₽`}
            </button>
            <p className="ap-fine">Оплата картой или СБП через Robokassa.<br />Добровольное пожертвование, возврату не подлежит.</p>
          </>
        )}
        <a href="/" className="ap-back">← На главную</a>
      </div>
    </div>
  );
}
