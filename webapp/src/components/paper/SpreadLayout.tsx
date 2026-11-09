// Разворот на компьютере (docs/design/APP_2026-11.md, принцип 4) — как развороты шагов лендинга:
// на ≥1024 лист сущности (EntitySheet, иногда с подсказкой под ним) стоит слева колонкой
// 360–440px и не уезжает при прокрутке, форма — справа 520–600px, вместе не шире 1040 по
// центру. Уже 1024 — лист сверху компактной полосой, форма под ним: колонка ~520px посреди
// пустого экрана уходит. Один класс колонки на трекер, дооценку, разбор, дневник, «Мне плохо»,
// листы потребности. Отступ липкой колонки сверху — --pa-sticky-top у экрана (шапка листа).
import type { ReactNode } from 'react';
import '../../styles/paper-app.css';

export function SpreadLayout({ side, className, children }: { side: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={className ? `pa-spread ${className}` : 'pa-spread'}>
      <div className="pa-spread-side">{side}</div>
      <div className="pa-spread-main">{children}</div>
    </div>
  );
}
