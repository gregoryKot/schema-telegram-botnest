/**
 * Третичная строка-ссылка потока «Разбор случая» («Сегодня ровный день →»,
 * «Пропустить →» и т.п.) — вынесена из caseFlowUi.tsx в файл без импортов из
 * соседей по каталогу: её берут и CaseFlowFoot (caseFlowUi), и
 * CaseSupportFoot, а импорт из caseFlowUi дал бы цикл модулей. Twin по
 * смыслу с schema-miniapp caseFlowUi TertiaryLink: тактильный отклик
 * внутри (haptic.tap), вызывающему экрану достаточно onClick; разметка —
 * webapp-идиома «link».
 */
import { haptic } from '../../haptic';

export function TertiaryLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={() => { haptic.tap(); onClick(); }} className="ds-link ex2-link-row">
      {label}
    </button>
  );
}
