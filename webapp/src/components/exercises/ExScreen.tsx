import type { CSSProperties, ReactNode } from 'react';
import { pressable } from '../../utils/a11y';
// Порядок импортов держит общий чанк TherapyCaution: его CSS идёт до index.css (docs/open/frontend-ux.md).
import { TherapyCaution } from '../therapy/TherapyCaution';
import { useExBackLabel } from './exBackLabel';
import { Skeleton, SkeletonCard } from '../Skeleton';
import { SpreadLayout } from '../paper/SpreadLayout';
import { ExHead, type ExHeadProps } from './ExHead';
import { ExBar } from './ExBar';
import '../../styles/sheet-exercises.css';

export { GlyphArrowLeft, GlyphArrowRight, GlyphCheck, GlyphChevron, GlyphPlus, GlyphRibbonArrow, GlyphX } from './ExGlyphs'; // дом глифов — ExGlyphs

// ── Обёртка упражнения. Шапка — ExBar (ds-sheet-head/ds-back, #906; sticky .ex2-top — safeTop.test.ts).
// Подпись без «←»: имя кнопки ищут тесты потребителей; без backLabel её задаёт хост (exBackLabel.ts).
// Герой (look, ExHead) и раскладки редизайна 2026-11 — по желанию экрана, без них DOM прежний:
//  • hintBeforeField — на ≤900 подсказка (aside) между шапкой и полем, а не после «Сохранить»;
//  • spread — разворот (SpreadLayout): на ≥1024 шапка и подсказка слева колонкой, форма справа;
//  • «самопомощь» у героя — наклейкой под кнопками (принцип 5), cautionAt="head" — под лист; без look — под шапкой.
interface ExScreenProps extends ExHeadProps {
  /** Предупреждение «самопомощь» — только на первом экране. */
  caution?: boolean;
  /** Где стоит «самопомощь»: под шапкой или под кнопками; по умолчанию у героя — под кнопками. */
  cautionAt?: 'head' | 'foot';
  onBack: () => void;
  backLabel?: string;
  aside?: ReactNode;
  foot?: ReactNode;
  children?: ReactNode;
  hintBeforeField?: boolean;
  spread?: boolean;
}

function ExBody({ aside, foot, children, hintBeforeField, spread, caution, cautionAt, ...rest }: Omit<ExScreenProps, 'onBack' | 'backLabel'>) {
  const hero = rest.look !== undefined;
  const warn = caution && <TherapyCaution place="exercise_start" compact={hero} />;
  const atFoot = (cautionAt ?? (hero ? 'foot' : 'head')) === 'foot';
  const head = <ExHead {...rest} caution={atFoot ? undefined : warn} />;
  const main = <>{children}{foot}{atFoot && warn}</>;
  const side = aside && <aside className="ex2-aside">{aside}</aside>;
  if (spread) {
    return (
      <div className="ex2-body ex2-body--spread">
        <SpreadLayout side={<>{head}{side}</>}>{main}</SpreadLayout>
      </div>
    );
  }
  if (hintBeforeField && side) {
    return (
      <div className="ex2-body ex2-body--split">
        <div className="ex2-head">{head}</div>
        {side}
        <div className="ex2-main">{main}</div>
      </div>
    );
  }
  return (
    <div className={'ex2-body' + (aside ? '' : ' ex2-body--single')}>
      <div className="ex2-main">{head}{main}</div>
      {side}
    </div>
  );
}

export function ExScreen({ onBack, backLabel, ...body }: ExScreenProps) {
  const hostBackLabel = useExBackLabel();
  // ex2-screen--hero: на телефоне вопрос (.ex2-prompt-label) ступенью ниже заголовка листа
  return (
    <div className={body.look === undefined ? 'ex2-screen' : 'ex2-screen ex2-screen--hero'}>
      <ExBar onBack={onBack} label={backLabel ?? hostBackLabel} sticky />
      <ExBody {...body} />
    </div>
  );
}

// ── Силуэт упражнения, пока грузится чанк (TaskExerciseHost): лист-герой сразу на бумаге упражнения (hue —
// exerciseHue хоста), место знака справа, поле, на ≥901 — колонка подсказки; «Назад» — onBack хоста.
export function ExScreenSkeleton({ onBack, hue }: { onBack: () => void; hue?: number }) {
  const hostBackLabel = useExBackLabel();
  return (
    <div className="ex2-screen">
      <ExBar onBack={onBack} label={hostBackLabel} sticky />
      <div className="ex2-body" aria-hidden>
        <div className="ex2-main ex2-skel">
          <div className="pp-paper pa-sheet ex2-skel-hero" style={{ '--h': hue ?? 70 } as CSSProperties}>
            <div className="pa-sheet-body"><Skeleton width={120} height={12} /><Skeleton width="62%" height={30} /><Skeleton width="86%" height={14} /></div>
            <div className="pa-sheet-art"><Skeleton height={88} radius={16} /></div>
          </div>
          <SkeletonCard height={220} />
        </div>
        <aside className="ex2-aside ex2-skel-aside"><SkeletonCard height={180} /></aside>
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
