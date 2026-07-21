// Сборка шаринга «Моего пути» — единственная копия для обоих фронтендов:
// «лента по времени» (кнопка сверху) и «один шаг» (тап по записи).
// Возвращает готовые пропсы для per-frontend ShareCardSheet.
import { useMemo, useState } from 'react';
import {
  type JourneyItem,
  JOURNEY_GROUP_COLORS,
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
import { journeyItemShareText, journeyShareText } from '../share/shareTexts';
import type { ShareCardKind } from '../share/analytics';

export type JourneyShareState =
  { kind: 'feed' } | { kind: 'item'; item: JourneyItem };

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
): JourneySharePayload {
  if (share.kind === 'feed') {
    // Карточка-лента всегда показывает последние шаги, независимо от
    // выбранной на экране сортировки.
    const rows = buildJourneyCardRows(
      sortJourneyItems(items, 'desc'),
      JOURNEY_CARD_MAX_ROWS,
    );
    return {
      title: 'Мой путь',
      draw: (canvas) => drawJourneyCard(canvas, rows, total),
      shareText: journeyShareText(total, link),
      filename: 'journey.png',
      eventKind: 'journey',
    };
  }
  const meta = journeyTypeMeta(share.item.type);
  const data = {
    emoji: meta.emoji,
    label: meta.label,
    sub: subtitle(share.item),
    day: formatJourneyDay(share.item.at),
    hex: JOURNEY_GROUP_COLORS[meta.group].hex,
  };
  return {
    title: 'Шаг пути',
    draw: (canvas) => drawJourneyItemCard(canvas, data),
    shareText: journeyItemShareText(meta.emoji, meta.label, link),
    filename: 'journey-step.png',
    eventKind: 'journey_item',
  };
}

/**
 * Состояние шаринга экрана: кнопка «поделиться» → лента, тап по записи →
 * один шаг. payload — готовые пропсы для ShareCardSheet (null = шит закрыт).
 */
export function useJourneyShare(
  j: { items: JourneyItem[]; total: number },
  subtitle: (item: JourneyItem) => string | null,
  link: string,
) {
  const [share, setShare] = useState<JourneyShareState | null>(null);
  const payload = useMemo(
    () =>
      share
        ? buildJourneySharePayload(share, j.items, j.total, subtitle, link)
        : null,
    [share, j.items, j.total, subtitle, link],
  );
  return {
    payload,
    shareFeed: () => setShare({ kind: 'feed' }),
    shareItem: (item: JourneyItem) => setShare({ kind: 'item', item }),
    close: () => setShare(null),
  };
}
