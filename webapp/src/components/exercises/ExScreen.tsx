import type { ReactNode } from 'react';
import { pressable } from '../../utils/a11y';
import '../../styles/sheet-exercises.css';

// ── Shared SVG icons ─────────────────────────────────────────────────────────
export function GlyphArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8H3M7 4L3 8l4 4" />
    </svg>
  );
}
export function GlyphArrowRight() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
export function GlyphCheck() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5L13 4.5" />
    </svg>
  );
}
export function GlyphPlus() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
export function GlyphX() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

// ── Shared exercise wrapper ───────────────────────────────────────────────────
interface ExScreenProps {
  onBack: () => void;
  backLabel?: string;
  eyebrow: ReactNode;
  /** Больше не используется: подпись над заголовком всегда акцентная (ds-eyebrow). */
  eyebrowColor?: string;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
  foot?: ReactNode;
  children?: ReactNode;
}

export function ExScreen({ onBack, backLabel, eyebrow, title, lede, aside, foot, children }: ExScreenProps) {
  return (
    <div className="ex2-screen">
      <div className="ex2-top">
        <button className="ds-link ex2-back" onClick={onBack}>
          <GlyphArrowLeft />
          {backLabel ?? 'Назад к упражнениям'}
        </button>
      </div>
      <div className={'ex2-body' + (aside ? '' : ' ex2-body--single')}>
        <div className="ex2-main">
          <div className="ds-eyebrow">{eyebrow}</div>
          <h1 className="ds-h2 ex2-title">{title}</h1>
          {lede && <p className="ds-sub ex2-lede">{lede}</p>}
          {children}
          {foot}
        </div>
        {aside && <aside className="ex2-aside">{aside}</aside>}
      </div>
    </div>
  );
}

// ── Steps bar ────────────────────────────────────────────────────────────────
interface StepsBarProps {
  steps: string[];
  current: number;
  completed: number[];
  onJump?: (i: number) => void;
}

export function StepsBar({ steps, current, completed, onJump }: StepsBarProps) {
  return (
    <div className="ex2-steps">
      {steps.map((s, i) => {
        const done = completed.includes(i);
        const active = current === i;
        return (
          <div
            key={i}
            className={'ex2-step' + (active ? ' is-active' : done ? ' is-done' : '')}
            {...pressable(() => (done || active) && onJump?.(i))}
          >
            <span className="ex2-step-n">{String(i + 1).padStart(2, '0')}</span>
            <span>{s}</span>
          </div>
        );
      })}
    </div>
  );
}
