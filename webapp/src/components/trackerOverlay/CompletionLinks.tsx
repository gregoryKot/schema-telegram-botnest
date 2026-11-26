import type { Need } from '../../types';
import { DayShareButton } from '../../share/DayShareButton';
import { SignArt } from '../art/SignArt';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import type { NextStep } from './trackerFlow';

const NEXT_STEP_ROW: Record<NextStep, { entity: 'case' | 'plan'; label: string }> = {
  case: { entity: 'case', label: 'Разобрать, что задело →' },
  practice: { entity: 'plan', label: 'Выбрать шаг на завтра →' },
};

/**
 * Куда дальше с экрана «Готово»: строки-переходы со знаком сущности слева (как строки «Ещё»), а не
 * мелкие ссылки в одну строку — заметка к дню (знак заметки из ENTITY_LOOK), история (`Sheets` —
 * собранные дни; `Strokes` уже стоит на листе трекера рядом, второй раз в кадре он обесценивается),
 * «Поделиться днём» (своя иконка). Заметки нет у дооценки прошлого дня. Первой — следующий шаг, если день его подсказал.
 */
export function CompletionLinks({ needs, ratings, date, isBackfill, nextStep, onNextStep, onOpenNote, onOpenHistory }: {
  needs: Need[];
  ratings: Record<string, number>;
  date?: string;
  isBackfill: boolean;
  nextStep?: NextStep | null;
  onNextStep?: () => void;
  onOpenNote?: () => void;
  /** Уже обёрнутый в goBack переход: «Готово» закрывается, история открывается после. */
  onOpenHistory?: () => void;
}) {
  return (
    <div className="tq-go">
      {nextStep && onNextStep && (
        <button type="button" className="tq-go-row" onClick={onNextStep}>
          <span className="pp-row-art"><SignArt sign={ENTITY_LOOK[NEXT_STEP_ROW[nextStep].entity].sign} size="row" /></span>
          {NEXT_STEP_ROW[nextStep].label}
        </button>
      )}
      {onOpenNote && !isBackfill && (
        <button type="button" className="tq-go-row" onClick={onOpenNote}>
          <span className="pp-row-art"><SignArt sign={ENTITY_LOOK.note.sign} size="row" /></span>Заметка
        </button>
      )}
      {onOpenHistory && (
        <button type="button" className="tq-go-row" onClick={onOpenHistory}>
          <span className="pp-row-art"><SignArt sign="sheets" size="row" /></span>История →
        </button>
      )}
      <DayShareButton needs={needs} ratings={ratings} date={date} className="tq-go-row tq-go-row--share" />
    </div>
  );
}
