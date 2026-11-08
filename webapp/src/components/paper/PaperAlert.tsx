// Сбой строкой (docs/design/APP_2026-11.md, принцип 8: пусто ≠ сбой ≠ загрузка): лист соломы без
// контура рядом с блоком, который не загрузился или не сохранился, — бледный знак сущности, первая
// фраза 15/600, вторая тише, «Повторить» второстепенной кнопкой (на телефоне во всю ширину).
// Заменяет красные строки, cpf-error, st-err и ds-card--warn; на нём же SaveErrorNote. Тревожного
// красного нет: сбой — не вина человека, данные на месте.
import type { CSSProperties, ReactNode } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import '../../styles/paper-app.css';

export interface PaperAlertProps {
  title: ReactNode;
  text?: ReactNode;
  /** Знак сущности блока — бледно, строкой. */
  sign?: SignKey;
  /** Бумага; по умолчанию солома (70) — «подожди, ничего страшного». */
  hue?: number;
  onRetry?: () => void;
  retryLabel?: ReactNode;
  /** Повтор идёт — кнопка неактивна. */
  retrying?: boolean;
  /** alert — сбой случился сейчас; status — спокойное напоминание (уже показанный сбой). */
  role?: 'alert' | 'status';
  className?: string;
}

export function PaperAlert({ title, text, sign, hue = 70, onRetry, retryLabel = 'Повторить', retrying, role = 'alert', className }: PaperAlertProps) {
  return (
    <div className={className ? `pp-paper pa-alert ${className}` : 'pp-paper pa-alert'} role={role} style={{ '--h': hue } as CSSProperties}>
      {sign && <span className="pa-alert-sign" aria-hidden="true"><SignArt sign={sign} size="row" /></span>}
      <div className="pa-alert-body">
        <p className="pa-alert-title">{title}</p>
        {text && <p className="pa-alert-text">{text}</p>}
      </div>
      {onRetry && (
        <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm pa-alert-retry" onClick={onRetry} disabled={retrying}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
