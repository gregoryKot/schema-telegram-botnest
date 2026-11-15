import { useState } from 'react';

// Необратимое действие за подтверждением: кнопка → «точно?» → действие; при
// отказе подтверждение остаётся открытым с ошибкой, а не закрывается молча.
// Одна механика на все такие кнопки (удаление результатов теста, отключение
// от терапевта, удаление статьи и фразы); вид подтверждения — ConfirmDialog сайта.
// confirm возвращает true/false: HistoryConfirmDialog (`run`) по нему закрывается.
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
  const confirm = async (): Promise<boolean> => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      setConfirming(false);
      onDone();
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { confirming, busy, failed, ask, cancel, confirm };
}

export type ConfirmedAction = ReturnType<typeof useConfirmedAction>;
