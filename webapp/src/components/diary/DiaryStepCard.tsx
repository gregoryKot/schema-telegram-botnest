import type { ReactNode } from 'react';
import { hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';
import { glueIf } from '../../../../shared/src/utils/typo';
import '../../styles/sheet-diary.css';

// Общая оболочка шага мастера записи (схема / режим): полоска прогресса, «Шаг N из M» и
// вопрос. Один компонент на все мастера дневников. 2026-11: шаг — на бумаге страницы без
// карточки, цветная бумага — у листа-героя (APP_2026-11.md, принцип 4).

export function DiaryTicks({ filled, active, hue, onJump }: {
  filled: boolean[]; active: number; hue: number | undefined; onJump: (i: number) => void;
}) {
  return (
    <div className="sd-ticks" style={hueStyle(hue)}>
      {filled.map((f, i) => (
        <div key={i} className={'sd-tick' + (f ? ' is-filled' : '') + (i === active ? ' is-active' : '')}
          {...pressable(() => onJump(i))} aria-label={`Шаг ${i + 1}`} aria-current={i === active ? 'step' : undefined} />
      ))}
    </div>
  );
}

export function DiaryStepCard({ hue, stepIdx, total, required, filled, filledCount, children }: {
  hue: number | undefined; stepIdx: number; total: number; required: boolean;
  filled: boolean; filledCount: number; children: ReactNode;
}) {
  return (
    <section className={'sd-step' + (filled ? ' is-filled' : '')} style={hueStyle(hue)}>
      <div className="sd-step-head">
        <span className="ds-label sd-step-n">Шаг {stepIdx + 1} из {total}</span>
        <span className={'sd-step-flag' + (required ? ' is-required' : '')}>
          {required ? '· обязательно' : '· можно пропустить'}
        </span>
        <span className="sd-step-count">{filledCount} / {total} заполнено</span>
      </div>
      {children}
    </section>
  );
}

export function DiaryStepQ({ id, title, hint }: { id?: string; title: ReactNode; hint?: ReactNode }) {
  return (
    <>
      <h2 id={id} className="sd-step-q">{title}</h2>
      {hint && <div className="sd-step-hint">{glueIf(hint)}</div>}
    </>
  );
}

/** Подсказка листа записи: белый лист со сдвинутым слоем бумаги записи, без контура и тинта. */
export function DiaryAside({ hue, eyebrow, title, children }: {
  hue: number | undefined; eyebrow: string; title: ReactNode; children: ReactNode;
}) {
  return (
    <div className="sd-aside" style={hueStyle(hue)}>
      <div className="ds-label sd-aside-label">{eyebrow}</div>
      <h3 className="sd-aside-title">{title}</h3>
      {children}
    </div>
  );
}
