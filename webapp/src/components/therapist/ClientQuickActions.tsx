import type { ClientDetail } from './clientSheetTypes';

// «+ Задание» и «+ Заметка» — одни обработчики на два места (#906): в шапке
// карточки на ноутбуке (.tk-actions-main, первая кнопка primary) и первой строкой
// «Обзора» на телефоне (.tk-quick, обе secondary). Какая копия видна, решает
// therapist-card.css по ширине экрана. Закреплённой панели на телефоне больше
// нет — решение владельца 2026-11-02 (REDESIGN_2026-10.md, «Листы и оверлеи»).
export function ClientQuickActions({ detail, className, primary = false }: { detail: ClientDetail; className: string; primary?: boolean }) {
  const { setShowAssign, setClientTab } = detail;
  return (
    <div className={className}>
      <button className={primary ? 'ds-btn ds-btn--sm' : 'ds-btn ds-btn--sm ds-btn--secondary'} onClick={() => setShowAssign(true)}>+ Задание</button>
      <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setClientTab('sessions')}>+ Заметка</button>
    </div>
  );
}
