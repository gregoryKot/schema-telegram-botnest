import { CANCEL_SUPPORT_LINK } from '../../components/booking/cancelPolicy';
import { useSubscriptionCancel } from './useSubscriptionCancel';

const btnSt: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline', marginTop: 4 };
const noteSt: React.CSSProperties = { color: 'var(--accent-red)', fontSize: 14, lineHeight: 1.6, margin: '12px 0 0' };
const linkSt: React.CSSProperties = { color: 'inherit', textDecoration: 'underline' };

// Кнопка «Отменить подписку» + честный итог отказа. Страница публичная, без
// useTr: формулировки безличные (инфинитив «можно написать»), поэтому ни
// «ты», ни «вы» в них нет — check-second-person.mjs такому не мешает.
export function CancelControl({ token, onCancelled }: { token: string; onCancelled: () => void }) {
  const { phase, cancel } = useSubscriptionCancel(token, onCancelled);
  const loading = phase === 'loading';
  const tg = <a href={CANCEL_SUPPORT_LINK} style={linkSt}>Telegram</a>;
  return (
    <>
      <button type="button" onClick={cancel} disabled={loading} style={{ ...btnSt, opacity: loading ? 0.5 : 1 }}>
        {loading ? 'Отменяю…' : 'Отменить подписку'}
      </button>
      {phase === 'stale' && (
        <p role="alert" style={noteSt}>Ссылка устарела. Если списания продолжаются, можно написать мне в {tg}.</p>
      )}
      {phase === 'error' && (
        <p role="alert" style={noteSt}>Не получилось отменить подписку, списания не остановлены. Можно попробовать ещё раз или написать мне в {tg}.</p>
      )}
    </>
  );
}
