// Единый реестр быстрых действий (правило «одна механика — один компонент»):
// раньше 4 пункта кнопки «плюс» были зашиты прямо в FloatingPill, а часть тех
// же практик отдельно жила в HelpSection/ToolsList. QUICK_ACTION_IDS — парный
// реестр с бэкендом (src/analytics/quick-actions.constants.ts) — sync-спека
// грепает именно этот файл и блок ниже, держи по одному id на строке (так
// меньше merge-конфликтов, правило №13 CLAUDE.md).
import type { FocusPractice } from './todayFocus';
import type { Tr } from '../../../shared/src/practices/quickPractices';

export const QUICK_ACTION_IDS = [
  'tracker',
  'diary_schema',
  'diary_mode',
  'diary_gratitude',
  'breathing',
  'grounding',
  'stop',
  'belief_check',
  'phrase_check',
  'flashcard',
  'safe_place',
  'letter_to_self',
  'warm_words',
  'childhood_wheel',
  'tasks',
  'practices',
  'plans',
] as const;
export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

export type QuickActionGroupId = 'capture' | 'rate' | 'calm' | 'understand' | 'support';

export interface QuickAction {
  id: QuickActionId;
  emoji: string;
  label: string;
  sub: string;
}

export interface QuickActionGroup {
  id: QuickActionGroupId;
  title: string;
  actions: QuickAction[];
}

// Пункты поверхности «плюс» — 13 действий (childhood_wheel/tasks/practices/
// plans сюда не входят, это только «Инструменты»). Подписи — существующие
// тексты продукта (FloatingPill/HelpSection/ToolRow), не переформулированы.
export function buildPlusActions(tr: Tr): QuickActionGroup[] {
  return [
    {
      id: 'capture',
      title: 'Записать момент',
      actions: [
        { id: 'diary_schema', emoji: '🧩', label: 'Схема', sub: 'Когда сработал паттерн' },
        { id: 'diary_mode', emoji: '🎭', label: 'Режим', sub: 'Какой режим активировался' },
        { id: 'diary_gratitude', emoji: '🙏', label: 'Благодарность', sub: 'Что было хорошего' },
      ],
    },
    {
      id: 'rate',
      title: 'Оценить день',
      actions: [
        {
          id: 'tracker',
          emoji: '📊',
          label: 'Трекер потребностей',
          sub: tr('Оцени день по пяти шкалам', 'Оцените день по пяти шкалам'),
        },
      ],
    },
    {
      id: 'calm',
      title: 'Успокоиться',
      actions: [
        {
          id: 'breathing',
          emoji: '🌬',
          label: 'Дыхание 4-4-6',
          sub: 'вдох короче выдоха — сигнал телу, что опасности нет',
        },
        {
          id: 'grounding',
          emoji: '🌍',
          label: 'Заземление 5-4-3-2-1',
          sub: 'вернуться в тело и в комнату',
        },
        {
          id: 'stop',
          emoji: '🛑',
          label: 'Техника «Стоп»',
          sub: 'пауза между импульсом и действием',
        },
      ],
    },
    {
      id: 'understand',
      title: 'Разобраться',
      actions: [
        { id: 'belief_check', emoji: '🔍', label: 'Проверка убеждений', sub: 'Правда ли это?' },
        {
          id: 'phrase_check',
          emoji: '💭',
          label: 'Критик или забота?',
          sub: 'Проверить фразу внутреннего голоса',
        },
        {
          id: 'flashcard',
          emoji: '⚡',
          label: 'Схема включилась',
          sub: '5 шагов чтобы разобраться',
        },
      ],
    },
    {
      id: 'support',
      title: 'Поддержать себя',
      actions: [
        {
          id: 'safe_place',
          emoji: '🏡',
          label: 'Безопасное место',
          sub: 'Ресурс в тревожный момент',
        },
        {
          id: 'letter_to_self',
          emoji: '✉️',
          label: 'Письмо себе',
          sub: 'Уязвимому Ребёнку',
        },
        {
          id: 'warm_words',
          emoji: '💛',
          label: 'Тёплые слова',
          sub: 'Слова поддержки себе',
        },
      ],
    },
  ];
}

// Явный маппинг «главное дело дня» (todayFocus.ts) → быстрое действие плюса.
// Оба реестра обязаны совпадать по смыслу (правило №4 CLAUDE.md) — сверка в
// quickActions.test.ts.
export const focusToQuickAction: Record<FocusPractice, QuickActionId> = {
  tracker: 'tracker',
  schema: 'diary_schema',
  mode: 'diary_mode',
  gratitude: 'diary_gratitude',
};
