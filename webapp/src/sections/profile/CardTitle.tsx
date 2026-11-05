import type { ReactNode } from 'react';
import { Strokes, Sheets } from '../../components/art/PaperArt';
import { Heart, Leaf } from '../../components/art/PaperArtSigns';

/** Знак по сущности карточки профиля (таблица «мотив → смысл», docs/design/PAPER_2026-11.md). */
const SIGNS = {
  journey: Sheets,
  achievements: Leaf,
  portrait: Strokes,
  warm: Heart,
};
export type CardSign = keyof typeof SIGNS;

/** Заголовок карточки профиля: знак слева, h2 рядом. */
export function CardTitle({ sign, children }: { sign: CardSign; children: ReactNode }) {
  const Sign = SIGNS[sign];
  return (
    <span className="cpf-title">
      <span className="pp-row-art"><Sign size="row" /></span>
      <h2 className="ds-h3">{children}</h2>
    </span>
  );
}
