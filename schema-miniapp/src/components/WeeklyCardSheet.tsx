// Шит «Карточка недели» — тонкая обёртка над общим share-китом
// (src/share/): отрисовка в share/cards/weeklyCard.ts, UI — ShareCardSheet.
import { useCallback, useEffect, useState } from 'react';
import { Need, DayHistory } from '../types';
import { BottomSheet } from './BottomSheet';
import { api } from '../api';
import {
  drawWeeklyCard,
  buildWeeklyShareText,
} from '../../../shared/src/share/cards/weeklyCard';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { botShortUrl } from '../utils/botConfig';

interface Props {
  needs: Need[];
  history: DayHistory[];
  onClose: () => void;
}

export function WeeklyCardSheet({ needs, history, onClose }: Props) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    api
      .getStreak()
      .then((s) => setStreak(s.currentStreak))
      .catch(() => {});
  }, []);

  const draw = useCallback(
    (canvas: HTMLCanvasElement) => {
      drawWeeklyCard(canvas, needs, history, streak);
    },
    [needs, history, streak],
  );

  if (history.length === 0) {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 8 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 20,
            }}
          >
            Карточка недели
          </div>
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-sub)',
              padding: '32px 0',
            }}
          >
            Нет данных за неделю
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <ShareCardSheet
      title="Карточка недели"
      draw={draw}
      shareText={buildWeeklyShareText(
        needs,
        history,
        streak,
        false,
        botShortUrl,
      )}
      fallbackText={buildWeeklyShareText(
        needs,
        history,
        streak,
        true,
        botShortUrl,
      )}
      filename="needs-week.png"
      onClose={onClose}
      therapyNote
    />
  );
}
