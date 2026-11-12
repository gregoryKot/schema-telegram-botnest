import type { ReactNode } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import '../../styles/therapist-sign.css';

// Знаки кабинета терапевта (docs/design/PAPER_2026-11.md, «Язык знаков»): круги-реплики — люди и
// разговор, камешки — заметки, галочка — задание, слои — схемы и концептуализация, круги — режимы,
// полоски — индекс и трекер, сердце — «требуют внимания». Рисунок — из общего реестра SignArt
// (одна карта «ключ → мотив» на кабинет клиента и терапевта); здесь — только набор ключей и место.
export type SignKind = Extract<SignKey, 'talk' | 'pebbles' | 'check' | 'layers' | 'cluster' | 'strokes' | 'heart'>;

export function Sign({ kind, className = '' }: { kind: SignKind; className?: string }) {
  return <span className={`pp-row-art ${className}`.trim()}><SignArt sign={kind} size="row" /></span>;
}

type HeadTag = 'h2' | 'h3' | 'div';

/** Подпись блока со знаком слева: тот же тег и класс, что были у подписи без знака. */
export function SignHead({ kind, as: Tag = 'h2', className, children }: { kind: SignKind; as?: HeadTag; className?: string; children: ReactNode }) {
  return <Tag className={`ts-head ${className ?? ''}`.trim()}><Sign kind={kind} />{children}</Tag>;
}
