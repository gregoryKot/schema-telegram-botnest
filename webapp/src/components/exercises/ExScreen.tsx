import type { CSSProperties, ReactNode } from 'react';
import { Leaf } from '../art/PaperArtSigns';
import { pressable } from '../../utils/a11y';
import { TherapyCaution } from '../therapy/TherapyCaution';
import { useExBackLabel } from './exBackLabel';
import { Skeleton, SkeletonCard } from '../Skeleton';
import { ExBar } from './ExBar';
import '../../styles/sheet-exercises.css';

// ── Shared SVG icons ─────────────────────────────────────────────────────────
export { GlyphArrowLeft } from './ExBar';
export function GlyphArrowRight() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
export function GlyphCheck() {
  return <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4.5" /></svg>;
}
export function GlyphPlus() {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>;
}
export function GlyphX() {
  return <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

// ── Shared exercise wrapper ───────────────────────────────────────────────────
// Шапка — общая ds-sheet-head/ds-back (#906): .ex2-top держит sticky и --safe-top
// (safeTop.test.ts). Стрелка — SVG, подпись без «←»: имя кнопки («Назад», «Закрыть»,
// «Назад к упражнениям») ищут по тексту тесты десятков потребителей ExScreen.
// Без backLabel подпись задаёт хост упражнений (exBackLabel.ts).
interface ExScreenProps {
  onBack: () => void;
  backLabel?: string;
  eyebrow: ReactNode;
  art?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  caution?: boolean; // предупреждение «самопомощь» под lede, только на первом экране
  aside?: ReactNode;
  foot?: ReactNode;
  children?: ReactNode;
}

export function ExScreen({ onBack, backLabel, eyebrow, art, title, lede, caution, aside, foot, children }: ExScreenProps) {
  const hostBackLabel = useExBackLabel();
  return (
    <div className="ex2-screen">
      <ExBar onBack={onBack} label={backLabel ?? hostBackLabel} sticky />
      <div className={'ex2-body' + (aside ? '' : ' ex2-body--single')}>
        <div className="ex2-main">
          {art}<div className="ds-eyebrow">{eyebrow}</div>
          <h1 className="ds-h2 ex2-title">{title}</h1>
          {lede && <p className="ds-sub ex2-lede">{lede}</p>}
          {caution && <TherapyCaution place="exercise_start" />}
          {children}
          {foot}
        </div>
        {aside && <aside className="ex2-aside">{aside}</aside>}
      </div>
    </div>
  );
}

// ── Силуэт экрана упражнения, пока грузится его чанк (Suspense в TaskExerciseHost) ──
// Та же рамка: шапка с «Назад», надзаголовок, заголовок, абзац, карточка. Записи
// истории ещё нет (её делает упражнение после загрузки), поэтому «Назад» — onBack хоста.
export function ExScreenSkeleton({ onBack }: { onBack: () => void }) {
  const hostBackLabel = useExBackLabel();
  return (
    <div className="ex2-screen">
      <ExBar onBack={onBack} label={hostBackLabel} sticky />
      <div className="ex2-body ex2-body--single" aria-hidden>
        <div className="ex2-main ex2-skel">
          <Skeleton width={120} height={12} />
          <Skeleton width="62%" height={30} />
          <Skeleton width="92%" height={14} />
          <Skeleton width="74%" height={14} />
          <SkeletonCard height={220} />
        </div>
      </div>
    </div>
  );
}

// ── Экран «готово»: цветная бумага (шалфей) с листком над содержимым ─────────
export function ExDone({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`pp-paper ex2-done ${className}`.trim()} style={{ '--h': 135 } as CSSProperties}>
      <Leaf size="square" />
      {children}
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
