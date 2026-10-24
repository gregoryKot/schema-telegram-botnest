import { UserProfile } from '../../types';

// ── Onboarding steps definition ──────────────────────────────────────────────

export const ONBOARDING_DONE_KEY = 'onboarding_done';
export const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped';

// Ж10 (аудит 2026-08): та же видимость, что решает OnboardingWidget.tsx
// (`if (done || profile === null) return null;`) — нужна и вовне (TodayBlocks
// сворачивает вторичный блок, пока виден виджет обучения). Один источник
// правды на ключ ONBOARDING_DONE_KEY, а не вторая копия условия.
export function isOnboardingWidgetVisible(
  profile: UserProfile | null,
): boolean {
  return profile !== null && !localStorage.getItem(ONBOARDING_DONE_KEY);
}

export interface StepDef {
  id: string;
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

export const STEPS: StepDef[] = [
  {
    id: 'ysq',
    color: 'var(--accent)',
    title: 'Тест на схемы',
    description:
      '116 вопросов, 10 минут. Покажет, какие ранние паттерны управляют реакциями.',
    detail: '20 схем · история прохождений · советы',
    actionLabel: 'Начать тест',
    isDone: (p, ctx) => !!p?.ysq?.completedAt || !!ctx?.hasSchemas,
  },
  {
    id: 'tracker',
    color: 'var(--accent-blue)',
    title: 'Оценка потребностей сегодня',
    description:
      'Пять базовых эмоциональных потребностей из схема-терапии — по одной оценке на каждую. Через 3–5 дней в графике видно, что питает, а что истощает.',
    detail: 'Привязанность · Автономия · Выражение · Спонтанность · Границы',
    actionLabel: 'Перейти в трекер',
    isDone: (p) => !!p?.lastActivity.needsTracker,
  },
  {
    id: 'diary',
    color: 'var(--accent-indigo)',
    title: 'Первая запись в дневнике',
    description:
      'Записать момент, который задел, и увидеть, какая схема за ним стоит. Записи собираются в карту повторяющихся реакций.',
    detail: 'Дневник схем · режимов · благодарности',
    actionLabel: 'Открыть дневник',
    isDone: (p) =>
      !!(
        p?.lastActivity.schemaDiary ||
        p?.lastActivity.modeDiary ||
        p?.lastActivity.gratitudeDiary
      ),
  },
  {
    id: 'notify',
    color: 'var(--accent-orange)',
    title: 'Ежедневное напоминание',
    description:
      'Одно уведомление в удобное время — чтобы практика не держалась на памяти.',
    detail: 'Время · часовой пояс · серии дней',
    actionLabel: 'Настроить',
    isDone: (p) => !!p?.notifications.enabled,
  },
  {
    id: 'childhood',
    color: 'var(--accent-green)',
    title: 'Колесо детства',
    description:
      'Оценить, как в детстве удовлетворялись те же пять потребностей, — и увидеть, откуда выросли нынешние паттерны.',
    detail: '5 областей · связь с активными схемами',
    actionLabel: 'Открыть',
    isDone: () => !!localStorage.getItem('childhood_wheel_done'),
  },
];
