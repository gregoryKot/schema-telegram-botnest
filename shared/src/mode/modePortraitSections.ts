/**
 * Восемь блоков портрета режима — общий состав для мини-аппа и вебаппа
 * (правило №3 CLAUDE.md, паритет с общим составом вопросов в
 * modeIntroQuestions.ts). `card.about` сюда не входит — идёт отдельно, в
 * шапку экрана портрета (описание режима), собирается на уровне компонента
 * (ModePortrait в обоих фронтендах), не здесь.
 *
 * Подписи — простым языком, без клинических терминов (тот же принцип, что и
 * в правиле №8 про язык отчёта /stats): понятно без подготовки.
 */
import type { ModeCard } from './modeCards';

export interface ModePortraitSection {
  key: string;
  label: string;
  text: string;
}

export function buildModePortraitSections(
  card: ModeCard,
): ModePortraitSection[] {
  return [
    { key: 'triggers', label: 'Когда включается', text: card.triggers },
    { key: 'body', label: 'Как узнать в теле', text: card.body },
    { key: 'voice', label: 'Что говорит', text: card.voice },
    { key: 'behavior', label: 'Что делает', text: card.behavior },
    { key: 'origin', label: 'Зачем появился', text: card.origin },
    { key: 'cost', label: 'Чего стоит сейчас', text: card.cost },
    { key: 'need', label: 'Что ему на самом деле нужно', text: card.need },
    {
      key: 'healthyAdult',
      label: 'Что отвечает Здоровый Взрослый',
      text: card.healthyAdult,
    },
  ];
}
