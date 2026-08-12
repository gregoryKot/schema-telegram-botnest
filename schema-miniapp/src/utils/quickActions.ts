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

export type QuickActionGroupId =
  'capture' | 'rate' | 'calm' | 'understand' | 'support';

export interface QuickAction {
  id: QuickActionId;
  label: string;
  sub: string;
}

export interface QuickActionGroup {
  id: QuickActionGroupId;
  title: string;
  actions: QuickAction[];
}

function action(id: QuickActionId, label: string, sub: string): QuickAction {
  return { id, label, sub };
}

function group(
  id: QuickActionGroupId,
  title: string,
  actions: QuickAction[],
): QuickActionGroup {
  return { id, title, actions };
}

// Пункты поверхности «плюс» — 13 действий (childhood_wheel/tasks/practices/
// plans сюда не входят, это только «Инструменты»). Подписи — существующие
// тексты продукта (FloatingPill/HelpSection/ToolRow), не переформулированы.
export function buildPlusActions(tr: Tr): QuickActionGroup[] {
  return [
    group('capture', 'Записать момент', [
      action('diary_schema', 'Схема', 'Когда сработал паттерн'),
      action('diary_mode', 'Режим', 'Какой режим активировался'),
      action('diary_gratitude', 'Благодарность', 'Что было хорошего'),
    ]),
    group('rate', 'Оценить день', [
      action(
        'tracker',
        'Трекер потребностей',
        tr('Оцени день по пяти шкалам', 'Оцените день по пяти шкалам'),
      ),
    ]),
    group('calm', 'Успокоиться', [
      action(
        'breathing',
        'Дыхание 4-4-6',
        'вдох короче выдоха — сигнал телу, что опасности нет',
      ),
      action(
        'grounding',
        'Заземление 5-4-3-2-1',
        'вернуться в тело и в комнату',
      ),
      action('stop', 'Техника «Стоп»', 'пауза между импульсом и действием'),
    ]),
    group('understand', 'Разобраться', [
      action('belief_check', 'Проверка убеждений', 'Правда ли это?'),
      action(
        'phrase_check',
        'Критик или забота?',
        'Проверить фразу внутреннего голоса',
      ),
      action('flashcard', 'Схема включилась', '5 шагов чтобы разобраться'),
    ]),
    group('support', 'Поддержать себя', [
      action('safe_place', 'Безопасное место', 'Ресурс в тревожный момент'),
      action('letter_to_self', 'Письмо себе', 'Уязвимому Ребёнку'),
      action('warm_words', 'Тёплые слова', 'Слова поддержки себе'),
    ]),
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
