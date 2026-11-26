// Текст итога без знака и корня: надпись, заголовок, лид, своё, действие строкой на линии, тихая ссылка, код.
// Им рисуют PaperOutcome и итоги записи (BookingPaidPage): один вид итога.
import type { ReactNode } from 'react';
import { glueSpaces } from '../../../../shared/src/utils/typo';

/** Кнопка или ссылка (`href` — переход на другую страницу сайта). */
export interface OutcomeAction { label: ReactNode; onClick?: () => void; href?: string }

export interface OutcomeBodyProps {
  eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode;
  action?: OutcomeAction; link?: OutcomeAction;
  /** Строка для поддержки (код ошибки, id запроса) — моноширинно, мелко. */
  code?: ReactNode;
  /** Своё содержимое между лидом и действием (поле кода, список). */
  children?: ReactNode;
}

function ActionView({ action, cls }: { action: OutcomeAction; cls: string }) {
  return action.href
    ? <a className={cls} href={action.href} onClick={action.onClick}>{action.label}</a>
    : <button type="button" className={cls} onClick={action.onClick}>{action.label}</button>;
}

export function OutcomeBody({ eyebrow, title, lead, action, link, code, children }: OutcomeBodyProps) {
  return (
    <div className="pa-outcome-body">
      {eyebrow && <span className="ds-eyebrow pa-outcome-eyebrow">{eyebrow}</span>}
      <h1 className="pa-outcome-title">{typeof title === 'string' ? glueSpaces(title) : title}</h1>
      {lead && <p className="pa-outcome-lead">{lead}</p>}
      {children}
      {action && <ActionView action={action} cls="ds-btn ds-btn--lg pa-outcome-action" />}
      {link && <ActionView action={link} cls="ds-link pa-quiet" />}
      {code && <p className="pa-outcome-code">{code}</p>}
    </div>
  );
}
