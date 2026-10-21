// Тексты недельной частоты и вводных карточек новичка («откуда это и зачем»).
// Один источник для сайта и мини-аппа (правило №3): раньше строки жили в
// PatternsHero/ModesHero/списках мини-аппа. Ты/вы — функцией `tr` от вызывающего.
import { pluralRu } from '../utils/pluralRu';
import { patternMeta } from './patternMeta';
import type { WeekPatternKind, WeekTopSummary } from './patternsSummary';

type Tr = (ty: string, vy: string) => string;

export function dayWord(n: number): string {
  return pluralRu(n, 'день', 'дня', 'дней');
}

/** Подсказка к полоскам частоты: показывается, когда у кого-то частота > 0. */
export function freqHint(kind: WeekPatternKind): string {
  return kind === 'schema'
    ? 'Полоска рядом со схемой — сколько дней за неделю она всплывала в дневнике. Это наблюдение, а не оценка.'
    : 'Полоска рядом с режимом — сколько дней за неделю он включался по дневнику. Это наблюдение, а не оценка.';
}

export interface WeekTopText {
  label: string;
  title: string;
  color: string;
  sub: string;
}

/** Текст карточки «паттерн недели»; null — сущность не найдена в справочнике. */
export function weekTopText(
  kind: WeekPatternKind,
  summary: WeekTopSummary,
): WeekTopText | null {
  const meta = patternMeta(kind, summary.id);
  if (!meta) return null;
  const days = `${summary.days} из ${summary.windowDays} дней — по записям дневника.`;
  return kind === 'schema'
    ? {
        label: 'Чаще всего звучит',
        title: meta.name.split(' / ')[0],
        color: meta.color,
        sub: `${days} Это не приговор — просто то, за чем стоит понаблюдать.`,
      }
    : {
        label: 'Чаще всего включается',
        title: meta.name,
        color: meta.color,
        sub: `${days} Заметить включение — уже полработы.`,
      };
}

export interface PatternIntro {
  label: string;
  chip: string;
  title: string;
  sub: string;
}

/** Вводная новичку без схем: откуда понятие и зачем тест. */
export function schemaIntro(tr: Tr): PatternIntro {
  return {
    label: 'Первый шаг',
    chip: '≈10 мин',
    title: 'Узнать свои схемы',
    sub: tr(
      'Схема — устойчивый способ реагировать, сложившийся в детстве. Понятие ввёл Джеффри Янг, основатель схема-терапии. По 116 утверждениям увидишь, какие из 20 схем звучат громче всего.',
      'Схема — устойчивый способ реагировать, сложившийся в детстве. Понятие ввёл Джеффри Янг, основатель схема-терапии. По 116 утверждениям увидите, какие из 20 схем звучат громче всего.',
    ),
  };
}

/** Вводная новичку без режимов: самый узнаваемый режим как вход. */
export function modeIntro(tr: Tr): PatternIntro {
  return {
    label: 'Знакомство',
    chip: '≈2 мин',
    title: 'Встретить своего Критика',
    sub: tr(
      'Режим — состояние, которое включается в моменте; понятие из схема-терапии. Начни с самого узнаваемого — внутреннего голоса требований. Две минуты на чтение, карточку можно заполнить потом.',
      'Режим — состояние, которое включается в моменте; понятие из схема-терапии. Начните с самого узнаваемого — внутреннего голоса требований. Две минуты на чтение, карточку можно заполнить потом.',
    ),
  };
}

/** Схемы и режимы есть, записей дневника нет: откуда возьмётся картина недели. */
export function diaryIntro(tr: Tr): { title: string; sub: string } {
  return {
    title: 'Картина недели появится из дневника',
    sub: tr(
      'Замечай моменты, когда схема или режим включились, — через несколько дней здесь станет видно, что звучит чаще всего.',
      'Замечайте моменты, когда схема или режим включились, — через несколько дней здесь станет видно, что звучит чаще всего.',
    ),
  };
}

export const INTRO_MODE_ID = 'demanding_critic';
