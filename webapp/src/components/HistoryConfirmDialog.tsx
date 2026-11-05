import { useState } from 'react';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
import { useHistorySheet } from '../hooks/useHistorySheet';

// Подтверждение поверх экрана со своим адресом (карточка клиента): «Назад»
// браузера закрывает диалог, а не уводит с экрана под ним (QA 2026-11:
// «Удалить клиента?» → «Назад» уводил из карточки). Запись в истории — через
// useHistorySheet, как у листов, и все закрытия идут через goBack: «Отмена»,
// Escape и фон — goBack().
// onCancel здесь — «диалог закрыт»: он зовётся и перед onConfirm.
//
// Два вида подтверждения:
// - `onConfirm` — действие мгновенное: goBack(onConfirm), запись снимается
//   раньше действия, поэтому переход, который действие делает само (удалённый
//   клиент → список), не встречается с go(-1) в одном такте;
// - `run` — действие идёт по сети, занятость и ошибка показываются внутри
//   диалога (QA 2026-11, T-3): диалог остаётся, пока run не вернёт true, и
//   тогда снимает запись истории. false — диалог открыт с ошибкой (`error`).
type Base = Omit<ConfirmDialogProps, 'onConfirm' | 'busy'>;
export type HistoryConfirmDialogProps = Base & (
  | { onConfirm: () => void; run?: undefined; busy?: undefined }
  | { run: () => Promise<boolean>; onConfirm?: undefined; busy?: boolean }
);

export function HistoryConfirmDialog(props: HistoryConfirmDialogProps) {
  const goBack = useHistorySheet(props.onCancel);
  const [running, setRunning] = useState(false);
  const { run, onConfirm, busy, ...rest } = props;
  const confirm = () => {
    if (!run) { goBack(onConfirm); return; }
    setRunning(true);
    void run().then(ok => { if (ok) goBack(); }).finally(() => setRunning(false));
  };
  return <ConfirmDialog {...rest} busy={running || !!busy} onCancel={() => goBack()} onConfirm={confirm} />;
}
