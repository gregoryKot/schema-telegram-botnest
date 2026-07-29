// Логика шита шаринга — единственная копия для обоих фронтендов (правило №3):
// отрисовка карточки на канвасе, системный шэр с аналитикой, копирование
// текста и текстовый фолбэк, когда системный шэр недоступен или упал.
// Вёрстка остаётся в каждом фронтенде своя (BottomSheet у них разный).
import { useCallback, useEffect, useRef, useState } from 'react';
import { shareCanvasImage } from './shareImage';
import { SHARE_CARD_EVENT, SHARE_RESULT_EVENT, type ShareCardKind } from './analytics';

export interface ShareCardOpts {
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  fallbackText?: string;
  filename: string;
  eventKind: ShareCardKind;
  track: (name: string, meta?: Record<string, unknown>) => void;
}

export interface ShareCardState {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Идёт подготовка картинки — кнопка заблокирована. */
  sharing: boolean;
  /** Текст уехал в буфер — на кнопке галочка. */
  copied: boolean;
  /** Системный шэр не сработал: показываем текст, который можно скопировать. */
  showText: boolean;
  closeText: () => void;
  text: string;
  share: () => Promise<void>;
  copy: () => Promise<void>;
}

export function useShareCard(o: ShareCardOpts): ShareCardState {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const text = o.fallbackText ?? o.shareText;

  const { draw } = o;
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      draw(canvasRef.current);
    } catch {
      // Отрисовка карточки не должна ронять весь экран
    }
  }, [draw]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* best-effort: ошибку намеренно игнорируем */
    }
  }, [text]);

  const share = useCallback(async () => {
    if (!canvasRef.current) return;
    setSharing(true);
    try {
      await shareCanvasImage(canvasRef.current, o.shareText, o.filename, {
        downloadFallback: true,
      });
      o.track(SHARE_CARD_EVENT, { kind: o.eventKind });
      o.track(SHARE_RESULT_EVENT, { kind: o.eventKind, ok: true });
    } catch {
      // Шэр не удался — копируем текст и показываем его шитом
      o.track(SHARE_RESULT_EVENT, { kind: o.eventKind, ok: false });
      await copy();
      setShowText(true);
    } finally {
      setSharing(false);
    }
  }, [o, copy]);

  return {
    canvasRef,
    sharing,
    copied,
    showText,
    closeText: () => setShowText(false),
    text,
    share,
    copy,
  };
}
