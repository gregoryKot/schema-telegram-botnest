import { useState } from 'react';

// Необратимое действие за подтверждением: кнопка → «точно?» → действие; при
// отказе подтверждение остаётся открытым с ошибкой, а не закрывается молча.
// Одна механика на оба фронтенда и на все такие кнопки (правило «одна
// механика — один компонент»): удаление результатов теста
// (ysqDataDelete.ts), отключение от терапевта («Мой терапевт» — до
// 2026-10-26 связь удалялась одним тапом без вопроса). Вид подтверждения у
// площадок свой: ConfirmDialog сайта, ConfirmButtons в шторке мини-аппа.
export function useConfirmedAction(
  action: () => Promise<unknown>,
  onDone: () => void,
) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const ask = () => {
    setFailed(false);
    setConfirming(true);
  };
  const cancel = () => setConfirming(false);
  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      setConfirming(false);
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return { confirming, busy, failed, ask, cancel, confirm };
}

export type ConfirmedAction = ReturnType<typeof useConfirmedAction>;
