import type { ReactNode } from 'react';
import { CaseSupportBlock } from './CaseSupportFoot';

/**
 * Нижняя панель шага потока «Что случилось» (webapp): главная кнопка справа,
 * вторичное действие (children), карточка поддержки и «Тяжело прямо сейчас →»
 * (CaseSupportBlock) — на каждом экране потока (правило №7 CLAUDE.md), не
 * только там, где стоит текстовое поле. Черновик пишется сам, поэтому
 * «Дописать потом» не нужно: «Назад» на первом шаге и есть выход.
 * TertiaryLink живёт в caseLinks.tsx (иначе цикл модулей с CaseSupportFoot).
 */
export function CaseFlowFoot({
  primaryLabel,
  primaryDisabled,
  onPrimary,
  crisis,
  onHardNow,
  children,
}: {
  /** Опущен на экранах, где сам тап по варианту продвигает поток (выбор
   *  режима) — отдельной кнопки «Дальше» там нет. */
  primaryLabel?: string;
  primaryDisabled?: boolean;
  onPrimary?: () => void;
  crisis: boolean;
  onHardNow: () => void;
  /** Вторичное действие шага («Не похоже…») — между кнопками и поддержкой. */
  children?: ReactNode;
}) {
  return (
    <>
      {primaryLabel && (
        <div className="ex2-foot">
          <span className="ex2-spacer" />
          {primaryLabel && onPrimary && (
            <button
              type="button"
              className="ds-btn"
              disabled={primaryDisabled}
              onClick={onPrimary}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      )}
      {children}
      <CaseSupportBlock crisis={crisis} onHardNow={onHardNow} />
    </>
  );
}
