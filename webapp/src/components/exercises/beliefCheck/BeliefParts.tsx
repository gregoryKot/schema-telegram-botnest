// Части экрана «Проверка убеждения» (BeliefCheckEx) без полей ввода: камешек чаши, прогресс шагов,
// подсказка шага и сводка перед переформулировкой. Поля и кризисная детекция остаются в
// BeliefCheckEx.tsx и EviList.tsx (правило №7: файл с полем — файл с детекцией).
import { PAPER } from '../../art/paper';
import { DiaryTicks } from '../../diary/DiaryStepCard';
import { NeedFold } from '../../NeedFold';
import { isPhoneLayout } from '../../../utils/phoneLayout';
import { glue, glueSpaces } from '../../../../../shared/src/utils/typo';

export type EviSide = 'for' | 'against';

/** Камешек чаши: «за» — мох левой чаши весов, «против» — глина правой (тот же мотив, что Scales). */
export function Pebble({ side }: { side: EviSide }) {
  return (
    <svg className="ex2-pebble" viewBox="0 0 16 11" aria-hidden="true" focusable="false">
      <ellipse cx="8" cy="5.5" rx="7.5" ry="5" fill={side === 'for' ? PAPER.moss : PAPER.clay} />
    </svg>
  );
}

/** Прогресс шагов полосками, как у мастера дневника, и одна строка «Шаг N из 4 · название»: четыре
 *  плашки шагов на телефоне шли лесенкой в три ряда. Вперёд — только к уже пройденным шагам. */
export function BeliefProgress({ steps, step, completed, hue, onJump }: {
  steps: string[]; step: number; completed: number[]; hue: number; onJump: (n: number) => void;
}) {
  return (
    <div className="ex2-belief-progress">
      <DiaryTicks filled={steps.map((_, i) => completed.includes(i))} active={step} hue={hue}
        onJump={(i) => (completed.includes(i) || i === step) && onJump(i)} />
      <span className="ds-label ex2-belief-step">Шаг {step + 1} из {steps.length} · {steps[step]}</span>
    </div>
  );
}

/** Подсказка шага: на компьютере раскрыта в колонке разворота под листом, на телефоне — свёрнутой
 *  строкой между листом и полем (принцип 5; механика раскрытия — общая NeedFold, вид — sd-why).
 *  Подписи-капители нет: «Шаг N из 4» уже стоит у полосок, заголовок подсказки — Literata. */
export function BeliefHint({ hint }: { hint: { title: string; body: string; list: string[] } }) {
  return (
    <NeedFold className="sd-why ex2-belief-hint" title="" defaultOpen={!isPhoneLayout()}
      sub={<span className="sd-why-title">{glue(hint.title)}</span>}>
      <p className="sd-why-body">{glue(hint.body)}</p>
      <ul className="ex2-belief-hint-list">{hint.list.map((x) => <li key={x}>{glue(x)}</li>)}</ul>
    </NeedFold>
  );
}

/** Сводка перед переформулировкой: обе чаши столбцами — «за» слева, «против» справа (на телефоне —
 *  друг под другом), каждый довод с камешком своей чаши. Тексты — слова человека (glueSpaces). */
export function BeliefRecap({ forList, againstList }: { forList: string[]; againstList: string[] }) {
  const cols: [string, EviSide, string[]][] = [['За', 'for', forList], ['Против', 'against', againstList]];
  return (
    <div className="ex2-recap">
      {cols.map(([label, side, items]) => (
        <div key={side} className="ex2-recap-col">
          <div className="ds-label ex2-recap-head"><Pebble side={side} />{label} · {items.length}</div>
          {items.map((t, i) => <div key={i} className="ex2-recap-row"><Pebble side={side} /><span>{glueSpaces(t)}</span></div>)}
        </div>
      ))}
    </div>
  );
}
