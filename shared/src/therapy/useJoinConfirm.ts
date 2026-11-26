import { useState } from 'react';
import { joinConfirmFailText } from './joinConfirmFailText';

type Tr = (ty: string, vy: string) => string;

// Механика экрана-согласия на присоединение (оба фронтенда, правило «одна
// механика — один компонент»): busy, текст отказа, один вызов `join` по
// явному «Присоединиться». Сам `join` и действия после успеха задаёт экран.
// `done` — присоединение прошло: экран терапевта показывает, что теперь видит
// терапевт (до 2026-10-26 окно молча закрывалось, и человек не знал, вышло
// ли), экран пары по-прежнему закрывается из `onDone`.
export function useJoinConfirm(
  isPair: boolean,
  tr: Tr,
  join: () => Promise<unknown>,
  onDone: () => void,
  onError?: (e: unknown) => void,
) {
  const [busy, setBusy] = useState(false);
  const [failMsg, setFailMsg] = useState('');
  const [done, setDone] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailMsg('');
    try {
      await join();
      setBusy(false);
      setDone(true);
      onDone();
    } catch (e) {
      onError?.(e);
      setFailMsg(joinConfirmFailText(e, isPair, tr));
      setBusy(false);
    }
  }

  return { busy, failMsg, confirm, done };
}
