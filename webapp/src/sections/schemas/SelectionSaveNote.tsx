import { SaveErrorNote } from '../../components/SaveErrorNote';
import { UNWRITABLE_SELECTION_NOTE } from '../../../../shared/src/api/unwritableError';

// Плашка отказа записи «моих схем/режимов». blocked — 409 unreadable_data:
// прежний список на сервере сейчас не читается, и сервер не дал его стереть;
// «проверь связь» тут соврало бы. Иначе — обычный сбой сети. Выбор в обоих
// случаях остаётся на устройстве (localStorage + state useSchemasData).
export function SelectionSaveNote({ failed, blocked }: { failed: boolean; blocked: boolean }) {
  if (blocked) return <SaveErrorNote {...UNWRITABLE_SELECTION_NOTE} />;
  if (!failed) return null;
  return (
    <SaveErrorNote ty="Выбор сохранён только на этом устройстве — проверь связь и попробуй ещё раз" vy="Выбор сохранён только на этом устройстве — проверьте связь и попробуйте ещё раз" />
  );
}
