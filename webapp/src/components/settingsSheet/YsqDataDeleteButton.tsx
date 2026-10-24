import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  buildYsqDataDeleteCopy,
  useYsqDataDelete,
} from '../../../../shared/src/hooks/ysqDataDelete';

// «Удалить результаты теста» в окне «Конфиденциальность» (DataSection):
// сначала общий ConfirmDialog сайта, потом стирается всё про тест — итог,
// история, прогресс. Состояние, тексты и порядок «сервер → localStorage» —
// shared/src/hooks/ysqDataDelete.ts, пара в мини-аппе —
// schema-miniapp/src/components/settingsSheet/YsqDataDelete.tsx.
export function YsqDataDeleteButton({ onDeleted }: { onDeleted: () => void }) {
  const copy = buildYsqDataDeleteCopy(useTr());
  const del = useYsqDataDelete(api, onDeleted);

  return (
    <>
      <button className="ds-btn ds-btn--secondary st-btn-danger st-block st-mb10" onClick={del.ask}>
        {copy.button}
      </button>
      {del.confirming && (
        <ConfirmDialog
          title={copy.title}
          message={copy.message}
          confirmLabel={copy.confirm}
          cancelLabel={copy.cancel}
          busyLabel={copy.busy}
          busy={del.busy}
          error={del.failed ? copy.error : undefined}
          onConfirm={() => void del.confirm()}
          onCancel={del.cancel}
        />
      )}
    </>
  );
}
