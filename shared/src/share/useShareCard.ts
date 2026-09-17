// Логика шита шаринга — единственная копия для обоих фронтендов (правило №3):
// отрисовка карточки на канвасе, системный шэр с аналитикой, копирование
// текста и текстовый фолбэк, когда системный шэр недоступен или упал.
// Вёрстка остаётся в каждом фронтенде своя (BottomSheet у них разный).
import { useCallback, useEffect, useState } from 'react';
import { shareCanvasImage } from './shareImage';
import {
  SHARE_CARD_EVENT,
  SHARE_RESULT_EVENT,
  type ShareCardKind,
} from './analytics';
import { useCopyToClipboard } from '../utils/useCopyToClipboard';

export interface ShareCardOpts {
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  fallbackText?: string;
  filename: string;
  eventKind: ShareCardKind;
  track: (name: string, meta?: Record<string, unknown>) => void;
}

export interface ShareCardState {
  /** Идёт подготовка картинки — кнопка заблокирована. */
  sharing: boolean;
  /** Текст уехал в буфер — на кнопке галочка. */
  copied: boolean;
  /** Копирование в буфер не удалось — кнопка должна показать отказ. */
  failed: boolean;
  /** Системный шэр не сработал: показываем текст, который можно скопировать. */
  showText: boolean;
  closeText: () => void;
  text: string;
  share: () => Promise<void>;
  copy: () => Promise<boolean>;
}

/**
 * Канвас карточки создаёт сам компонент и передаёт сюда: ref, уехавший в
 * возвращаемый объект, react-hooks справедливо считает обращением к ref
 * во время рендера.
 */
export function useShareCard(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  o: ShareCardOpts,
): ShareCardState {
  const [sharing, setSharing] = useState(false);
  const [showText, setShowText] = useState(false);
  const { copied, failed, copy } = useCopyToClipboard();
  const text = o.fallbackText ?? o.shareText;

  const { draw } = o;
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      draw(canvasRef.current); // не роняем экран при ошибке отрисовки
    } catch (e) {
      console.error('share card draw failed', e);
    }
  }, [draw, canvasRef]);

  const doCopy = useCallback(() => copy(text), [copy, text]);

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
      await doCopy();
      setShowText(true);
    } finally {
      setSharing(false);
    }
  }, [o, doCopy, canvasRef]);

  return {
    sharing,
    copied,
    failed,
    showText,
    closeText: () => setShowText(false),
    text,
    share,
    copy: doCopy,
  };
}
