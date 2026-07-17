// Экран «Карточка недели» — отрисовка и расчёты в shared/src/share
// (единственная копия, правило №3). Здесь только вёрстка ExScreen и share-флоу.
// Парный файл: schema-miniapp/src/components/WeeklyCardSheet.tsx.
import { useEffect, useRef, useState } from 'react';
import type { Need, DayHistory } from '../types';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api } from '../api';
import {
  drawWeeklyCard,
  buildWeeklyShareText,
} from '../../../shared/src/share/cards/weeklyCard';
import { shareCanvasImage } from '../../../shared/src/share/shareImage';
import { botShortUrl } from '../utils/botConfig';

interface Props {
  needs: Need[];
  history: DayHistory[];
  onClose: () => void;
}

export function WeeklyCardSheet({ needs, history, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streak, setStreak] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [fallbackCopied, setFallbackCopied] = useState(false);

  useEffect(() => {
    api
      .getStreak()
      .then((s) => setStreak(s.currentStreak))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;
    try {
      drawWeeklyCard(canvasRef.current, needs, history, streak);
    } catch {
      // Отрисовка карточки не должна ронять весь экран
    }
  }, [needs, history, streak]);

  async function handleShare() {
    if (!canvasRef.current) return;
    setSharing(true);
    try {
      await shareCanvasImage(
        canvasRef.current,
        buildWeeklyShareText(needs, history, streak, false, botShortUrl),
        'needs-week.png',
        { downloadFallback: true },
      );
    } catch {
      const text = buildWeeklyShareText(needs, history, streak, true, botShortUrl);
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* best-effort: ошибку намеренно игнорируем */
      }
      setFallbackText(text);
    } finally {
      setSharing(false);
    }
  }

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к истории"
      eyebrow="Итоги недели"
      eyebrowColor="var(--accent)"
      title={
        <>
          Карточка
          <br />
          <span className="it">для поделиться</span>
        </>
      }
      lede="Сводка потребностей за неделю в виде карточки – сохрани или отправь терапевту."
    >
      {history.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-sub)',
            padding: '48px 0',
            fontSize: 15,
          }}
        >
          Нет данных за неделю
        </div>
      ) : (
        <>
          <div
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid var(--line)',
              marginBottom: 24,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>

          <div className="ex-foot">
            <span className="spacer" />
            <button
              onClick={handleShare}
              disabled={sharing}
              className="ex-btn ex-btn-primary"
              style={{
                background: copied
                  ? 'color-mix(in srgb, var(--c-moss) 20%, transparent)'
                  : 'var(--accent)',
                color: copied ? 'var(--c-moss)' : 'var(--on-accent)',
              }}
            >
              {copied
                ? '✓ Скопировано'
                : sharing
                  ? 'Подготовка...'
                  : 'Поделиться'}
            </button>
          </div>
        </>
      )}

      {fallbackText && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => {
            setFallbackText(null);
            setFallbackCopied(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)',
              borderRadius: '20px 20px 0 0',
              padding: '24px 24px 48px',
              width: '100%',
              maxWidth: 560,
              margin: '0 auto',
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
                marginBottom: 12,
              }}
            >
              Поделиться текстом
            </div>
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
              {fallbackText}
            </pre>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fallbackText);
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
                  ? 'color-mix(in srgb, var(--c-moss) 20%, transparent)'
                  : 'var(--surface-2)',
                color: fallbackCopied ? 'var(--c-moss)' : 'var(--text-sub)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {fallbackCopied ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}
    </ExScreen>
  );
}
