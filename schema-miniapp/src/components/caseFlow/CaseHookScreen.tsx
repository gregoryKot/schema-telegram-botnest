import { PrimaryAction } from '../diary/diaryFlowUi';
import { TertiaryLink } from './caseFlowUi';

/**
 * Точка входа потока. Без шапки (см. CaseFlowSheet — «кроме hook») и без
 * прогресса: три минуты человек ещё не начал считать.
 */
export function CaseHookScreen({
  onStart,
  onSteadyDay,
}: {
  onStart: () => void;
  onSteadyDay: () => void;
}) {
  return (
    <div>
      <div className="d-display" style={{ fontSize: 22, marginBottom: 10 }}>
        Что сегодня зацепило?
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        Крупное необязательно — хватит мелочи: сообщение, взгляд, тишина в
        ответ.
      </div>

      <PrimaryAction label="Разобрать свой случай" onClick={onStart} />

      <div
        style={{
          display: 'inline-block',
          marginTop: 12,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'var(--surface-2)',
          color: 'var(--muted)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        ≈ 3 минуты
      </div>

      <div style={{ marginTop: 10 }}>
        <TertiaryLink label="Сегодня ровный день →" onClick={onSteadyDay} />
      </div>
    </div>
  );
}
