import type { CSSProperties, ReactNode } from 'react';
import { SignArt } from './art/SignArt';

/** Предупреждение экранов-решений /link и /account/merge (docs/design/APP_2026-11.md, b27): тёплый лист
 *  персика (45) со знаком границы `Limits` и тенью-слоем, а не оранжевая плашка-«конфета». Небесный лист
 *  терялся под небесной сценой (ревью b27) — персик здесь единственное тёплое пятно, как прежняя янтарная
 *  плашка. Стоит до галочки и кнопки, текст обычного размера, цвета --text. Классы am-warn* — auth-account.css. */
export function WarnNote({ children }: { children: ReactNode }) {
  return (
    <div className="pp-paper am-warn" style={{ '--h': 45 } as CSSProperties}>
      <span className="am-warn-sign" aria-hidden="true"><SignArt sign="limits" size="row" /></span>
      <div className="am-warn-text">{children}</div>
    </div>
  );
}
