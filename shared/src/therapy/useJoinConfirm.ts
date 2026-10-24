import { useState } from 'react';
import { joinConfirmFailText } from './joinConfirmFailText';

type Tr = (ty: string, vy: string) => string;

// Механика экрана-согласия на присоединение (оба фронтенда, правило «одна
// механика — один компонент»): busy, текст отказа, один вызов `join` по
// явному «Присоединиться». Сам `join` и действия после успеха задаёт экран.
export function useJoinConfirm(
  isPair: boolean,
  tr: Tr,
  join: () => Promise<unknown>,
  onDone: () => void,
  onError?: (e: unknown) => void,
) {
  const [busy, setBusy] = useState(false);
  const [failMsg, setFailMsg] = useState('');

  async function confirm() {
    setBusy(true);
    setFailMsg('');
    try {
      await join();
      onDone();
    } catch (e) {
      onError?.(e);
      setFailMsg(joinConfirmFailText(e, isPair, tr));
      setBusy(false);
    }
  }

  return { busy, failMsg, confirm };
}
