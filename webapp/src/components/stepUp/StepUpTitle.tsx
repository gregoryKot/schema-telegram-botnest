import type { CSSProperties } from 'react';
import { SignArt } from '../art/SignArt';
import '../../styles/auth-account.css'; // su-*

/** Заголовок окна кода 2FA: знак границы `Limits` на листе неба (2FA — 240, APP_2026-11.md, b27) — окно
 *  про доступ, а не про сбой; заголовок — тот же ds-h2 диалога. */
export function StepUpTitle({ title }: { title: string }) {
  return (
    <div className="su-head">
      <span className="pp-paper su-sign" style={{ '--h': 240 } as CSSProperties} aria-hidden="true"><SignArt sign="limits" size="row" /></span>
      <h2 className="ds-h2 sk-dialog-title">{title}</h2>
    </div>
  );
}
