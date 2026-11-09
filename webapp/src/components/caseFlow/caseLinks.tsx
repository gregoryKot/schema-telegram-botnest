/**
 * Третичная строка-ссылка потока «Разбор случая» («Не похоже — другие режимы», «Тяжело прямо
 * сейчас →»): её берут CaseFlowFoot и CaseSupportFoot, отдельный файл — без цикла модулей.
 * `lead` — знак или SVG-шеврон перед подписью (глифов ▲ в тексте нет). Отклик — haptic.tap.
 */
import type { ReactNode } from 'react';
import { haptic } from '../../haptic';

export function TertiaryLink({ label, lead, onClick }: { label: string; lead?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { haptic.tap(); onClick(); }} className="ds-link ex2-link-row cq-link">
      {lead && <span className="cq-link-lead" aria-hidden="true">{lead}</span>}
      {label}
    </button>
  );
}
