import type { ModeGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideSection } from './GuideSection';
import { GuideSheet, type GuideSheetActions } from './GuideSheet';

type Props = GuideSheetActions & { modeName: string; view: ModeGuideView };

// Четыре канала работы с режимом — порядок справочника; пустой канал не показывается.
const CHANNELS = [
  ['relationship', 'Отношения'],
  ['cognitive', 'Когнитивно'],
  ['experiential', 'Экспериенциально'],
  ['behavioral', 'Поведенчески'],
] as const;

/**
 * Лист режима (#995): весь раздел справочника про режим — что это, цель,
 * четыре канала, затем общий хвост листа раздела (GuideSheet): техники «На
 * сессии», задания «Между сессиями», где застревают и источники. Открывается
 * «Подробнее о режиме» на плашке «Обычно в методе».
 */
export function ModeGuideSheet({ modeName, view, ...actions }: Props) {
  const { guide } = view;
  return (
    <GuideSheet
      title={modeName} view={view} {...actions}
      intro="Как работают с режимом в схема-терапии: цель, работа на сессии и задания между сессиями. Метки в квадратных скобках — книги из «Источников»."
    >
      <GuideSection title="Что это" text={guide.what} />
      <GuideSection title="Цель" text={guide.goal} />
      {CHANNELS.map(([key, title]) => <GuideSection key={key} title={title} text={guide[key]} />)}
    </GuideSheet>
  );
}
