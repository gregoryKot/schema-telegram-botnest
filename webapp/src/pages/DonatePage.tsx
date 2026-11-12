import { useState } from 'react';
import { api, ApiError } from '../api';
import { PaperAlert } from '../components/paper/PaperAlert';
import { SignChip } from '../components/paper/SignChip';
import { ThanksSheet } from '../components/paper/ThanksSheet';
import { usePageShowReset } from '../hooks/usePageShowReset';
import { PayHero, PayLayout } from './subscribe/PayLayout';

const PRESETS = [200, 500, 1000, 2000];

// Публичная /donate (и возврат Robokassa ?donation=ok|fail): вне RequireAuth/AddressFormProvider,
// из Telegram/MAX открывается во внешнем браузере, на визитке — гость. Форма обращения неизвестна
// по построению → тексты безличные, без useTr (как SubscribeForm.tsx); useTr тут всегда дал бы «ты».
// Каркас — как у подписки (PayLayout): лист соломы со сценой и форма; суммы — чипы бумаги с галочкой.
export function DonatePage() {
  const params = new URLSearchParams(window.location.search);
  const ret = params.get('donation'); // 'ok' | 'fail' | null
  const [amount, setAmount] = useState(500);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'unavailable'>('idle');
  usePageShowReset(() => setStatus((s) => (s === 'loading' ? 'idle' : s))); // «Назад» с Robokassa — кнопка снова жива

  const submit = async () => {
    if (amount < 10) return;
    setStatus('loading');
    try {
      const res = await api.donate({ amount, source: 'app', email: email.trim() || undefined, website });
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      window.location.search = '?donation=ok'; // dev / unconfigured
    } catch (e) { setStatus(e instanceof ApiError && e.status === 503 ? 'unavailable' : 'error'); } // 503: оплата не настроена, повтор не поможет
  };

  if (ret === 'ok') return <ThanksSheet eyebrow="Разовая поддержка" title="Спасибо за поддержку!" lead="Это очень помогает развивать проект." action={{ label: 'На главную', href: '/' }} />;

  return (
    <PayLayout hero={<PayHero label="Разовая поддержка" title={<>Поддержать <i>проект</i></>} lead="«Всё по схеме» бесплатно. Если приложение полезно, его развитие можно поддержать любой суммой." />}>
      {ret === 'fail' && <PaperAlert title="Оплата не прошла. Можно попробовать снова." />}
      <div className="ap-sums" role="group" aria-label="Сумма">
        {PRESETS.map((p) => <SignChip key={p} label={`${p} ₽`} on={amount === p} onToggle={() => setAmount(p)} hue={70} />)}
      </div>
      <input type="number" className="ym-disable-keys ds-input" min={10} max={100000} value={amount} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value))))} placeholder="Своя сумма, ₽" />
      <input type="email" className="ym-disable-keys ds-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email для чека (необязательно)" />
      <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" className="ap-honey" />
      {status === 'unavailable' && <PaperAlert hue={45} className="ap-err" title="Оплата сейчас недоступна: сбой на стороне сайта, о нём уже знают. Повторять бесполезно, лучше вернуться позже." />}
      {status === 'error' && <PaperAlert className="ap-err" title="Не получилось. Попробовать ещё раз." />}
      <button type="button" onClick={submit} disabled={status === 'loading' || amount < 10} aria-busy={status === 'loading' || undefined} className="ds-btn ds-btn--accent ds-btn--lg ap-cta">
        {status === 'loading' ? 'Перехожу к оплате…' : `Поддержать ${amount.toLocaleString('ru-RU')} ₽`}
      </button>
      <p className="ap-fine">Оплата картой или СБП через Robokassa.<br />Добровольное пожертвование, возврату не подлежит.</p>
    </PayLayout>
  );
}
