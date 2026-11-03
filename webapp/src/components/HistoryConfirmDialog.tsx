import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
import { useHistorySheet } from '../hooks/useHistorySheet';

// Подтверждение поверх экрана со своим адресом (карточка клиента): «Назад»
// браузера закрывает диалог, а не уводит с экрана под ним (QA 2026-11:
// «Удалить клиента?» → «Назад» уводил из карточки). Запись в истории — через
// useHistorySheet, как у листов, и все закрытия идут через goBack: «Отмена»,
// Escape и фон — goBack(); подтверждение — goBack(onConfirm): запись
// снимается раньше действия, поэтому переход, который действие делает само
// (удалённый клиент → список), не встречается с go(-1) в одном такте.
// onCancel здесь — «диалог закрыт»: он зовётся и перед onConfirm.
//
// Только для подтверждений, которые закрываются сразу по нажатию: занятость и
// ошибка внутри диалога (busy, error) сюда не ложатся — запись к тому моменту
// уже снята. Им — прежний ConfirmDialog (docs/open/one-frontend.md).
export function HistoryConfirmDialog(props: Omit<ConfirmDialogProps, 'busy' | 'busyLabel' | 'error'>) {
  const goBack = useHistorySheet(props.onCancel);
  return <ConfirmDialog {...props} onCancel={() => goBack()} onConfirm={() => goBack(props.onConfirm)} />;
}
