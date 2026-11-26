// Кнопка «Поделиться месяцем» из хитмапа профиля (ProfileSection) —
// единственная копия (правило №3). Была продублирована 1-в-1 при переносе
// шаринга на сайт: единственное, что реально отличается по площадке, —
// сама кнопка (SharePillButton webapp / SharePill compact miniapp) и
// ShareCardSheet (вёрстка своя, правило задокументировано в файле каждого
// фронта) — оба приходят инъекцией, как tr/trackEvent в Celebration.tsx.
import {
  useCallback,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { buildMonthGrid, drawMonthCard } from './cards/monthCard';
import { monthShareText } from './shareTexts';
import { fmtDate, todayStr } from '../utils/format';
import type { ShareCardSheetProps } from './shareCardSheetProps';

export interface MonthShareButtonProps {
  activeDates: Set<string>;
  totalDays: number;
  botShortUrl: string;
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  renderButton: (onClick: () => void) => ReactNode;
}

export function MonthShareButton({
  activeDates,
  totalDays,
  botShortUrl,
  ShareCardSheet,
  renderButton,
}: MonthShareButtonProps) {
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
      {renderButton(() => setOpen(true))}
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
