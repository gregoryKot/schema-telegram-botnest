// Экран «Карточка недели» — отрисовка и расчёты в shared/src/share
// (единственная копия, правило №3). Здесь только вёрстка ExScreen и share-флоу.
// Парный файл: schema-miniapp/src/components/WeeklyCardSheet.tsx.
import { useEffect, useRef, useState } from 'react';
import type { Need, DayHistory } from '../types';
import { ExScreen } from './exercises/ExScreen';
import { TherapyNote } from './TherapyNote';
import { BottomSheetShell } from './BottomSheetShell';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api, reportClientError } from '../api';
import {
  drawWeeklyCard,
  buildWeeklyShareText,
} from '../../../shared/src/share/cards/weeklyCard';
import { shareCanvasImage } from '../../../shared/src/share/shareImage';
import {
  SHARE_CARD_EVENT,
  SHARE_RESULT_EVENT,
} from '../../../shared/src/share/analytics';
import { useCopyToClipboard } from '../../../shared/src/utils/useCopyToClipboard';
import { botShortUrl } from '../utils/botConfig';
import { useTr } from '../utils/addressForm';
import '../styles/sheet-diary.css';

interface Props {
  needs: Need[];
  history: DayHistory[];
  onClose: () => void;
}

export function WeeklyCardSheet({ needs, history, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streak, setStreak] = useState(0);
  const [sharing, setSharing] = useState(false);
  const { copied, copy } = useCopyToClipboard({
    onError: () => reportClientError({ message: 'weekly card clipboard write failed', section: 'weeklyCard' }),
  });
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const { copied: fallbackCopied, copy: copyFallback } = useCopyToClipboard({
    onError: () => reportClientError({ message: 'weekly card fallback clipboard write failed', section: 'weeklyCard' }),
  });

  useEffect(() => {
    api
      .getStreak()
      .then((s) => setStreak(s.currentStreak))
      .catch(() => reportClientError({ message: 'weekly card streak load failed', section: 'weeklyCard' }));
  }, []);

  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;
    try {
      drawWeeklyCard(canvasRef.current, needs, history, streak);
    } catch { reportClientError({ message: 'weekly card draw failed', section: 'weeklyCard' }); } // не роняем экран
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
      api.trackEvent(SHARE_CARD_EVENT, { kind: 'weekly' });
      api.trackEvent(SHARE_RESULT_EVENT, { kind: 'weekly', ok: true });
    } catch {
      api.trackEvent(SHARE_RESULT_EVENT, { kind: 'weekly', ok: false });
      const text = buildWeeklyShareText(needs, history, streak, true, botShortUrl);
      await copy(text);
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
      title={
        <>
          Карточка
          <br />
          <span className="it">для поделиться</span>
        </>
      }
      lede={tr('Сводка потребностей за неделю в виде карточки – сохрани или отправь терапевту.', 'Сводка потребностей за неделю в виде карточки – сохраните или отправьте терапевту.')}
    >
      {history.length === 0 ? (
        <div className="sd-weekly-empty">Нет данных за неделю</div>
      ) : (
        <>
          <div className="ds-card ds-card--flush sd-canvas">
            <canvas ref={canvasRef} className="sd-canvas-el" />
          </div>

          <div className="sd-foot">
            <span className="sd-spacer" />
            <button
              onClick={handleShare}
              disabled={sharing}
              className={'ds-btn' + (copied ? ' sd-btn-ok' : '')}
            >
              {copied
                ? '✓ Скопировано'
                : sharing
                  ? 'Подготовка...'
                  : 'Поделиться'}
            </button>
          </div>

          {/* Заход на терапию после «Поделиться» — паритет с miniapp
              WeeklyCardSheet (В10 аудита 2026-08). Этот экран не ходит через
              ShareCardSheet (собственный share-флоу с .ics-независимым
              фолбэком), поэтому TherapyNote вставлен напрямую. */}
          <div className="u-mt16">
            <TherapyNote compact />
          </div>
        </>
      )}

      {fallbackText && (
        <BottomSheetShell goBack={() => setFallbackText(null)} zIndex={300}>
          <h2 className="ds-h3 sd-share-title">Поделиться текстом</h2>
          <pre className="sd-pre">{fallbackText}</pre>
          <button
            onClick={() => void copyFallback(fallbackText)}
            className={'ds-btn ds-btn--secondary sd-wide' + (fallbackCopied ? ' is-ok' : '')}
          >
            {fallbackCopied ? '✓ Скопировано' : 'Скопировать'}
          </button>
        </BottomSheetShell>
      )}
    </ExScreen>
  );
}
