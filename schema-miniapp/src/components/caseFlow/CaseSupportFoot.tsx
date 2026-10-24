import { CrisisCard } from '../CrisisCard';
import { TertiaryLink } from './caseFlowUi';
import { useSupportCardReveal } from '../../../../shared/src/case/useCaseSupport';

/**
 * Низ листа разбора: строка «Тяжело прямо сейчас →» и карточка поддержки.
 *
 * Регрессия прода 2026-08-31: строка звала onHardNow={close} — кризисный
 * путь (правило №7 CLAUDE.md) выбрасывал из разбора на главную вместо
 * помощи. Теперь тап открывает CrisisCard на месте (hardNow из shared
 * useHardNowSupport), «Вернуться к разбору ▲» прячет её, шаг и черновик не
 * трогаются. Карточка от текстовой детекции (crisis) — постоянная и без
 * «Вернуться»; строка-открывашка прячется, только пока открыто рукой.
 * Twin webapp CaseSupportFoot.tsx (там то же — через контекст).
 */
export function CaseSupportFoot({
  crisis,
  hardNow,
  onHardNow,
  onCloseSupport,
}: {
  crisis: boolean;
  hardNow: boolean;
  onHardNow: () => void;
  onCloseSupport: () => void;
}) {
  const revealRef = useSupportCardReveal(hardNow);
  return (
    <>
      {!hardNow && (
        <TertiaryLink label="Тяжело прямо сейчас →" onClick={onHardNow} muted />
      )}
      {(crisis || hardNow) && (
        <div ref={revealRef}>
          {hardNow && (
            <TertiaryLink
              label="Вернуться к разбору ▲"
              onClick={onCloseSupport}
            />
          )}
          <CrisisCard surface="case" />
        </div>
      )}
    </>
  );
}
