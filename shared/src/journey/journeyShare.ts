// Сборка шаринга «Моего пути» — единственная копия для обоих фронтендов:
// «лента по времени» (кнопка сверху) и «один шаг» (тап по записи).
// Возвращает готовые пропсы для per-frontend ShareCardSheet.
import { useMemo, useState } from 'react';
import {
  type JourneyItem,
  type JourneyPeriod,
  JOURNEY_GROUP_COLORS,
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
import { drawJourneyResultCard } from '../share/cards/journeyResultCard';
import type { JourneyResultPart } from './journeyContent';
import {
  journeyItemShareText,
  journeyShareText,
  pluralEntries,
} from '../share/shareTexts';
import type { ShareCardKind } from '../share/analytics';

export type JourneyShareState =
  | { kind: 'feed' }
  | { kind: 'item'; item: JourneyItem; parts: JourneyResultPart[] | null };

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
  subtitle: (item: JourneyItem) => string | null,
  link: string,
  period: JourneyPeriod = 'all',
): JourneySharePayload {
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
  // Есть содержимое → карточка-результат с текстом; нет — карточка шага.
  if (share.parts?.length) {
    const data = {
      emoji: meta.emoji,
      label: meta.label,
      day,
      hex,
      parts: share.parts,
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
  j: { items: JourneyItem[]; total: number; period: JourneyPeriod },
  subtitle: (item: JourneyItem) => string | null,
  link: string,
  fetchResult: (item: JourneyItem) => Promise<JourneyResultPart[] | null>,
) {
  const [share, setShare] = useState<JourneyShareState | null>(null);
  const payload = useMemo(
    () =>
      share
        ? buildJourneySharePayload(
            share,
            j.items,
            j.total,
            subtitle,
            link,
            j.period,
          )
        : null,
    [share, j.items, j.total, j.period, subtitle, link],
  );
  return {
    payload,
    shareFeed: () => setShare({ kind: 'feed' }),
    // Сначала тянем содержимое записи (расшифровывающий эндпоинт) — если
    // не вышло/нечего, показываем обычную карточку шага.
    shareItem: (item: JourneyItem) => {
      void fetchResult(item)
        .catch(() => null)
        .then((parts) => setShare({ kind: 'item', item, parts }));
    },
    close: () => setShare(null),
  };
}
