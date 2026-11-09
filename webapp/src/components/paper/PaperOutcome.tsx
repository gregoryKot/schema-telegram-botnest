// Полноэкранный исход (docs/design/APP_2026-11.md, «Исходы служебных страниц»): лист по центру —
// сверху полоса бумаги оттенка исхода со знаком крупно (тень-вырезка), под ней надпись, заголовок,
// лид, одна кнопка, тихая ссылка и строка «код для поддержки». Исход → знак и бумага — OUTCOME_LOOK
// (готово — Check на шалфее, граница удержана — Limits на небе, подожди или устарело — Cup на
// соломе, на нашей стороне — Breath на персике, обновилось — Leaf на шалфее). Для загрузки
// кабинета, ErrorBoundary, RouteErrorScreen, ConnectionTrouble, ServicePage, 404, /link, /merge,
// «спасибо». Страница может жить вне оболочки кабинета — лист всегда светлый (light-lock).
import type { CSSProperties, ReactNode } from 'react';
import { OUTCOME_LOOK, type Look, type OutcomeId } from '../../../../shared/src/theme/entityLook';
import { SignHero } from './SignHero';
import '../../styles/paper-app.css';

export interface OutcomeAction {
  label: ReactNode;
  onClick?: () => void;
  /** Ссылка вместо кнопки (переход на другую страницу сайта). */
  href?: string;
}

export interface PaperOutcomeProps {
  /** Исход из OUTCOME_LOOK или вид со знаком (Look — SheetLook со знаком: в полосе знак и есть смысл). */
  outcome: OutcomeId | Look;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  action?: OutcomeAction;
  link?: OutcomeAction;
  /** Строка для поддержки (код ошибки, id запроса) — моноширинно, мелко. */
  code?: ReactNode;
  /** Своё содержимое между лидом и кнопкой (поле кода, список). */
  children?: ReactNode;
  className?: string;
}

function ActionView({ action, cls }: { action: OutcomeAction; cls: string }) {
  return action.href
    ? <a className={cls} href={action.href} onClick={action.onClick}>{action.label}</a>
    : <button type="button" className={cls} onClick={action.onClick}>{action.label}</button>;
}

export function PaperOutcome({ outcome, eyebrow, title, lead, action, link, code, children, className }: PaperOutcomeProps) {
  const { hue, sign } = typeof outcome === 'string' ? OUTCOME_LOOK[outcome] : outcome;
  return (
    <div className={`light-lock pa-outcome${className ? ` ${className}` : ''}`} style={{ '--h': hue } as CSSProperties}>
      <div className="pa-outcome-card" data-sign={sign}>
        <div className="pp-paper pa-outcome-band" aria-hidden="true"><SignHero sign={sign} /></div>
        <div className="pa-outcome-body">
          {eyebrow && <span className="ds-eyebrow pa-outcome-eyebrow">{eyebrow}</span>}
          <h1 className="pa-outcome-title">{title}</h1>
          {lead && <p className="pa-outcome-lead">{lead}</p>}
          {children}
          {action && <ActionView action={action} cls="ds-btn ds-btn--lg pa-outcome-action" />}
          {link && <ActionView action={link} cls="ds-link pa-outcome-link" />}
          {code && <p className="pa-outcome-code">{code}</p>}
        </div>
      </div>
    </div>
  );
}
