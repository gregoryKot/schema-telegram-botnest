// Экран «Не удалось войти» перестаёт быть немым (инцидент 2026-08-08).
//
// Пять суток вход не работал у всех пользователей Telegram, и мы об этом не
// знали. На фронте телеметрия была только у ErrorBoundary — то есть у КРАША.
// А сломанный вход крашем не был: приложение аккуратно ловило 401 и рисовало
// обработанный экран. Обработанная авария оказалась невидимее необработанной.
//
// Здесь — общая для обоих фронтендов сборка сообщения (правило №3). Значений
// наружу не отдаём: только площадка, пустая ли подпись и короткий текст
// ошибки — по ним видно, что именно сломалось, и не видно, кто пользователь.
import { useEffect, useRef } from 'react';
import type { HostId } from './types';

export interface AuthFailureInput {
  hostId: HostId;
  /** Пустая ли подпись, с которой шли на сервер (пустая = сломан клиент). */
  signaturePresent: boolean;
  /** Текст ошибки, как его увидел экран. Обрезается. */
  error: string;
}

/** Строка `section` для POST /api/client-errors. */
export const AUTH_FAILURE_SECTION = 'auth';

/** Сообщение для отчёта. Чистая функция — тестируется без React и без сети. */
export function buildAuthFailureMessage(input: AuthFailureInput): string {
  const signature = input.signaturePresent ? 'подпись есть' : 'подпись ПУСТАЯ';
  return `вход не удался: хост=${input.hostId}, ${signature}, ${input.error.slice(0, 200)}`;
}

/**
 * Один отчёт на показ экрана неудачного входа. `input === null` — входу
 * ничего не мешает, отчёта нет.
 *
 * Хук общий для обоих фронтендов (правило №3 + «одна механика — один
 * компонент»): экран у мини-аппа и у сайта разный, а событие одно, и
 * копипаста эффекта означала бы, что правку внесут в одну копию. `report` —
 * своя `reportClientError` каждого пакета.
 */
export function useAuthFailureReport(
  report: (payload: { section: string; message: string }) => void,
  input: AuthFailureInput | null,
): void {
  const reported = useRef(false);
  const hostId = input?.hostId;
  const signaturePresent = input?.signaturePresent;
  const error = input?.error;
  useEffect(() => {
    if (!hostId || reported.current) return;
    reported.current = true;
    report({
      section: AUTH_FAILURE_SECTION,
      message: buildAuthFailureMessage({
        hostId,
        signaturePresent: !!signaturePresent,
        error: error ?? '',
      }),
    });
    // Полный список зависимостей безопасен: от повторной отправки защищает
    // не он, а `reported` — иначе перерендер экрана слал бы отчёт заново.
  }, [hostId, signaturePresent, error, report]);
}
