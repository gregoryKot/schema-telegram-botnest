import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { describeFailure } from '../../../../shared/src/api/describeFailure';
import { useAuth } from '../../auth/authContext';
import { useStepUpFetch } from '../../components/stepUp/stepUpContext';
import { sessionPost } from '../../components/stepUp/sessionRequest';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import {
  ACCOUNT_LINK_CONFIRMED_EVENT,
  type AccountLinkHost,
} from '../../../../shared/src/share/analytics';
import { TicketHttpError, linkFailOutcome, type LinkFailOutcome } from './linkFailModel';

export interface LinkPreview {
  provider: string;
  displayName: string | null;
  sameAccount: boolean;
  summary: Record<string, number>;
  combined?: number; // сколько записей объединится с этим аккаунтом (R3), как в merge/preview
  twoFactorLost: boolean;
}

export type LinkPhase = 'ask' | 'done' | 'denied';

const LINK_SECTION = 'link-device';
const REPORT_WINDOW_MS = 60_000;
let lastReportAt = -Infinity;

/** Сводка билета не загрузилась — экран-тупик шлёт отчёт наверх (правило №14, check-dead-end-report), как
 *  подписка по ссылке: 4xx (код не найден, устарел, лимит) — ожидаемый исход wait, без отчёта; остальное —
 *  our_side с отчётом. В отчёте только статус или тип сбоя (describeFailure): ни кода билета, ни текста
 *  ответа. Троттлинг — не чаще раза в минуту на вкладку: ремаунт и смена токена не шлют повтор. */
export function reportLinkPreviewFailure(e: unknown, now = Date.now()): LinkFailOutcome {
  const outcome = linkFailOutcome(e);
  if (outcome === 'our_side' && now - lastReportAt >= REPORT_WINDOW_MS) {
    lastReportAt = now;
    reportClientError({ message: `link preview failed: ${describeFailure(e)}`, section: LINK_SECTION });
  }
  return outcome;
}

/** Только для тестов: сброс окна троттлинга. */
export function resetLinkReportThrottle() { lastReportAt = -Infinity; }

// Билет привязки мессенджера (`intent: 'link'`) со стороны браузера: сводка, подтверждение, отказ.
export function useLinkTicket(code: string) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [error, setError] = useState<string | null>(null); // сводка не загрузилась — тупик с отчётом
  const [actionError, setActionError] = useState<string | null>(null); // подтверждение не прошло — у кнопки
  const [failOutcome, setFailOutcome] = useState<LinkFailOutcome | null>(null);
  const [busy, setBusy] = useState<null | 'approve' | 'deny'>(null);
  const [phase, setPhase] = useState<LinkPhase>('ask');
  const { accessToken } = useAuth();
  const stepUp = useStepUpFetch();

  // Ручки под JwtAuthGuard (Bearer; без него был 401); approve при 2FA — с кодом (S12).
  const call = useCallback(async (path: string) => {
    const res = await stepUp(sessionPost(`/api/auth/ticket/${path}`, accessToken, { code }));
    if (!res) return null; // окно кода закрыто — ничего не подтверждено
    if (!res.ok) throw new TicketHttpError((await readHumanError(res, 'Не получилось')).message, res.status);
    return res.json().catch(() => ({})) as Promise<unknown>;
  }, [code, accessToken, stepUp]);

  useEffect(() => {
    let alive = true;
    call('preview')
      .then((p) => { if (alive) setPreview(p as LinkPreview); })
      .catch((e: unknown) => { if (alive) { setError(humanizeThrown(e, 'Не получилось')); setFailOutcome(reportLinkPreviewFailure(e)); } });
    return () => { alive = false; };
  }, [call]);

  const approve = async () => {
    setBusy('approve');
    setActionError(null);
    try {
      const res = (await call('approve')) as { merged?: boolean; repeat?: boolean } | null;
      if (!res) return;
      // Успех считает этот экран (мини-апп ещё ждёт) ровно раз: повтор из второй вкладки уже посчитан.
      if (!res.repeat) api.trackEvent(ACCOUNT_LINK_CONFIRMED_EVENT, {
        host: (preview?.provider ?? 'max') as AccountLinkHost,
        merged: res.merged === true,
      });
      setPhase('done');
    } catch (e) {
      setActionError(humanizeThrown(e, 'Не получилось'));
    } finally {
      setBusy(null);
    }
  };

  // «Это не я». Ручка общая с входом (`deny-login` гасит живой билет любого
  // intent — LoginTicketService.deny): ждущий мини-апп получает `denied`, а не
  // висит до истечения. Событие не шлём: отказ — сработавшая защита, а не
  // провал переноса (LinkAccountSection намеренно не считает 'denied').
  const deny = async () => {
    setBusy('deny');
    setActionError(null);
    try {
      await call('deny-login');
      setPhase('denied');
    } catch {
      // Не долетело — код всё равно никто не подтвердил, билет истечёт сам.
      setPhase('denied');
    } finally {
      setBusy(null);
    }
  };

  return { preview, error: error ?? actionError, failOutcome, busy, phase, approve, deny };
}

/** Текст галочки — по реальному эффекту approve (TicketLinkService.approve). */
export function linkAckText(messenger: string, sameAccount: boolean): string {
  const access = `Я понимаю, что приложение в ${messenger} получит полный доступ к этому аккаунту`;
  return sameAccount
    ? `${access}.`
    : `${access}, его данные необратимо переедут сюда, а прежний аккаунт приложения будет удалён.`;
}
