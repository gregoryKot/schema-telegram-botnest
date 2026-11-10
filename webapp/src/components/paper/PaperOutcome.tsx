// Полноэкранный исход (docs/design/APP_2026-11.md, «Исходы служебных страниц»): лист по центру — полоса
// бумаги исхода со знаком крупно (тень-вырезка), надпись, заголовок, лид, одна кнопка, тихая ссылка, «код
// для поддержки». Для загрузки кабинета, ErrorBoundary, RouteErrorScreen, ConnectionTrouble, ServicePage,
// 404, /link, /merge, «спасибо». Страница может жить вне оболочки кабинета — лист всегда светлый (light-lock).
import type { ReactNode } from 'react';
import type { Look, OutcomeId } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { OUTCOME_LOOK_LIT } from './outcomeLook';
import { SignHero } from './SignHero';

/** Кнопка или ссылка (`href` — переход на другую страницу сайта). */
export interface OutcomeAction { label: ReactNode; onClick?: () => void; href?: string }

export interface PaperOutcomeProps {
  /** Исход из OUTCOME_LOOK или вид со знаком (Look — SheetLook со знаком: в полосе знак и есть смысл). */
  outcome: OutcomeId | Look;
  eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode;
  action?: OutcomeAction; link?: OutcomeAction;
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
  const { hue, sign } = typeof outcome === 'string' ? OUTCOME_LOOK_LIT[outcome] : outcome; // литералы — outcomeLook.ts
  return (
    <div className={`light-lock pa-outcome${className ? ` ${className}` : ''}`} style={hueStyle(hue)}>
      <div className="pa-outcome-card" data-sign={sign}>
        <div className="pp-paper pa-outcome-band" aria-hidden="true"><SignHero sign={sign} /></div>
        <div className="pa-outcome-body">
          {eyebrow && <span className="ds-eyebrow pa-outcome-eyebrow">{eyebrow}</span>}
          <h1 className="pa-outcome-title">{title}</h1>
          {lead && <p className="pa-outcome-lead">{lead}</p>}
          {children}
          {action && <ActionView action={action} cls="ds-btn ds-btn--lg pa-outcome-action" />}
          {link && <ActionView action={link} cls="ds-link pa-quiet" />}
          {code && <p className="pa-outcome-code">{code}</p>}
        </div>
      </div>
    </div>
  );
}
