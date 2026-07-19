import { useState } from 'react';
import { UserProfile } from '../../types';
import { pressable } from '../../utils/a11y';
import { Props } from './types';
import {
  STEPS,
  ONBOARDING_DONE_KEY,
  ONBOARDING_SKIPPED_KEY,
} from './onboardingSteps';
import { OnboardingDoneCard, OnboardingResumeCard } from './OnboardingStates';

// ── Onboarding widget ────────────────────────────────────────────────────────

export function OnboardingWidget({
  profile,
  hasSchemas,
  onOpenSchema,
  onOpenAdvanced,
  onOpenTracker,
  onOpenDiaries,
  onOpenChildhoodWheel,
}: {
  profile: UserProfile | null;
  hasSchemas: boolean;
  onOpenSchema: Props['onOpenSchema'];
  onOpenAdvanced: Props['onOpenAdvanced'];
  onOpenTracker: Props['onOpenTracker'];
  onOpenDiaries: Props['onOpenDiaries'];
  onOpenChildhoodWheel: Props['onOpenChildhoodWheel'];
}) {
  const [skipped, setSkipped] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(ONBOARDING_SKIPPED_KEY) ?? '[]',
      ) as string[];
    } catch {
      return [];
    }
  });
  const [done, setDone] = useState(
    () => !!localStorage.getItem(ONBOARDING_DONE_KEY),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slideKey, setSlideKey] = useState(0);

  if (done || profile === null) return null;

  const ctx = { hasSchemas };
  const doneCount = STEPS.filter((s) => s.isDone(profile, ctx)).length;
  const allDone = doneCount === STEPS.length;
  const autoStep = STEPS.find(
    (s) => !s.isDone(profile, ctx) && !skipped.includes(s.id),
  );

  // All steps done → clean completion state
  if (allDone) {
    return (
      <OnboardingDoneCard
        onHide={() => {
          localStorage.setItem(ONBOARDING_DONE_KEY, '1');
          setDone(true);
        }}
      />
    );
  }

  // All non-done steps postponed → collapsed resume state
  if (!autoStep) {
    const postponedCount = STEPS.filter((s) => !s.isDone(profile, ctx)).length;
    return (
      <OnboardingResumeCard
        doneCount={doneCount}
        postponedCount={postponedCount}
        onResume={() => {
          setSkipped([]);
          localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
          setSlideKey((k) => k + 1);
        }}
      />
    );
  }

  const current =
    (selectedId ? STEPS.find((s) => s.id === selectedId) : null) ?? autoStep;
  const isCurrentDone = current.isDone(profile, ctx);
  const isCurrentSkipped = skipped.includes(current.id) && !isCurrentDone;

  function handleAction() {
    switch (current.id) {
      case 'ysq':
        onOpenSchema({ startTest: true });
        break;
      case 'tracker':
        onOpenTracker();
        break;
      case 'diary':
        onOpenDiaries();
        break;
      case 'notify':
        onOpenAdvanced();
        break;
      case 'childhood':
        onOpenChildhoodWheel();
        break;
    }
    setSelectedId(null);
  }

  function handleSkip() {
    const next = [...skipped, current.id];
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, JSON.stringify(next));
    setSkipped(next);
    setSelectedId(null);
    setSlideKey((k) => k + 1);
  }

  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.04)',
        border: '1px solid rgba(var(--fg-rgb),0.08)',
        borderRadius: 20,
        padding: '16px 18px',
        overflow: 'hidden',
      }}
    >
      <style>{`@keyframes obSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Progress counter */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-faint)',
          marginBottom: 14,
          letterSpacing: '0.05em',
        }}
      >
        {doneCount} из {STEPS.length} шагов выполнено
      </div>

      {/* Current step */}
      <div key={slideKey} style={{ animation: 'obSlide 0.2s ease-out' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              background: `color-mix(in srgb, ${current.color} 12%, transparent)`,
              border: `1.5px solid color-mix(in srgb, ${current.color} 24%, transparent)`,
            }}
          >
            {isCurrentDone ? '✓' : current.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.3,
                marginBottom: 3,
              }}
            >
              {current.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                fontWeight: 500,
              }}
            >
              {current.detail}
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          {current.description}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {isCurrentDone ? (
          <div
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 12,
              textAlign: 'center',
              background:
                'color-mix(in srgb, var(--accent-green) 10%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent-green) 22%, transparent)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent-green)',
            }}
          >
            ✓ Выполнено
          </div>
        ) : (
          <button
            onClick={handleAction}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 12,
              border: 'none',
              fontFamily: 'inherit',
              background: current.color,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {current.actionLabel}
          </button>
        )}
        {!isCurrentDone && (
          <button
            onClick={handleSkip}
            style={{
              padding: '11px 14px',
              borderRadius: 12,
              border: 'none',
              fontFamily: 'inherit',
              background: 'rgba(var(--fg-rgb),0.06)',
              color: isCurrentSkipped ? 'var(--accent)' : 'var(--text-faint)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {isCurrentSkipped ? 'Вернуть' : 'Позже'}
          </button>
        )}
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {STEPS.map((s) => {
          const d = s.isDone(profile, ctx);
          const sk = skipped.includes(s.id) && !d;
          const cur = s.id === current.id;
          return (
            <div
              key={s.id}
              {...pressable(() => {
                setSelectedId(s.id === current.id ? null : s.id);
                setSlideKey((k) => k + 1);
              })}
              style={{ cursor: 'pointer' }}
            >
              <div
                style={{
                  width: cur ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  transition: 'all 0.25s ease',
                  background: d
                    ? 'color-mix(in srgb, var(--accent-green) 65%, transparent)'
                    : sk
                      ? 'rgba(var(--fg-rgb),0.15)'
                      : cur
                        ? `color-mix(in srgb, ${current.color} 85%, transparent)`
                        : 'rgba(var(--fg-rgb),0.12)',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
