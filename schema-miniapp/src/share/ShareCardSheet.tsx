// Generic-шит шаринга карточки: превью канваса + «Поделиться» + «Скопировать
// текст». Все share-карточки приложения (трекер, достижения, схема, дневник)
// ходят через него. Логика — общая (shared/useShareCard, правило №3),
// вёрстка своя: BottomSheet мини-аппа.
import { useRef } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { TherapyNote } from '../components/TherapyNote';
import { ShareIcon } from '../../../shared/src/share/ShareIcon';
import { useShareCard } from '../../../shared/src/share/useShareCard';
import type { ShareCardKind } from '../../../shared/src/share/analytics';
import { api } from '../api';

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
  /** Тип карточки для аналитики share_card (правило №8) */
  eventKind: ShareCardKind;
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
  eventKind,
  onClose,
  zIndex = 200,
  therapyNote,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useShareCard(canvasRef, {
    draw,
    shareText,
    fallbackText,
    filename,
    eventKind,
    track: api.trackEvent,
  });

  return (
    <>
      <BottomSheet onClose={onClose} zIndex={zIndex}>
        <div style={{ paddingTop: 8 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 4,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(var(--fg-rgb),0.5)',
              marginBottom: 18,
            }}
          >
            Картинка уйдёт вместе со ссылкой
          </div>

          <div
            style={{
              borderRadius: 20,
              overflow: 'hidden',
              border: '1px solid rgba(var(--fg-rgb),0.07)',
              boxShadow: '0 14px 34px rgba(0,0,0,0.25)',
              marginBottom: 18,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>

          <button
            onClick={() => void s.share()}
            disabled={s.sharing}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '15px 0',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #8f86ff, #5aa8f7)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: s.sharing ? 0.6 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <ShareIcon size={17} />
            {s.sharing ? 'Готовлю картинку…' : 'Поделиться'}
          </button>
          <button
            onClick={() => void s.copy()}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '13px 0',
              border: 'none',
              borderRadius: 12,
              background: s.copied
                ? 'color-mix(in srgb, var(--accent-green) 18%, transparent)'
                : 'rgba(var(--fg-rgb),0.06)',
              color: s.copied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.65)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {s.copied ? '✓ Текст скопирован' : 'Скопировать текст'}
          </button>
          {therapyNote && (
            <div style={{ marginTop: 12 }}>
              <TherapyNote compact />
            </div>
          )}
        </div>
      </BottomSheet>

      {s.showText && (
        <BottomSheet onClose={s.closeText} zIndex={zIndex + 100}>
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
              {s.text}
            </pre>
            <button
              onClick={() => void s.copy()}
              style={{
                width: '100%',
                padding: '13px 0',
                border: 'none',
                borderRadius: 12,
                background: s.copied
                  ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                  : 'rgba(var(--fg-rgb),0.08)',
                color: s.copied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.7)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {s.copied ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
