import type { QuickActionId } from '../../utils/quickActions';
import { plural } from '../today/helpers';

// Данные 10 строк блока «Инструменты» (ToolsList.tsx) — единственный источник
// и для рендера списка, и для листа настройки видимости
// (QuickActionCustomizeSheet, правило «одна механика — один компонент»:
// новая строка тут автоматически попадает и в список, и в настройку).
// Тексты/порядок/эмодзи (для id, пересекающихся с реестром «плюса» —
// belief_check, phrase_check, flashcard, safe_place, letter_to_self,
// warm_words) — как были в ToolsList/quickActions.ts раньше, не переписаны.

export interface ToolRowDef {
  id: QuickActionId;
  emoji: string;
  label: string;
  sub?: string;
}

export interface ToolRowsProps {
  tasksCount: number;
  practiceCount?: number | null;
  planCount?: number | null;
  childhoodDone: boolean;
}

export function buildToolRows({
  tasksCount,
  practiceCount,
  planCount,
  childhoodDone,
}: ToolRowsProps): ToolRowDef[] {
  return [
    {
      id: 'phrase_check',
      emoji: '💭',
      label: 'Критик или забота?',
      sub: 'Проверить фразу внутреннего голоса',
    },
    {
      id: 'tasks',
      emoji: '🎯',
      label: 'Мои цели',
      sub:
        tasksCount === 0
          ? 'Нет активных'
          : `${tasksCount} ${plural(tasksCount, 'цель', 'цели', 'целей')}`,
    },
    {
      id: 'practices',
      emoji: '📚',
      label: 'Практики',
      sub:
        practiceCount == null
          ? undefined
          : practiceCount === 0
            ? 'Нет практик'
            : `${practiceCount} ${plural(practiceCount, 'практика', 'практики', 'практик')}`,
    },
    {
      id: 'plans',
      emoji: '🗓',
      label: 'Планы',
      sub:
        planCount == null
          ? undefined
          : planCount === 0
            ? 'История пуста'
            : `${planCount} ${plural(planCount, 'план', 'плана', 'планов')}`,
    },
    {
      id: 'belief_check',
      emoji: '🔍',
      label: 'Проверка убеждений',
      sub: 'Правда ли это?',
    },
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
      id: 'flashcard',
      emoji: '⚡',
      label: 'Схема включилась',
      sub: '5 шагов чтобы разобраться',
    },
    {
      id: 'childhood_wheel',
      emoji: '🎡',
      label: 'Колесо детства',
      sub: childhoodDone ? 'Паттерны из прошлого' : 'Займёт 2 минуты',
    },
    {
      id: 'warm_words',
      emoji: '💛',
      label: 'Тёплые слова',
      sub: 'Слова поддержки себе',
    },
  ];
}
