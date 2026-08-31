import { createContext, useContext, type ReactNode } from 'react';
import { CrisisCard } from '../CrisisCard';
import { TertiaryLink } from './caseLinks';
import { useSupportCardReveal } from '../../../../shared/src/case/useCaseSupport';

/**
 * Карточка поддержки + строка «Тяжело прямо сейчас →» — низ каждого экрана
 * потока (правило №7 CLAUDE.md).
 *
 * Регрессия прода 2026-08-31: onHardNow был exitFlow — кризисный путь
 * выбрасывал человека из разбора на главную вместо помощи. Теперь hardNow
 * живёт в shared useHardNowSupport (внутри useCaseFlowState), а сюда
 * приезжает контекстом: экраны между CaseFlowScreen и CaseFlowFoot передают
 * свои пропсы как раньше, ничего нового не прокидывают. Twin schema-miniapp
 * CaseSupportFoot.tsx — там оркестратор один, контекст не нужен.
 */
interface CaseSupportState {
  hardNow: boolean;
  closeSupport: () => void;
}

const CaseSupportContext = createContext<CaseSupportState>({
  hardNow: false,
  closeSupport: () => {},
});

export function CaseSupportProvider({
  flow,
  children,
}: {
  flow: CaseSupportState;
  children: ReactNode;
}) {
  return (
    <CaseSupportContext.Provider
      value={{ hardNow: flow.hardNow, closeSupport: flow.closeSupport }}
    >
      {children}
    </CaseSupportContext.Provider>
  );
}

/**
 * Сам блок: карточка (текстовая детекция ИЛИ ручное открытие), над ручной —
 * «Вернуться к разбору ▲», ниже — строка-открывашка (спрятана, пока открыто
 * рукой; карточку от детекции «Вернуться» не прячет — та постоянная).
 */
export function CaseSupportBlock({
  crisis,
  onHardNow,
}: {
  crisis: boolean;
  onHardNow: () => void;
}) {
  const { hardNow, closeSupport } = useContext(CaseSupportContext);
  const revealRef = useSupportCardReveal(hardNow);
  return (
    <>
      {(crisis || hardNow) && (
        <div ref={revealRef} style={{ marginTop: 20 }}>
          {hardNow && (
            <TertiaryLink
              label="Вернуться к разбору ▲"
              onClick={closeSupport}
            />
          )}
          <CrisisCard surface="case" />
        </div>
      )}
      {!hardNow && (
        <TertiaryLink label="Тяжело прямо сейчас →" onClick={onHardNow} />
      )}
    </>
  );
}
