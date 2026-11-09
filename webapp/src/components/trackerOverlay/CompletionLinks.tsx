import type { Need } from '../../types';
import { DayShareButton } from '../../share/DayShareButton';
import { SignArt } from '../art/SignArt';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

/**
 * Куда дальше с экрана «Готово»: строки-переходы со знаком сущности слева (как строки «Ещё»), а не
 * мелкие ссылки в одну строку — заметка к дню (знак заметки из ENTITY_LOOK), история (знак
 * трекера), «Поделиться днём» (своя иконка). Заметки нет у дооценки прошлого дня.
 */
export function CompletionLinks({ needs, ratings, date, isBackfill, onOpenNote, onOpenHistory }: {
  needs: Need[];
  ratings: Record<string, number>;
  date?: string;
  isBackfill: boolean;
  onOpenNote?: () => void;
  /** Уже обёрнутый в goBack переход: «Готово» закрывается, история открывается после. */
  onOpenHistory?: () => void;
}) {
  return (
    <div className="tq-go">
      {onOpenNote && !isBackfill && (
        <button type="button" className="tq-go-row" onClick={onOpenNote}>
          <span className="pp-row-art"><SignArt sign={ENTITY_LOOK.note.sign} size="row" /></span>Заметка
        </button>
      )}
      {onOpenHistory && (
        <button type="button" className="tq-go-row" onClick={onOpenHistory}>
          <span className="pp-row-art"><SignArt sign={ENTITY_LOOK.tracker.sign} size="row" /></span>История →
        </button>
      )}
      <DayShareButton needs={needs} ratings={ratings} date={date} className="tq-go-row tq-go-row--share" />
    </div>
  );
}
