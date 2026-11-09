// Знак пункта меню, вкладки и кнопок рамки по ключу ENTITY_LOOK (docs/design/APP_2026-11.md,
// «Меню, ⌘K, объединение»). Подмножество реестра SignArt (art/SignArt.tsx): рамка кабинета живёт в
// главном чанке, и в него идут только мотивы кабинета PaperArt* (~6 КБ), а не знаки листов
// подсказок, доменов и потребностей — те остаются в чанках экранов. Рисунок тот же, что у SignArt
// по тому же ключу (те же компоненты мотивов), — сверка в navLook.test.tsx (правило №4).
import type { ReactElement } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import type { ArtProps } from '../art/paper';
import { Breath, Cup, Layers, Pebbles, Strokes } from '../art/PaperArt';
import { Beads, Check, Cluster, Heart, Leaf, Talk } from '../art/PaperArtSigns';

export const NAV_ART = {
  strokes: Strokes, pebbles: Pebbles, breath: Breath, layers: Layers, cup: Cup,
  leaf: Leaf, beads: Beads, talk: Talk, cluster: Cluster, check: Check, heart: Heart,
} satisfies Partial<Record<SignKey, (p: ArtProps) => ReactElement | null>>;
export type NavSignKey = keyof typeof NAV_ART;

/** Знак рамки: по умолчанию размер `nav` (24×14, styles/paper.css); место крупнее задаёт CSS. */
export function NavSign({ sign, size = 'nav' }: { sign: NavSignKey; size?: ArtProps['size'] }) {
  const Art = NAV_ART[sign];
  return <Art size={size} />;
}
