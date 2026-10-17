import { Skeleton } from '../../components/Skeleton';
import { ServicePage } from './ServicePage';

// Пока страница-посредник обрабатывает ответ (OAuth, письмо, виджет Telegram):
// силуэт карточки вместо крутилки. Текст статуса передаётся, если он был.
export function ServiceLoading({ label }: { label?: string }) {
  return (
    <ServicePage>
      <div className="as-body" role="status" aria-live="polite" aria-busy="true">
        {label && <p className="ds-sub as-lead">{label}</p>}
        <Skeleton height={26} width="70%" />
        <Skeleton height={14} />
        <Skeleton height={14} width="85%" />
      </div>
    </ServicePage>
  );
}
