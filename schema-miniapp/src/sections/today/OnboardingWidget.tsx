import { useState } from 'react';
import { UserProfile } from '../../types';

const ONBOARDING_DONE_KEY = 'onboarding_done';
const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped';

interface StepDef {
  id: string;
  emoji: string;
  color: string;
  title: string;
  description: string;
  detail: string;
  actionLabel: string;
  isDone: (
    profile: UserProfile | null,
    ctx?: { hasSchemas: boolean },
  ) => boolean;
}

const STEPS: StepDef[] = [
  {
    id: 'ysq',
    emoji: '🧪',
    color: 'var(--accent)',
    title: 'Тест на схемы',
    description:
      '116 вопросов, 10 минут. Покажет, какие ранние паттерны управляют реакциями.',
    detail: '20 схем · история прохождений · советы',
    actionLabel: 'Начать тест',
    isDone: (p, ctx) => !!p?.ysq.completedAt || !!ctx?.hasSchemas,
  },
  {
    id: 'tracker',
    emoji: '📊',
    color: 'var(--accent-blue)',
    title: 'Оценка потребностей сегодня',
    description:
      'Пять оценок — и виден индекс дня. Через неделю паттерн начнёт проявляться в графике.',
    detail: 'Привязанность · Автономия · Выражение · Радость · Границы',
    actionLabel: 'Перейти в трекер',
    isDone: (p) => !!p?.lastActivity.needsTracker,
  },
  {
    id: 'diary',
    emoji: '📔',
    color: 'var(--accent-indigo)',
    title: 'Первая запись в дневнике',
    description:
      'Зафиксировать момент, когда схема сработала — главная практика схема-терапии.',
    detail: 'Дневник схем · режимов · благодарности',
    isDone: (p) =>
      !!(
        p?.lastActivity.schemaDiary ||
        p?.lastActivity.modeDiary ||
        p?.lastActivity.gratitudeDiary
      ),
    actionLabel: 'Открыть дневник',
  },
  {
    id: 'notify',
    emoji: '🔔',
    color: 'var(--accent-orange)',
    title: 'Ежедневное напоминание',
    description:
      'Без регулярности ничего не выйдет. Одно уведомление в нужное время — всё что нужно.',
    detail: 'Время · часовой пояс · серии дней',
    actionLabel: 'Настроить',
    isDone: (p) => !!p?.notifications.enabled,
  },
  {
    id: 'childhood',
    emoji: '🌀',
    color: 'var(--accent-green)',
    title: 'Колесо детства',
    description:
      'Как удовлетворялись потребности в детстве — откуда пришли нынешние паттерны.',
    detail: '5 областей · связь с активными схемами',
    actionLabel: 'Открыть',
    isDone: () => !!localStorage.getItem('childhood_wheel_done'),
  },
];

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
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
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
          onClick={() => {
            localStorage.setItem(ONBOARDING_DONE_KEY, '1');
            setDone(true);
          }}
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
  if (!autoStep) {
    const postponedCount = STEPS.filter((s) => !s.isDone(profile, ctx)).length;
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
          onClick={() => {
            setSkipped([]);
            localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
            setSlideKey((k) => k + 1);
          }}
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
              onClick={() => {
                setSelectedId(s.id === current.id ? null : s.id);
                setSlideKey((k) => k + 1);
              }}
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
