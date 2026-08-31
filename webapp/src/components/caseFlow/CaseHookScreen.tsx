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
      eyebrowColor="var(--accent-indigo)"
      title="Что сегодня зацепило?"
      lede="Крупное необязательно — хватит мелочи: сообщение, взгляд, тишина в ответ."
    >
      <button
        type="button"
        className="ex-btn ex-btn-primary"
        onClick={onStart}
      >
        Разобрать свой случай
      </button>
      <div
        style={{
          display: 'inline-block',
          marginTop: 14,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'var(--surface-2)',
          color: 'var(--text-sub)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        ≈ 3 минуты
      </div>
      <div style={{ marginTop: 8 }}>
        <TertiaryLink label="Сегодня ровный день →" onClick={onSteadyDay} />
        <CaseSupportBlock crisis={false} onHardNow={onHardNow} />
      </div>
    </ExScreen>
  );
}
