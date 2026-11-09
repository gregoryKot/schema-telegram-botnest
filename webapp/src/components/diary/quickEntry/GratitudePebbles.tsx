// Знак благодарности на листе-герое — Pebbles filled (решение 2, docs/design/APP_2026-11.md):
// окрашено столько камешков, сколько пунктов уже записано (до трёх), остальные ждут пустым тоном.
// Крупно, с тенью-вырезкой (SignScene, как SignHero). SignScene ждёт компонент — компонент на
// число создаётся один раз: новый на каждый рендер React перемонтировал бы знак.
import type { ArtProps } from '../../art/paper';
import { Pebbles } from '../../art/PaperArt';
import { SignScene } from '../../art/SceneParts';

const ART_BY_FILLED = [0, 1, 2, 3].map((n) => function PebblesFilled({ size }: ArtProps) {
  return <Pebbles size={size} filled={n} />;
});

/** Камешки по заполненным пунктам: `filled` вне 0…3 прижимается к краю. */
export function GratitudePebbles({ filled }: { filled: number }) {
  const n = Math.max(0, Math.min(3, Math.floor(filled)));
  return <SignScene Art={ART_BY_FILLED[n]} className="sd-grat-pebbles" />;
}
