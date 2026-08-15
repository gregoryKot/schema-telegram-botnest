// Generic-шит шаринга карточки: превью канваса + «Поделиться» + «Скопировать текст».
// Все share-карточки приложения ходят через него. Логика общая (shared/useShareCard,
// правило №3), вёрстка своя: BottomSheet мини-аппа.
import { useRef } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { TherapyNote } from '../components/TherapyNote';
import { ShareIcon } from '../../../shared/src/share/ShareIcon';
import { useShareCard } from '../../../shared/src/share/useShareCard';
import type { ShareCardKind } from '../../../shared/src/share/analytics';
import { api } from '../api';

interface Props {
  title: string; // Заголовок шита («Карточка недели», «Достижение»…)
  draw: (canvas: HTMLCanvasElement) => void; // Рисует карточку, вызывается при открытии
  shareText: string; // Короткий текст, уходящий вместе с картинкой
  fallbackText?: string; // Подробный текст для фолбэка (по умолчанию shareText)
  filename: string;
  eventKind: ShareCardKind; // Тип карточки для аналитики share_card (правило №8)
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
  // Три состояния кнопки «Скопировать» повторяются дважды — общий индекс вместо копипасты ternary.
  const st = s.copied ? 0 : s.failed ? 1 : 2;
  const mix = (c: string, pct: number) =>
    `color-mix(in srgb, ${c} ${pct}%, transparent)`;
  const copyBg = (g: number, idle: string) =>
    [mix('var(--accent-green)', g), mix('var(--accent-red)', 15), idle][st];
  const copyColor = (idle: string) =>
    ['#06d6a0', 'var(--accent-red)', idle][st];
  const copyLabel = (done: string, idle: string) =>
    [done, 'Не получилось', idle][st];

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
              background:
                'linear-gradient(135deg, var(--accent), var(--accent-hi))',
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
              background: copyBg(18, 'rgba(var(--fg-rgb),0.06)'),
              color: copyColor('rgba(var(--fg-rgb),0.65)'),
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copyLabel('✓ Текст скопирован', 'Скопировать текст')}
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
                background: copyBg(20, 'rgba(var(--fg-rgb),0.08)'),
                color: copyColor('rgba(var(--fg-rgb),0.7)'),
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copyLabel('✓ Скопировано', 'Скопировать')}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
