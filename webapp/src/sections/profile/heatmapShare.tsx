// Шэр «Мой месяц» из хитмапа профиля (ProfileSection.tsx): кнопка + шит с
// карточкой (последние 4 недели активности). Приватного текста нет — только
// точки. Паритет с schema-miniapp/src/sections/profile/heatmapShare.tsx
// (правило №16), рисование — из shared (правило №3), вёрстка своя.
import { useCallback, useState } from 'react';
import { SharePillButton } from '../../share/SharePillButton';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { buildMonthGrid, drawMonthCard } from '../../../../shared/src/share/cards/monthCard';
import { monthShareText } from '../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../utils/botConfig';
import { fmtDate, todayStr } from '../../utils/format';

interface Props {
  activeDates: Set<string>;
  totalDays: number;
}

export function MonthShareButton({ activeDates, totalDays }: Props) {
  const [open, setOpen] = useState(false);
  const today = todayStr();
  const grid = buildMonthGrid(activeDates, today);

  const draw = useCallback(
    (canvas: HTMLCanvasElement) => {
      const from = new Date(`${today}T00:00:00Z`);
      from.setUTCDate(from.getUTCDate() - 27);
      const rangeLabel = `${fmtDate(from.toISOString().slice(0, 10))} — ${fmtDate(today)}`;
      drawMonthCard(canvas, grid, totalDays, rangeLabel);
    },
    [grid, totalDays, today],
  );

  if (grid.activeDays === 0) return null;

  return (
    <>
      <SharePillButton onClick={() => setOpen(true)} label="Поделиться месяцем" />
      {open && (
        <ShareCardSheet
          title="Мой месяц"
          draw={draw}
          shareText={monthShareText(grid.activeDays, botShortUrl)}
          filename="month.png"
          eventKind="month"
          onClose={() => setOpen(false)}
          therapyNote
        />
      )}
    </>
  );
}
