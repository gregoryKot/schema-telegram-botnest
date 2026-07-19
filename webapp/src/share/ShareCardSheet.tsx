// Generic-шит шаринга карточки (webapp): превью канваса + «Поделиться» +
// текстовый фолбэк. Парный по смыслу с schema-miniapp/src/share/ShareCardSheet
// (вёрстка своя — правило №3: логика в shared, вёрстка per-frontend).
import { useEffect, useRef, useState } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { shareCanvasImage } from '../../../shared/src/share/shareImage';
import {
  SHARE_CARD_EVENT,
  SHARE_RESULT_EVENT,
  type ShareCardKind,
} from '../../../shared/src/share/analytics';
import { api } from '../api';

interface Props {
  title: string;
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  fallbackText?: string;
  filename: string;
  /** Тип карточки для аналитики share_card (правило №8) */
  eventKind: ShareCardKind;
  onClose: () => void;
  zIndex?: number;
}

export function ShareCardSheet({
  title,
  draw,
  shareText,
  fallbackText,
  filename,
  eventKind,
  onClose,
  zIndex = 300,
}: Props) {
  const goBack = useHistorySheet(onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      draw(canvasRef.current);
    } catch {
      // Отрисовка карточки не должна ронять весь экран
    }
  }, [draw]);

  const textForFallback = fallbackText ?? shareText;

  async function handleShare() {
    if (!canvasRef.current) return;
    setSharing(true);
    try {
      await shareCanvasImage(canvasRef.current, shareText, filename, {
        downloadFallback: true,
      });
      api.trackEvent(SHARE_CARD_EVENT, { kind: eventKind });
      api.trackEvent(SHARE_RESULT_EVENT, { kind: eventKind, ok: true });
    } catch {
      // Шэр не удался — текстовый фолбэк + клипборд
      api.trackEvent(SHARE_RESULT_EVENT, { kind: eventKind, ok: false });
      try {
        await navigator.clipboard.writeText(textForFallback);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* best-effort: ошибку намеренно игнорируем */
      }
      setShowText(true);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={goBack}
    >
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 24px 48px',
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--surface-3)',
            margin: '0 auto 20px',
          }}
        />
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          {title}
        </div>

        <div
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--line)',
            marginBottom: 20,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>

        {showText && (
          <pre
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
              background: 'var(--surface-2)',
              borderRadius: 12,
              padding: '12px 14px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: 14,
              userSelect: 'all',
              fontFamily: 'inherit',
            }}
          >
            {textForFallback}
          </pre>
        )}

        <button
          onClick={handleShare}
          disabled={sharing}
          className="ex-btn ex-btn-primary"
          style={{
            width: '100%',
            background: copied
              ? 'color-mix(in srgb, var(--c-moss) 20%, transparent)'
              : 'var(--accent)',
            color: copied ? 'var(--c-moss)' : 'var(--on-accent)',
          }}
        >
          {copied ? '✓ Скопировано' : sharing ? 'Подготовка...' : 'Поделиться'}
        </button>
      </div>
    </div>
  );
}
