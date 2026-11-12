import type { CSSProperties, ReactNode } from 'react';
import { SignArt } from './art/SignArt';

/** Предупреждение экранов-решений /link и /account/merge (docs/design/APP_2026-11.md, b27): лист неба со
 *  знаком границы `Limits`, а не оранжевая плашка-«конфета». Стоит до кнопки, текст обычного размера и
 *  цвета текста — не тише прежней плашки. Классы am-warn* — styles/auth-account.css. */
export function WarnNote({ children }: { children: ReactNode }) {
  return (
    <div className="pp-paper am-warn" style={{ '--h': 240 } as CSSProperties}>
      <span className="am-warn-sign" aria-hidden="true"><SignArt sign="limits" size="row" /></span>
      <p className="am-warn-text">{children}</p>
    </div>
  );
}
