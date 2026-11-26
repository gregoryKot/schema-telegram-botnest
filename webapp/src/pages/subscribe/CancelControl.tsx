import { CANCEL_SUPPORT_LINK } from '../../components/booking/cancelPolicy';
import { useSubscriptionCancel } from './useSubscriptionCancel';

import { PaperAlert } from '../../components/paper/PaperAlert';
const btnSt: React.CSSProperties = { minHeight: 44 }; // тап-цель ≥44 и на телефоне; вид — ds-btn--secondary (действие экрана одно, разрушительное — не залитое)
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
      <button type="button" onClick={cancel} disabled={loading} aria-busy={loading || undefined} className="ds-btn ds-btn--secondary ds-btn--lg ap-cancel" style={btnSt}>
        {loading ? 'Отменяю…' : 'Отменить подписку'}
      </button>
      {phase === 'stale' && (
        <PaperAlert hue={70} title={<>Ссылка устарела. Если списания продолжаются, можно написать мне в {tg}.</>} />
      )}
      {phase === 'error' && (
        <PaperAlert hue={45} title={<>Не получилось отменить подписку, списания не остановлены. Можно попробовать ещё раз или написать мне в {tg}.</>} />
      )}
    </>
  );
}
