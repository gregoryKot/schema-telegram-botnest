import { useState } from 'react';
import type { UserProfile } from '../../types';
import { pressable } from '../../utils/a11y';
import '../../styles/sheet-tasks.css';
import { useIsMobile } from '../../components/useIsMobile';
import { OnboardingPhoneCard } from './OnboardingPhoneCard';
import { STEPS, ONBOARDING_DONE_KEY, ONBOARDING_SKIPPED_KEY, type StepDef } from './onboardingSteps';

// Онбординг-виджет «С чего начать» (чеклист первых шагов). Вынесено из
// TodaySection.tsx (правило №10).

interface OnboardingProps {
  profile: UserProfile | null;
  hasSchemas: boolean;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs' | 'schemas' | 'modes'; highlight?: string }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
}

export function OnboardingWidget({ profile, hasSchemas, onOpenSchema, onOpenAdvanced, onOpenTracker, onOpenDiaries, onOpenChildhoodWheel }: OnboardingProps) {
  const [skipped, setSkipped] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(ONBOARDING_SKIPPED_KEY) ?? '[]'); } catch { return []; }
  });
  const [done,       setDone]       = useState(() => !!localStorage.getItem(ONBOARDING_DONE_KEY));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const phone = useIsMobile();

  if (done || profile === null) return null;

  const ctx = { hasSchemas };
  const doneCount = STEPS.filter(s => s.isDone(profile, ctx)).length;
  const allDone   = doneCount === STEPS.length;
  const autoStep  = STEPS.find(s => !s.isDone(profile, ctx) && !skipped.includes(s.id));

  if (allDone) {
    return (
      <div className="ds-card sk-onb">
        <div className="ds-eyebrow sk-onb-ok">Старт пройден</div>
        <div className="sk-onb-done-text">
          Все инструменты изучены – теперь начинается настоящая работа.
        </div>
        <div>
          <button className="ds-link"
                  onClick={() => { localStorage.setItem(ONBOARDING_DONE_KEY, '1'); setDone(true); }}>
            скрыть →
          </button>
        </div>
      </div>
    );
  }

  function handleAction(step: StepDef) {
    switch (step.id) {
      case 'ysq':       onOpenSchema({ startTest: true }); break;
      case 'tracker':   onOpenTracker(); break;
      case 'diary':     onOpenDiaries(); break;
      case 'notify':    onOpenAdvanced(); break;
      case 'childhood': onOpenChildhoodWheel(); break;
    }
    setSelectedId(null);
  }

  // «Отложить» шага, который уже отложен, возвращает его в очередь.
  function handleSkip(step: StepDef) {
    const next = skipped.includes(step.id) ? skipped.filter(id => id !== step.id) : [...skipped, step.id];
    if (next.length > 0) localStorage.setItem(ONBOARDING_SKIPPED_KEY, JSON.stringify(next));
    else localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
    setSkipped(next);
    setSelectedId(null);
  }

  // Pending steps in order (not done, not postponed). Все отложены → пусты — но это не «нечего показывать».
  const pendingSteps = STEPS.filter(s => !s.isDone(profile, ctx) && !skipped.includes(s.id));
  const visibleStep = (selectedId ? STEPS.find(s => s.id === selectedId) : null) ?? pendingSteps[0] ?? autoStep ?? null;
  if (!visibleStep && skipped.length === 0) return null;

  // Телефон: одна карточка текущего шага (как в мини-аппе), не полный чеклист.
  if (phone) {
    return (
      <OnboardingPhoneCard
        steps={STEPS}
        isDone={s => s.isDone(profile, ctx)}
        skipped={skipped}
        current={visibleStep}
        doneCount={doneCount}
        onSelect={setSelectedId}
        onAction={handleAction}
        onSkip={handleSkip}
        onResume={() => { setSkipped([]); localStorage.removeItem(ONBOARDING_SKIPPED_KEY); }}
      />
    );
  }

  return (
    <div className="ds-card sk-onb">
      <div className="ds-head-row">
        <h3 className="ds-h3">С чего начать</h3>
        <span className="ds-sub">{doneCount} из {STEPS.length} · {pendingSteps.length} впереди</span>
      </div>

      {/* Calm checklist – all steps as document lines */}
      {STEPS.map(s => {
        const isDone    = s.isDone(profile, ctx);
        const isSkipped = skipped.includes(s.id) && !isDone;
        const isCurrent = s.id === visibleStep?.id;
        return (
          // Контейнер строки НЕ role="button" (axe nested-interactive): внутри
          // живут настоящие кнопки «отложить»/«вернуть», а вложенный интерактив
          // ломает скринридер — непонятно, что именно нажимается. Клавиатурный
          // вход в шаг даёт заголовок-кнопка ниже; клик по всей строке остаётся
          // для мыши/тапа.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div key={s.id} className={'sk-onb-row' + (isSkipped ? ' is-skipped' : '')}
               onClick={() => setSelectedId(s.id)}>
            <span className={'sk-onb-box' + (isDone ? ' is-done' : isCurrent ? ' is-current' : '')}>{isDone ? '✓' : ''}</span>
            <div className="sk-onb-main">
              {/* Заголовок — единственный таб-стоп строки (см. комментарий у
                  контейнера). Приглушение выполненного шага — цветом, а не
                  opacity: 0.6 давала 4.41:1 при норме 4.5 (axe, WCAG 1.4.3). */}
              <div
                className={'sk-onb-title' + (isDone ? ' is-done' : '')}
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); setSelectedId(s.id); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(s.id); } }}
              >{s.title}</div>
              {isCurrent && !isDone && (
                <div className="ds-sub sk-onb-desc">{s.description}</div>
              )}
            </div>
            {isCurrent && !isDone ? (
              <div className="sk-onb-actions">
                <span
                  className="ds-link"
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); handleSkip(s); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleSkip(s); } }}
                >
                  отложить
                </span>
                <span
                  className="ds-link"
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); handleAction(s); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleAction(s); } }}
                >
                  начать →
                </span>
              </div>
            ) : isSkipped ? (
              <span className="ds-sub">отложено</span>
            ) : !isDone ? (
              <span className="ds-sub">в очереди</span>
            ) : null}
          </div>
        );
      })}

      {pendingSteps.length === 0 && skipped.length > 0 && (
        <div>
          <span className="ds-link"
                {...pressable(() => { setSkipped([]); localStorage.removeItem(ONBOARDING_SKIPPED_KEY); })}>
            вернуть отложенные →
          </span>
        </div>
      )}
    </div>
  );
}
