import { UserProfile } from '../../types';

// ── Onboarding steps definition ──────────────────────────────────────────────

export const ONBOARDING_DONE_KEY = 'onboarding_done';
export const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped';

export interface StepDef {
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

export const STEPS: StepDef[] = [
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
