import { useState } from 'react';
import type { UserProfile } from '../../types';
import { pressable } from '../../utils/a11y';

// Онбординг-виджет «С чего начать» (чеклист первых шагов). Вынесено из
// TodaySection.tsx (правило №10).

const ONBOARDING_DONE_KEY    = 'onboarding_done';
const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped';

interface StepDef {
  id: string;
  color: string;
  title: string;
  description: string;
  detail: string;
  actionLabel: string;
  isDone: (profile: UserProfile | null, ctx?: { hasSchemas: boolean }) => boolean;
}

const STEPS: StepDef[] = [
  { id: 'ysq', color: 'var(--accent)',
    title: 'Тест на схемы',
    description: '116 вопросов, 10 минут. Покажет, какие ранние паттерны управляют реакциями.',
    detail: '20 схем · история прохождений · советы',
    actionLabel: 'Начать тест',
    isDone: (p, ctx) => !!(p?.ysq?.completedAt) || !!(ctx?.hasSchemas) },
  { id: 'tracker', color: 'var(--c-slate)',
    title: 'Оценка потребностей сегодня',
    description: 'Пять оценок – и виден индекс дня. Через неделю паттерн начнёт проявляться в графике.',
    detail: 'Привязанность · Автономия · Выражение · Радость · Границы',
    actionLabel: 'Перейти в трекер',
    isDone: p => !!(p?.lastActivity.needsTracker) },
  { id: 'diary', color: 'var(--accent-indigo)',
    title: 'Первая запись в дневнике',
    description: 'Зафиксировать момент, когда схема сработала – главная практика схема-терапии.',
    detail: 'Дневник схем · режимов · благодарности',
    actionLabel: 'Открыть дневник',
    isDone: p => !!(p?.lastActivity.schemaDiary || p?.lastActivity.modeDiary || p?.lastActivity.gratitudeDiary) },
  { id: 'notify', color: 'var(--c-clay)',
    title: 'Ежедневное напоминание',
    description: 'Одно уведомление в выбранное время – чтобы практика не держалась на памяти.',
    detail: 'Время · часовой пояс · серии дней',
    actionLabel: 'Настроить',
    isDone: p => !!(p?.notifications.enabled) },
  { id: 'childhood', color: 'var(--c-moss)',
    title: 'Колесо детства',
    description: 'Как удовлетворялись потребности в детстве – откуда пришли нынешние паттерны.',
    detail: '5 областей · связь с активными схемами',
    actionLabel: 'Открыть',
    isDone: () => !!localStorage.getItem('childhood_wheel_done') },
];

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

  if (done || profile === null) return null;

  const ctx = { hasSchemas };
  const doneCount = STEPS.filter(s => s.isDone(profile, ctx)).length;
  const allDone   = doneCount === STEPS.length;
  const autoStep  = STEPS.find(s => !s.isDone(profile, ctx) && !skipped.includes(s.id));

  if (allDone) {
    return (
      <div className="section" style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--c-moss)' }}>Старт пройден</div>
        <div className="text-md" style={{ maxWidth: 540, lineHeight: 1.55 }}>
          Все инструменты изучены – теперь начинается настоящая работа.
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
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

  function handleSkip(step: StepDef) {
    const next = [...skipped, step.id];
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, JSON.stringify(next));
    setSkipped(next);
    setSelectedId(null);
  }

  // Pending steps in order (not done, not postponed). Все отложены → пусты — но это не «нечего показывать».
  const pendingSteps = STEPS.filter(s => !s.isDone(profile, ctx) && !skipped.includes(s.id));
  const visibleStep = (selectedId ? STEPS.find(s => s.id === selectedId) : null) ?? pendingSteps[0] ?? autoStep ?? null;
  if (!visibleStep && skipped.length === 0) return null;

  return (
    <div className="section" style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
      <div className="section-head">
        <h3>С чего начать</h3>
        <span className="hint">{doneCount} из {STEPS.length} · {pendingSteps.length} впереди</span>
      </div>

      {/* Calm checklist – all steps as document lines */}
      {STEPS.map(s => {
        const isDone    = s.isDone(profile, ctx);
        const isSkipped = skipped.includes(s.id) && !isDone;
        const isCurrent = s.id === visibleStep?.id;
        return (
          <div key={s.id} className="list-line" style={{ cursor: 'pointer', opacity: isSkipped ? 0.5 : 1 }}
               {...pressable(() => setSelectedId(s.id))}>
            <span style={{
              width: 14, height: 14, borderRadius: 4,
              border: `1.5px solid ${isDone ? 'var(--c-moss)' : isCurrent ? 'var(--accent)' : 'var(--line-strong)'}`,
              background: isDone ? 'var(--c-moss)' : 'transparent',
              flexShrink: 0, marginTop: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#fff',
            }}>{isDone ? '✓' : ''}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-md" style={{ fontWeight: 600, opacity: isDone ? 0.6 : 1 }}>{s.title}</div>
              {isCurrent && !isDone && (
                <div className="text-sm muted" style={{ marginTop: 4, lineHeight: 1.55 }}>{s.description}</div>
              )}
            </div>
            {isCurrent && !isDone ? (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                <span
                  className="link"
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); handleSkip(s); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleSkip(s); } }}
                >
                  отложить
                </span>
                <span
                  className="link"
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); handleAction(s); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleAction(s); } }}
                >
                  начать →
                </span>
              </div>
            ) : isSkipped ? (
              <span className="text-xs faint">отложено</span>
            ) : !isDone ? (
              <span className="text-xs faint">в очереди</span>
            ) : null}
          </div>
        );
      })}

      {pendingSteps.length === 0 && skipped.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <span className="link" style={{ cursor: 'pointer' }}
                {...pressable(() => { setSkipped([]); localStorage.removeItem(ONBOARDING_SKIPPED_KEY); })}>
            вернуть отложенные →
          </span>
        </div>
      )}
    </div>
  );
}
