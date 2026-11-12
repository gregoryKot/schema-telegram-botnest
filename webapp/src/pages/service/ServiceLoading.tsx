import { Skeleton } from '../../components/Skeleton';
import '../../styles/auth-service.css';

// Пока страница-посредник обрабатывает ответ (OAuth, письмо, виджет Telegram): силуэт итогового
// листа — того исхода (PaperOutcome) или страницы, куда человек попадёт: полоса бумаги сверху,
// заголовок, две строки и кнопка. Не крутилка и не текст-ожидание. Подпись статуса — если была.
export function ServiceLoading({ label }: { label?: string }) {
  return (
    <div className="light-lock as-root">
      <div className="as-card as-card--skel" role="status" aria-live="polite" aria-busy="true">
        <div className="as-skel-band" />
        <div className="as-main as-body">
          {label && <p className="ds-sub as-lead">{label}</p>}
          <Skeleton height={30} width="70%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="85%" />
          <div className="u-mt10"><Skeleton height={52} radius={26} /></div>
        </div>
      </div>
    </div>
  );
}
