import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Знак «Всё по схеме» в боковом меню ведёт на главную раздела (владелец 2026-11: «логотип
// должен кидать на главную»). В силуэте загрузки и на лендинге знак — без этой ссылки
// (SidebarRail.tsx). Зона нажатия 44px при знаке 32px — .sb-home в index.css.

/** Меню, в котором стоит знак: от режима зависит, какая «Сегодня» — главная. */
export type BrandMenu = { therapistMode: boolean };

/** Знак ссылкой на главную раздела: «Сегодня» клиента или «Сегодня» кабинета терапевта. */
export function BrandHomeLink({ therapistMode, children }: BrandMenu & { children: ReactNode }) {
  return (
    <Link to={therapistMode ? '/cabinet/today' : '/today'} className="sb-home" aria-label="На главную" title="На главную">
      {children}
    </Link>
  );
}
