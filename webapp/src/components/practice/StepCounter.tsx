// Счётчик шагов пошагового листа: счёт виден формой, а не серыми чёрточками.
//  • pebbles — заземление 5-4-3-2-1: пять камешков от большого к малому на линии земли (тот же
//    мотив, что знак Grounded); пройденные — мох, текущий приподнят (глина, тень выше), впереди —
//    пустой тон бумаги;
//  • letters — «Стоп»: плашки С Т О П; пройденные залиты бумагой глубже, текущая — белый лист с
//    тенью-вырезкой, впереди — буква плоско, без рамки (не кнопка-клавиша);
//  • без вида — отрезки по числу шагов.
// Декор: смысл несёт «Шаг N из M» рядом (aria-hidden).
import type { FlowStep } from '../../../../shared/src/practices/stepFlowTypes';
import type { QuickStepCounter } from '../../../../shared/src/practices/quickPractices';
import { PAPER } from '../art/paper';
import { Lift } from '../art/sceneKit';
import { PEBBLE_GROUND, pebbleRow, stepMarks, type PebbleSpot, type StepMark } from './stepCounterModel';

const PEBBLE_FILL: Record<StepMark, string> = { done: PAPER.moss, now: PAPER.clay, next: PAPER.hollow };

function Pebble({ s, mark, i }: { s: PebbleSpot; mark: StepMark; i: number }) {
  const lift = mark === 'now' ? 7 : 0;
  const cy = s.cy - lift;
  const turn = `rotate(${i % 2 ? 6 : -8} ${s.cx} ${cy})`;
  return <ellipse cx={s.cx} cy={cy} rx={s.rx} ry={s.ry} transform={turn} fill={PEBBLE_FILL[mark]} data-mark={mark} />;
}

function Pebbles({ marks }: { marks: StepMark[] }) {
  const { spots, width } = pebbleRow(marks.length);
  const laid = (want: (m: StepMark) => boolean) =>
    spots.map((s, i) => (want(marks[i]) ? <Pebble key={i} s={s} mark={marks[i]} i={i} /> : null));
  return (
    <svg className="qs-pebbles" viewBox={`0 0 ${width} ${PEBBLE_GROUND + 6}`} aria-hidden="true" focusable="false">
      <path d={`M4 ${PEBBLE_GROUND + 1} H${width - 4}`} stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
      {laid((m) => m === 'next')}
      <Lift by={3}>{laid((m) => m === 'done')}</Lift>
      <Lift by={8}>{laid((m) => m === 'now')}</Lift>
    </svg>
  );
}

export function StepCounter({ kind, steps, step }: { kind?: QuickStepCounter; steps: FlowStep[]; step: number }) {
  const marks = stepMarks(steps.length, step);
  if (kind === 'pebbles') return <Pebbles marks={marks} />;
  return (
    <ol className={kind === 'letters' ? 'qs-letters' : 'qs-lines'} aria-hidden="true">
      {steps.map((s, i) => (
        <li key={i} className={`is-${marks[i]}`}>{kind === 'letters' ? s.mark : null}</li>
      ))}
    </ol>
  );
}
