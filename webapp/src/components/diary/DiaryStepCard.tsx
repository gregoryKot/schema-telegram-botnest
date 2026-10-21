import type { ReactNode } from 'react';
import { hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';
import '../../styles/sheet-diary.css';

// Общая оболочка шага мастера записи (схема / режим): полоска прогресса,
// карточка с «Шаг N из M» и вопросом-заголовком. Один компонент на все
// мастера дневников (правило «одна механика — один компонент»).

export function DiaryTicks({ filled, active, hue, onJump }: {
  filled: boolean[]; active: number; hue: number | undefined; onJump: (i: number) => void;
}) {
  return (
    <div className="sd-ticks" style={hueStyle(hue)}>
      {filled.map((f, i) => (
        <div key={i} className={'sd-tick' + (f ? ' is-filled' : '') + (i === active ? ' is-active' : '')}
          {...pressable(() => onJump(i))} aria-label={`Шаг ${i + 1}`} />
      ))}
    </div>
  );
}

export function DiaryStepCard({ hue, stepIdx, total, required, filled, filledCount, children }: {
  hue: number | undefined; stepIdx: number; total: number; required: boolean;
  filled: boolean; filledCount: number; children: ReactNode;
}) {
  return (
    <div className={'ds-card sd-step' + (filled ? ' is-filled' : '')} style={hueStyle(hue)}>
      <div className="sd-step-head">
        <span className="ds-eyebrow tone-text">Шаг {stepIdx + 1} из {total}</span>
        <span className={'sd-step-flag' + (required ? ' is-required' : '')}>
          {required ? '· обязательно' : '· можно пропустить'}
        </span>
        <span className="sd-step-count">{filledCount} / {total} заполнено</span>
      </div>
      {children}
    </div>
  );
}

export function DiaryStepQ({ id, title, hint }: { id?: string; title: ReactNode; hint?: ReactNode }) {
  return (
    <>
      <h2 id={id} className="ds-h2 sd-step-q">{title}</h2>
      {hint && <div className="ds-sub sd-step-hint">{hint}</div>}
    </>
  );
}

/** Боковая подсказка листа записи: карточка в тоне записи. */
export function DiaryAside({ hue, eyebrow, title, children }: {
  hue: number | undefined; eyebrow: string; title: ReactNode; children: ReactNode;
}) {
  return (
    <div className="ds-card sd-aside tone-soft" style={hueStyle(hue)}>
      <div className="ds-eyebrow tone-text">{eyebrow}</div>
      <h3 className="ds-h3">{title}</h3>
      {children}
    </div>
  );
}
