// Generic-шит шаринга карточки (webapp): превью канваса + «Поделиться» +
// «Скопировать текст». Парный по смыслу с schema-miniapp/src/share/ShareCardSheet
// (вёрстка своя — правило №3: логика в shared/useShareCard, вёрстка per-frontend).
import { useRef } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { ShareIcon } from '../../../shared/src/share/ShareIcon';
import { useShareCard } from '../../../shared/src/share/useShareCard';
import type { ShareCardKind } from '../../../shared/src/share/analytics';
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
  const s = useShareCard(canvasRef, {
    draw,
    shareText,
    fallbackText,
    filename,
    eventKind,
    track: api.trackEvent,
  });

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
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 18 }}
        >
          Картинка уйдёт вместе со ссылкой
        </div>

        <div
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            border: '1px solid var(--line)',
            boxShadow: '0 14px 34px rgba(0,0,0,0.22)',
            marginBottom: 18,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>

        {s.showText && (
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
            {s.text}
          </pre>
        )}

        <button
          onClick={() => void s.share()}
          disabled={s.sharing}
          className="ex-btn ex-btn-primary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            opacity: s.sharing ? 0.6 : 1,
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
            padding: '12px 0',
            border: 'none',
            borderRadius: 12,
            background: 'var(--surface-2)',
            color: s.copied ? 'var(--c-moss)' : 'var(--text-sub)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {s.copied ? '✓ Текст скопирован' : 'Скопировать текст'}
        </button>
      </div>
    </div>
  );
}
