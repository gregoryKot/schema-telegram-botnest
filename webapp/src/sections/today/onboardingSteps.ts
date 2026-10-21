import type { UserProfile } from '../../types';

// Шаги онбординга «С чего начать»: общие для десктопного чеклиста
// (OnboardingWidget) и телефонной карточки одного шага (OnboardingPhoneCard).

export const ONBOARDING_DONE_KEY    = 'onboarding_done';
export const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped';

export interface StepDef {
  id: string;
  color: string;
  title: string;
  description: string;
  detail: string;
  actionLabel: string;
  isDone: (profile: UserProfile | null, ctx?: { hasSchemas: boolean }) => boolean;
}

export const STEPS: StepDef[] = [
  { id: 'ysq', color: 'var(--accent)',
    title: 'Тест на схемы',
    description: '116 вопросов, 10 минут. Покажет, какие ранние паттерны управляют реакциями.',
    detail: '20 схем · история прохождений · советы',
    actionLabel: 'Начать тест',
    isDone: (p, ctx) => !!(p?.ysq?.completedAt) || !!(ctx?.hasSchemas) },
  { id: 'tracker', color: 'var(--c-slate)',
    title: 'Оценка потребностей сегодня',
    description: 'Пять базовых эмоциональных потребностей из схема-терапии — по одной оценке на каждую. Через 3–5 дней в графике видно, что питает, а что истощает.',
    detail: 'Привязанность · Автономия · Выражение · Спонтанность · Границы',
    actionLabel: 'Перейти в трекер',
    isDone: p => !!(p?.lastActivity.needsTracker) },
  { id: 'diary', color: 'var(--accent-indigo)',
    title: 'Первая запись в дневнике',
    description: 'Записать момент, который задел, и увидеть, какая схема за ним стоит. Записи собираются в карту повторяющихся реакций.',
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
    description: 'Оценить, как в детстве удовлетворялись те же пять потребностей, — и увидеть, откуда выросли нынешние паттерны.',
    detail: '5 областей · связь с активными схемами',
    actionLabel: 'Открыть',
    isDone: () => !!localStorage.getItem('childhood_wheel_done') },
];
