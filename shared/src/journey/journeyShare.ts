// Сборка шаринга «Моего пути» — единственная копия для обоих фронтендов:
// «лента по времени» (кнопка сверху), «итоги» (кнопка в hero) и «один шаг»
// (шаринг из детального вида записи).
// Возвращает готовые пропсы для per-frontend ShareCardSheet.
import { useMemo, useState } from 'react';
import { COLORS } from '../types';
import {
  type JourneyItem,
  type JourneyPeriod,
  JOURNEY_GROUP_COLORS,
  JOURNEY_NEED_EMOJI,
  JOURNEY_NEED_NAMES,
  JOURNEY_PERIOD_TITLE,
  buildJourneyCardRows,
  formatJourneyDay,
  journeyTypeMeta,
  sortJourneyItems,
} from './journeyMeta';
import {
  JOURNEY_CARD_MAX_ROWS,
  drawJourneyCard,
} from '../share/cards/journeyCard';
import { drawJourneyItemCard } from '../share/cards/journeyItemCard';
import { drawJourneyTotalsCard } from '../share/cards/journeyTotalsCard';
import type { JourneyStatRow } from './journeyStats';
import { drawJourneyResultCard } from '../share/cards/journeyResultCard';
import {
  drawNeedsRadarCard,
  type NeedsRadarRow,
} from '../share/cards/needsRadarCard';
import {
  buildYsqProfile,
  drawYsqProfileCard,
} from '../share/cards/ysqProfileCard';
import { buildYsqShareText, ysqCardHeadline } from '../share/cards/ysqCard';
import type { JourneyResult } from './journeyContent';
import {
  journeyItemShareText,
  journeyShareText,
  pluralEntries,
} from '../share/shareTexts';
import type { ShareCardKind } from '../share/analytics';

export type JourneyShareState =
  | { kind: 'feed' }
  | { kind: 'totals' }
  | { kind: 'item'; item: JourneyItem; result: JourneyResult | null };

/** Строки радара из оценок дня трекера — порядок как в COLORS/JOURNEY_NEED_NAMES.
 * Пропущенная потребность не превращается в ноль (правило «никаких заглушек»).
 * Чистая (тест: пустые/частичные оценки). */
export function journeyRadarRows(
  ratings: Record<string, number> | undefined,
): NeedsRadarRow[] {
  return Object.keys(JOURNEY_NEED_NAMES).map((id) => {
    const value = ratings?.[id];
    return {
      emoji: JOURNEY_NEED_EMOJI[id],
      label: JOURNEY_NEED_NAMES[id],
      color: COLORS[id] ?? '#888',
      value: value ?? null,
      valueText: value !== undefined ? String(value) : '—',
    };
  });
}

/** Индекс дня для центра радара — среднее по отмеченным, «—» без оценок. Чистая. */
export function journeyRadarIndex(
  ratings: Record<string, number> | undefined,
): string {
  const vals = Object.keys(JOURNEY_NEED_NAMES)
    .map((id) => ratings?.[id])
    .filter((v): v is number => typeof v === 'number');
  return vals.length
    ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1)
    : '—';
}

export interface JourneySharePayload {
  title: string;
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  filename: string;
  eventKind: ShareCardKind;
}

export function buildJourneySharePayload(
  share: JourneyShareState,
  items: readonly JourneyItem[],
  total: number,
  stats: JourneyStatRow[],
  subtitle: (item: JourneyItem) => string | null,
  link: string,
  period: JourneyPeriod = 'all',
): JourneySharePayload {
  if (share.kind === 'totals') {
    // «Дневник 5 раз, трекер 7 раз…» — счётчики за всё время.
    return {
      title: 'Итоги пути',
      draw: (canvas) => drawJourneyTotalsCard(canvas, stats, total),
      shareText: journeyShareText(total, link),
      filename: 'journey-totals.png',
      eventKind: 'journey',
    };
  }
  if (share.kind === 'feed') {
    const rows = buildJourneyCardRows(
      sortJourneyItems(items, 'desc'),
      JOURNEY_CARD_MAX_ROWS,
    );
    // За период счётчик и подпись — по выбранному периоду (не «всё время»).
    const count = period === 'all' ? total : items.length;
    const title = JOURNEY_PERIOD_TITLE[period];
    const sub =
      period === 'all'
        ? undefined
        : `${count} ${pluralEntries(count)} заботы о себе`;
    return {
      title,
      draw: (canvas) => drawJourneyCard(canvas, rows, count, title, sub),
      shareText: journeyShareText(count, link, period),
      filename: period === 'all' ? 'journey.png' : `journey-${period}.png`,
      eventKind: 'journey',
    };
  }
  const meta = journeyTypeMeta(share.item.type);
  const hex = JOURNEY_GROUP_COLORS[meta.group].hex;
  const day = formatJourneyDay(share.item.at);
  const shareText = journeyItemShareText(meta.emoji, meta.label, link);
  // День трекера — не текстовая строка «Привязанность — 7 · …», а радар
  // потребностей (та же карточка, что у дня/недели трекера).
  if (share.item.type === 'tracker_day' && share.result?.ratings) {
    const ratings = share.result.ratings;
    const data = {
      eyebrow: 'Трекер потребностей',
      title: 'Мой день',
      subtitle: day,
      rows: journeyRadarRows(ratings),
      center: { value: journeyRadarIndex(ratings), caption: 'индекс' },
      footerLabel: 'Мой путь',
      accent: 'var(--accent-blue)',
      accent2: 'var(--accent)',
    };
    return {
      title: 'Результат',
      draw: (canvas) => drawNeedsRadarCard(canvas, data),
      shareText,
      filename: 'journey-result.png',
      eventKind: 'journey_item',
    };
  }
  // Тест на схемы — не строка «Выраженных схем: 6 из 20», а профиль всех
  // 20 схем барами (та же карточка, что на экране результата теста).
  if (share.item.type === 'ysq' && share.result?.ysq) {
    const { scores, activeCount } = share.result.ysq;
    const domains = buildYsqProfile(scores);
    const opts = { headline: ysqCardHeadline(activeCount), dateLabel: day };
    return {
      title: 'Результат теста',
      draw: (canvas) => drawYsqProfileCard(canvas, domains, opts),
      shareText: buildYsqShareText(activeCount, link),
      filename: 'journey-schema-test.png',
      eventKind: 'journey_item',
    };
  }
  // Есть содержимое → карточка-результат с текстом; нет — карточка шага.
  if (share.result?.parts.length) {
    const data = {
      emoji: meta.emoji,
      label: meta.label,
      day,
      hex,
      parts: share.result.parts,
    };
    return {
      title: 'Результат',
      draw: (canvas) => drawJourneyResultCard(canvas, data),
      shareText,
      filename: 'journey-result.png',
      eventKind: 'journey_item',
    };
  }
  const data = {
    emoji: meta.emoji,
    label: meta.label,
    sub: subtitle(share.item),
    day,
    hex,
  };
  return {
    title: 'Шаг пути',
    draw: (canvas) => drawJourneyItemCard(canvas, data),
    shareText,
    filename: 'journey-step.png',
    eventKind: 'journey_item',
  };
}

/**
 * Состояние шаринга экрана: кнопка «поделиться» → лента, тап по записи →
 * один шаг. payload — готовые пропсы для ShareCardSheet (null = шит закрыт).
 */
export function useJourneyShare(
  j: {
    items: JourneyItem[];
    total: number;
    stats: JourneyStatRow[];
    period: JourneyPeriod;
  },
  subtitle: (item: JourneyItem) => string | null,
  link: string,
  fetchResult: (item: JourneyItem) => Promise<JourneyResult | null>,
) {
  const [share, setShare] = useState<JourneyShareState | null>(null);
  const payload = useMemo(
    () =>
      share
        ? buildJourneySharePayload(
            share,
            j.items,
            j.total,
            j.stats,
            subtitle,
            link,
            j.period,
          )
        : null,
    [share, j.items, j.total, j.stats, j.period, subtitle, link],
  );
  return {
    payload,
    shareFeed: () => setShare({ kind: 'feed' }),
    shareTotals: () => setShare({ kind: 'totals' }),
    // Сначала тянем содержимое записи (расшифровывающий эндпоинт) — если
    // не вышло/нечего, показываем обычную карточку шага.
    shareItem: (item: JourneyItem) => {
      void fetchResult(item)
        .catch(() => null)
        .then((result) => setShare({ kind: 'item', item, result }));
    },
    close: () => setShare(null),
  };
}
