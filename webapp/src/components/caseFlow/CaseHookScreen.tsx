import { CASE_HOOK_LEDE } from '../../../../shared/src/onboarding/onboardingExplainers';
import { ExScreen } from '../exercises/ExScreen';
import { TertiaryLink } from './caseLinks';
import { CaseSupportBlock } from './CaseSupportFoot';

/**
 * Точка входа потока (шаг 0) — twin schema-miniapp CaseHookScreen.tsx. goBack
 * здесь закрывает весь экран целиком: до сцены ещё нечего откатывать.
 */
export function CaseHookScreen({
  onBack,
  onStart,
  onSteadyDay,
  onHardNow,
}: {
  onBack: () => void;
  onStart: () => void;
  onSteadyDay: () => void;
  onHardNow: () => void;
}) {
  return (
    <ExScreen
      onBack={onBack}
      backLabel="Закрыть"
      eyebrow="Разбор случая"
      title="Что сегодня зацепило?"
      lede={CASE_HOOK_LEDE}
    >
      <button
        type="button"
        className="ds-btn"
        onClick={onStart}
      >
        Разобрать свой случай
      </button>
      <div className="ex2-gap">
        <span className="ds-badge">≈ 3 минуты</span>
      </div>
      <div>
        <TertiaryLink label="Сегодня ровный день →" onClick={onSteadyDay} />
        <CaseSupportBlock crisis={false} onHardNow={onHardNow} />
      </div>
    </ExScreen>
  );
}
