import type { ClientDetail } from './clientSheetTypes';

// «+ Задание» и «+ Заметка» — одни обработчики на два места (#906): в шапке
// карточки на ноутбуке и первой строкой «Обзора» на телефоне; «+ Задание» — залитая главная в обоих местах
// (ревью r1: на 390 она была второстепенной, на 1280 — залитой). Кто рендерит, решает useIsMobile в
// ClientHeader и ClientOverviewTab — копия одна. Закреплённой панели на телефоне
// больше нет — решение владельца 2026-11-02 (REDESIGN_2026-10.md, «Листы и оверлеи»).
export function ClientQuickActions({ detail }: { detail: ClientDetail }) {
  const { setShowAssign, setClientTab } = detail;
  return (
    <div className="tk-quick">
      <button className="ds-btn ds-btn--sm" onClick={() => setShowAssign(true)}>+ Задание</button>
      <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setClientTab('sessions')}>+ Заметка</button>
    </div>
  );
}
