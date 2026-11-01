import { SaveErrorNote } from '../../components/SaveErrorNote';
import { UNWRITABLE_SELECTION_NOTE } from '../../../../shared/src/api/unwritableError';
import type { SaveErr } from './useMySelections';

// Плашка отказа записи «моих схем/режимов» под вкладками — двойник
// webapp/src/sections/schemas/SelectionSaveNote.tsx. 'blocked' — 409
// unreadable_data: прежний список на сервере не читается, и сервер не дал его
// стереть; немедленный повтор тут не поможет. Выбор в обоих случаях остаётся
// на устройстве (localStorage + state useMySelections).
export function SelectionSaveNote({ error }: { error: SaveErr }) {
  if (!error) return null;
  return (
    <div className="u-mt8">
      {error === 'blocked' ? (
        <SaveErrorNote {...UNWRITABLE_SELECTION_NOTE} />
      ) : (
        <SaveErrorNote
          ty="Не удалось сохранить выбор на сервере. Здесь применилось, но на другом устройстве может не появиться — попробуй ещё раз."
          vy="Не удалось сохранить выбор на сервере. Здесь применилось, но на другом устройстве может не появиться — попробуйте ещё раз."
        />
      )}
    </div>
  );
}
