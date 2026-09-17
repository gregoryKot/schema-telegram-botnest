// Единственная копия «скопировать в буфер» (правило №3 CLAUDE.md, «одна
// механика — один компонент»). До этого хука navigator.clipboard.writeText
// вызывался в 19 местах обоих фронтендов, и обработка сбоя каждый раз
// расходилась заново (пять вариантов: отчёт наверх, /* ignore */, «текст и
// так на экране», таймауты 2000 vs 2500) — а один из вариантов оказался
// багом: ссылка-приглашение клиента копировалась «молча», и когда буфер был
// недоступен (нет secure context, Safari без жеста, отказ в разрешении),
// терапевт не видел отказа и вставлял пустоту.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCopyOptions {
  /** Через сколько мс сбросить copied/failed обратно в false. По умолчанию 2000. */
  resetMs?: number;
  /** Зовётся при сбое (буфер недоступен, отказ в разрешении и т.п.). */
  onError?: (e: unknown) => void;
}

export interface CopyState {
  copied: boolean;
  failed: boolean;
  copy: (text: string) => Promise<boolean>;
}

export function useCopyToClipboard(options?: UseCopyOptions): CopyState {
  const resetMs = options?.resetMs ?? 2000;
  const onError = options?.onError;
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = useCallback(
    async (text: string) => {
      clearTimeout(timerRef.current);
      try {
        if (!navigator.clipboard) throw new Error('clipboard API недоступен');
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setFailed(false);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
        return true;
      } catch (e) {
        setCopied(false);
        setFailed(true);
        onError?.(e);
        timerRef.current = setTimeout(() => setFailed(false), resetMs);
        return false;
      }
    },
    [resetMs, onError],
  );

  return { copied, failed, copy };
}
