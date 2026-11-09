import type { CSSProperties, ReactNode } from 'react';
import { Leaf } from '../art/PaperArtSigns';
import { pressable } from '../../utils/a11y';
// Порядок импортов держит общий чанк TherapyCaution: его CSS идёт до index.css (docs/open/frontend-ux.md).
import { TherapyCaution } from '../therapy/TherapyCaution';
import { useExBackLabel } from './exBackLabel';
import { Skeleton, SkeletonCard } from '../Skeleton';
import { SpreadLayout } from '../paper/SpreadLayout';
import { ExHead, type ExHeadProps } from './ExHead';
import { GlyphArrowLeft } from './ExGlyphs';
import '../../styles/sheet-exercises.css';

export { GlyphArrowLeft, GlyphArrowRight, GlyphCheck, GlyphPlus, GlyphX } from './ExGlyphs';

// ── Shared exercise wrapper ───────────────────────────────────────────────────
// Шапка — общая ds-sheet-head/ds-back (#906): .ex2-top держит sticky и --safe-top
// (safeTop.test.ts). Стрелка — SVG, подпись без «←»: имя кнопки («Назад», «Закрыть»,
// «Назад к упражнениям») ищут по тексту тесты десятков потребителей ExScreen.
// Без backLabel подпись задаёт хост упражнений (exBackLabel.ts).
// Герой (look, ExHead) и раскладки редизайна 2026-11 — по желанию экрана, без них DOM прежний:
//  • hintBeforeField — на ≤900 подсказка (aside) между шапкой и полем, а не после «Сохранить»;
//  • spread — разворот (SpreadLayout): на ≥1024 шапка и подсказка слева колонкой, форма справа;
//  • «самопомощь» у героя — наклейкой под кнопками (после foot) во всех раскладках: на 390 до
//    первого поля остаются только шапка и лист (APP_2026-11.md, принцип 5); cautionAt="head"
//    ставит её под лист, если экрану так нужно. Без look — полное предупреждение под шапкой.
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
      <div className="ds-sheet-head ex2-top">
        <button type="button" className="ds-back" onClick={onBack}><GlyphArrowLeft />{backLabel ?? hostBackLabel}</button>
      </div>
      <ExBody {...body} />
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
      <div className="ds-sheet-head ex2-top">
        <button type="button" className="ds-back" onClick={onBack}><GlyphArrowLeft />{hostBackLabel}</button>
      </div>
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
