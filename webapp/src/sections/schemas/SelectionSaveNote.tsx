import { PaperAlert } from '../../components/paper/PaperAlert';
import { useTr } from '../../utils/addressForm';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { UNWRITABLE_SELECTION_NOTE } from '../../../../shared/src/api/unwritableError';

interface Props {
  failed: boolean;
  blocked: boolean;
  /** Знак блока, где сделан выбор (слои — схемы, круги — режимы): сбой стоит у этого блока. */
  sign?: SignKey;
  /** Повторить запись того же списка; при 409 повтор не поможет — кнопки нет. */
  onRetry?: () => void;
}

// Строка отказа записи «моих схем/режимов» — бумага соломы (PaperAlert) у блока, где сделан выбор,
// а не красный текст над героем. blocked — 409 unreadable_data: прежний список на сервере сейчас
// не читается, и сервер не дал его стереть; «проверь связь» тут соврало бы. Иначе — обычный сбой
// сети и «Повторить». Выбор в обоих случаях остаётся на устройстве (localStorage + state useSchemasData).
export function SelectionSaveNote({ failed, blocked, sign, onRetry }: Props) {
  const tr = useTr();
  if (blocked) return <PaperAlert sign={sign} title={tr(UNWRITABLE_SELECTION_NOTE.ty, UNWRITABLE_SELECTION_NOTE.vy)} />;
  if (!failed) return null;
  return (
    <PaperAlert sign={sign} onRetry={onRetry}
      title={tr('Выбор сохранён только на этом устройстве — проверь связь и попробуй ещё раз', 'Выбор сохранён только на этом устройстве — проверьте связь и попробуйте ещё раз')} />
  );
}
