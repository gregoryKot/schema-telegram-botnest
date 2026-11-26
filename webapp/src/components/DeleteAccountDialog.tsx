import { useState } from 'react';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { Dialog } from './Dialog';
import { glue } from '../../../shared/src/utils/typo';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { DeleteAccountConfirm } from '../../../shared/src/components/DeleteAccountConfirm';
import { deleteAccountCopy, wipeAfterAccountDeletion } from '../../../shared/src/account/accountDeletion';
import { dropPushAfterAccountDeletion } from '../push/pushSubscription';

// Удаление аккаунта на сайте — один диалог на «Профиль» и «Настройки → Данные»
// (QA 2026-11, К2). Раньше их было два: копия в «Профиле» не знала про шаг
// кода 2FA (403 выдавался за обрыв связи) и не чистила хранилище, и после
// удаления экран входа говорил «данные на месте». Теперь:
// - текст говорит правду: уходит аккаунт целиком, со способами входа и связью
//   с терапевтом (З2), — shared/account/accountDeletion.ts;
// - последний шаг и код 2FA — общий с мини-аппом DeleteAccountConfirm;
// - после удаления — уборка хранилища, подписки на пуши и экран входа «Аккаунт удалён»;
// - сбой виден и прямо говорит, что данные на месте (операция без отмены);
// - «Назад» браузера закрывает диалог, а не экран под ним (useHistorySheet).
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const copy = deleteAccountCopy(tr);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <Dialog label={copy.title} onClose={deleting ? undefined : goBack} closeOnEscape>
      <h2 className="ds-h2 sk-dialog-title">{glue(copy.title)}</h2>
      <p className="sk-dialog-text">{copy.body}</p>
      {failed && <div role="alert" className="sk-error sk-dialog-error">{copy.failed}</div>}
      {confirming && (
        <DeleteAccountConfirm
          tr={tr} deleting={deleting} setDeleting={setDeleting} deleteAllUserData={api.deleteAllUserData}
          onFailed={() => { setConfirming(false); setFailed(true); }}
          onDeleted={() => void dropPushAfterAccountDeletion().finally(() => { wipeAfterAccountDeletion(); window.location.reload(); })}
        />
      )}
      <div className="sk-dialog-actions">
        <button className="ds-btn ds-btn--secondary" onClick={goBack} disabled={deleting}>Отмена</button>
        {!confirming && (
          <button className="ds-btn sk-btn-danger" onClick={() => { setFailed(false); setConfirming(true); }}>
            Удалить
          </button>
        )}
      </div>
    </Dialog>
  );
}
