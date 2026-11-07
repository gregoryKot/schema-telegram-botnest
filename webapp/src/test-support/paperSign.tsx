// Какой знак бумажной аппликации нарисован (components/art/PaperArt*.tsx): сверка
// разметки svg с эталоном каждого мотива. Тест называет знак словом («Cluster»),
// а не сравнивает классы: размер у всех мотивов общий, различает их только рисунок.
// Кроме мотивов — знаки групп режимов (GuideSigns.tsx) и доменов схем (DomainArt).
import type { ComponentType } from 'react';
import { render } from '@testing-library/react';
import { Breath, Cup, Layers, Pebbles, Ribbon, Sheets, Strokes } from '../components/art/PaperArt';
import { Beads, Check, Cluster, Heart, Leaf, Talk, Wheel } from '../components/art/PaperArtSigns';
import { ChildCare, Looming, Shelter, Shield, Together, Yield } from '../components/art/GuideSigns';
import { DomainArt } from '../components/art/DomainArt';
import type { ArtProps } from '../components/art/paper';

/** Домен схем по номеру: «Domain1» … «Domain5» (DomainArt). */
const domain = (n: number) => function Domain({ size }: ArtProps) { return <DomainArt domain={n} size={size} />; };

const SIGNS: Record<string, ComponentType<ArtProps>> = {
  Breath, Cup, Layers, Pebbles, Ribbon, Sheets, Strokes, Beads, Check, Cluster, Heart, Leaf, Talk, Wheel,
  ChildCare, Looming, Shelter, Shield, Together, Yield,
  Domain1: domain(1), Domain2: domain(2), Domain3: domain(3), Domain4: domain(4), Domain5: domain(5),
};

/** Имя мотива, который нарисован в `svg`; нет svg — null, рисунок не из библиотеки — 'unknown'. */
export function paperSignName(svg: Element | null | undefined): string | null {
  if (!svg) return null;
  for (const [name, Art] of Object.entries(SIGNS)) {
    const probe = render(<Art size="empty" />, { container: document.createElement('div') });
    const same = probe.container.querySelector('svg')?.innerHTML === svg.innerHTML;
    probe.unmount();
    if (same) return name;
  }
  return 'unknown';
}
