// Generic-шит шаринга карточки: превью канваса + кнопка «Поделиться» +
// текстовый фолбэк, если системный шэр недоступен/упал. Все share-карточки
// приложения (трекер, достижения, схема, дневник) ходят через него.
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { TherapyNote } from '../components/TherapyNote';
import { shareCanvasImage } from '../../../shared/src/share/shareImage';

interface Props {
  /** Заголовок шита («Карточка недели», «Достижение»…) */
  title: string;
  /** Рисует карточку на канвасе. Вызывается при открытии. */
  draw: (canvas: HTMLCanvasElement) => void;
  /** Короткий текст, уходящий вместе с картинкой */
  shareText: string;
  /** Подробный текст для фолбэка (по умолчанию shareText) */
  fallbackText?: string;
  filename: string;
  onClose: () => void;
  zIndex?: number;
  therapyNote?: boolean;
}

export function ShareCardSheet({
  title,
  draw,
  shareText,
  fallbackText,
  filename,
  onClose,
  zIndex = 200,
  therapyNote,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackCopied, setFallbackCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      draw(canvasRef.current);
    } catch {
      // Отрисовка карточки не должна ронять весь экран
    }
  }, [draw]);

  async function handleShare() {
    if (!canvasRef.current) return;
    setSharing(true);
    try {
      await shareCanvasImage(canvasRef.current, shareText, filename, {
        downloadFallback: true,
      });
    } catch {
      // Шэр не удался — показываем текстовый фолбэк
      const text = fallbackText ?? shareText;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* best-effort: ошибку намеренно игнорируем */
      }
      setShowFallback(true);
    } finally {
      setSharing(false);
    }
  }

  const textForFallback = fallbackText ?? shareText;

  return (
    <>
      <BottomSheet onClose={onClose} zIndex={zIndex}>
        <div style={{ paddingTop: 8 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 20,
            }}
          >
            {title}
          </div>

          <div
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid rgba(var(--fg-rgb),0.06)',
              marginBottom: 20,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>

          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              width: '100%',
              padding: '15px 0',
              borderRadius: 14,
              border: 'none',
              background: copied
                ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                : 'linear-gradient(135deg, #a78bfa, #4fa3f7)',
              color: copied ? '#06d6a0' : '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: sharing ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {copied
              ? '✓ Скопировано'
              : sharing
                ? 'Подготовка...'
                : 'Поделиться'}
          </button>
          {therapyNote && (
            <div style={{ marginTop: 12 }}>
              <TherapyNote compact />
            </div>
          )}
        </div>
      </BottomSheet>

      {showFallback && (
        <BottomSheet
          onClose={() => {
            setShowFallback(false);
            setFallbackCopied(false);
          }}
          zIndex={zIndex + 100}
        >
          <div style={{ paddingTop: 4 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 12,
              }}
            >
              Поделиться текстом
            </div>
            <pre
              style={{
                fontSize: 12,
                color: 'rgba(var(--fg-rgb),0.7)',
                lineHeight: 1.6,
                background: 'rgba(var(--fg-rgb),0.04)',
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
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(textForFallback);
                  setFallbackCopied(true);
                  setTimeout(() => setFallbackCopied(false), 2000);
                } catch {
                  /* best-effort: ошибку намеренно игнорируем */
                }
              }}
              style={{
                width: '100%',
                padding: '13px 0',
                border: 'none',
                borderRadius: 12,
                background: fallbackCopied
                  ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                  : 'rgba(var(--fg-rgb),0.08)',
                color: fallbackCopied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.7)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {fallbackCopied ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
