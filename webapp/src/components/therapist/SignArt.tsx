import type { ReactNode } from 'react';
import { Layers, Pebbles, Strokes } from '../art/PaperArt';
import { Check, Cluster, Heart, Talk } from '../art/PaperArtSigns';
import '../../styles/therapist-sign.css';

// Знаки кабинета терапевта (docs/design/PAPER_2026-11.md, «Язык знаков»): круги-реплики — люди и
// разговор, камешки — заметки, галочка — задание, слои — схемы и концептуализация, круги — режимы,
// полоски — индекс и трекер, сердце — «требуют внимания».
const SIGNS = { talk: Talk, pebbles: Pebbles, check: Check, layers: Layers, cluster: Cluster, strokes: Strokes, heart: Heart } as const;
export type SignKind = keyof typeof SIGNS;

export function Sign({ kind, className = '' }: { kind: SignKind; className?: string }) {
  const Art = SIGNS[kind];
  return <span className={`pp-row-art ${className}`.trim()}><Art size="row" /></span>;
}

type HeadTag = 'h2' | 'h3' | 'div';

/** Подпись блока со знаком слева: тот же тег и класс, что были у подписи без знака. */
export function SignHead({ kind, as: Tag = 'h2', className, children }: { kind: SignKind; as?: HeadTag; className?: string; children: ReactNode }) {
  return <Tag className={`sg-head ${className ?? ''}`.trim()}><Sign kind={kind} />{children}</Tag>;
}
