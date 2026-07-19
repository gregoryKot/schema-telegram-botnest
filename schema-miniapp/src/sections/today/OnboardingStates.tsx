import { STEPS } from './onboardingSteps';

// ── Onboarding terminal states: all-done + all-postponed ──────────────────────

// All steps done → clean completion state
export function OnboardingDoneCard({ onHide }: { onHide: () => void }) {
  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
        border:
          '1px solid color-mix(in srgb, var(--accent-green) 18%, transparent)',
        borderRadius: 20,
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <style>{`@keyframes obPop { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }`}</style>
      <div
        style={{
          fontSize: 36,
          marginBottom: 8,
          animation: 'obPop 0.4s ease-out',
        }}
      >
        ✓
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 6,
        }}
      >
        Все шаги пройдены
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        Все инструменты изучены — теперь начинается настоящая работа.
      </div>
      <button
        onClick={onHide}
        style={{
          width: '100%',
          padding: '13px 0',
          borderRadius: 14,
          border: 'none',
          fontFamily: 'inherit',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Скрыть
      </button>
    </div>
  );
}

// All non-done steps postponed → collapsed resume state
export function OnboardingResumeCard({
  doneCount,
  postponedCount,
  onResume,
}: {
  doneCount: number;
  postponedCount: number;
  onResume: () => void;
}) {
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.04)',
        border: '1px solid rgba(var(--fg-rgb),0.08)',
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 22 }}>📋</div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 2,
          }}
        >
          {postponedCount}{' '}
          {postponedCount === 1 ? 'шаг отложен' : 'шага отложено'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
          {doneCount} из {STEPS.length} выполнено
        </div>
      </div>
      <button
        onClick={onResume}
        style={{
          padding: '8px 14px',
          borderRadius: 10,
          border: 'none',
          fontFamily: 'inherit',
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Продолжить
      </button>
    </div>
  );
}
