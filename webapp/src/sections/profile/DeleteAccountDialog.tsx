import { useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { ConfirmDialog } from '../../components/ConfirmDialog';

// Подтверждение удаления аккаунта. Вынесено из ProfileSection (файл-должник
// сверх 300 строк — правило №10 CLAUDE.md: он обязан таять, а не пухнуть) и
// заодно собирает в одном месте всё состояние необратимой операции.
//
// Ключевое здесь — видимая ошибка. Раньше провал запроса только возвращал
// кнопку в исходное состояние: человек нажал «Удалить», ничего не произошло,
// и понять, удалён аккаунт или нет, было невозможно. Для операции без отмены
// это худший из возможных исходов, поэтому текст ошибки прямо говорит, что
// данные на месте.
//
// Ж4 (аудит 2026-08): сама разметка диалога/фокус-трап/Escape переехали в
// общий ConfirmDialog (был первым таким полноценным диалогом в проекте, три
// window.confirm()-места переведены на него же) — здесь остаётся только
// специфика удаления аккаунта: busy/error-состояние и вызов api.
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function confirm() {
    setDeleting(true);
    setError('');
    api
      .deleteAllUserData()
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        setDeleting(false);
        setError(
          tr(
            'Не удалось удалить аккаунт. Данные на месте — проверь соединение и попробуй ещё раз.',
            'Не удалось удалить аккаунт. Данные на месте — проверьте соединение и попробуйте ещё раз.',
          ),
        );
      });
  }

  return (
    <ConfirmDialog
      title="Удалить аккаунт?"
      message="Все данные будут удалены безвозвратно: дневники, записи, прогресс, настройки. Восстановить невозможно."
      confirmLabel="Удалить"
      busyLabel="Удаляем..."
      busy={deleting}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
