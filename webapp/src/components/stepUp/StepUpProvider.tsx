import { useCallback, useRef, useState, type ReactNode } from 'react';
import { readStepUpVerdict, type StepUpVerdict } from '../../../../shared/src/auth/stepUp';
import { StepUpContext, type StepUpFetch, type StepUpSend } from './stepUpContext';
import { StepUpDialog, type StepUpView } from './StepUpDialog';

interface Session {
  send: StepUpSend;
  resolve: (res: Response | null) => void;
  reject: (err: unknown) => void;
  result: Response | null;
  failed: { err: unknown } | null;
}

const viewOf = (v: StepUpVerdict, attempt: number, wrong: boolean): StepUpView => ({
  status: v.kind === 'locked' ? 'locked' : wrong ? 'wrong' : 'ask',
  retryAfterS: v.kind === 'locked' ? v.retryAfterS : null,
  attempt,
  busy: false,
  done: false,
});

// Подтверждение кодом 2FA для ручек привязки и отвязки (S12, аудит 2026-11).
// Запрос уходит как есть; ответил сервер «нужен код» — окно кода, и тот же
// запрос повторяется с заголовком `x-totp-code`, пока код не подойдёт или
// человек не закроет окно. Исход отдаётся вызывающему только после того, как
// окно закрылось и сняло свою запись истории: следом может быть уход на OAuth.
export function StepUpProvider({ children }: { children: ReactNode }) {
  const session = useRef<Session | null>(null);
  const [view, setView] = useState<StepUpView | null>(null);

  const stepUpFetch = useCallback<StepUpFetch>(async (send) => {
    const first = await send();
    const verdict = await readStepUpVerdict(first);
    // Окно уже открыто другим запросом — второй получает ответ сервера как есть.
    if (verdict.kind === 'pass' || session.current) return first;
    return new Promise<Response | null>((resolve, reject) => {
      session.current = { send, resolve, reject, result: null, failed: null };
      setView(viewOf(verdict, 0, false));
    });
  }, []);

  const submit = async (code: string) => {
    const s = session.current;
    if (!s) return;
    setView((v) => v && { ...v, busy: true });
    try {
      const res = await s.send(code);
      const verdict = await readStepUpVerdict(res);
      if (verdict.kind === 'pass') {
        s.result = res;
        setView((v) => v && { ...v, done: true });
      } else {
        setView((v) => viewOf(verdict, (v?.attempt ?? 0) + 1, true));
      }
    } catch (err) {
      s.failed = { err }; // сеть — вызывающий покажет свою ошибку
      setView((v) => v && { ...v, done: true });
    }
  };

  // Окно закрылось — «Отмена», «Назад» браузера или после верного кода.
  const closed = () => {
    const s = session.current;
    session.current = null;
    setView(null);
    if (s?.failed) s.reject(s.failed.err);
    else s?.resolve(s.result);
  };

  return (
    <StepUpContext.Provider value={stepUpFetch}>
      {children}
      {view && <StepUpDialog view={view} onSubmit={(code) => void submit(code)} onClosed={closed} />}
    </StepUpContext.Provider>
  );
}
