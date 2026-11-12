// Прогресс разбора фразы (b18) — девять бусин-примет на одной нити, вместо полосы 2px: отвеченная —
// слива (критик) или мох (забота), текущая — тёмным кольцом, впереди — пустые гнёзда. Итог виден формой ещё
// до вердикта. Имя и значения прогресса — у обёртки (role="progressbar"), рисунок скрыт от чтения.
import { PAPER } from '../../art/paper';
import { beadStates, type BeadState } from './phraseLook';
import type { PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';

/** Отвеченная — залитая бусина голоса; текущая и впереди — пустые гнёзда (текущая — тёмным кольцом). */
const BEAD: Record<BeadState, { fill: string; stroke: string; width: number }> = {
  critic: { fill: PAPER.plum, stroke: 'none', width: 0 },
  care: { fill: PAPER.moss, stroke: 'none', width: 0 },
  now: { fill: 'var(--surface)', stroke: 'var(--text)', width: 2.5 },
  todo: { fill: 'color-mix(in srgb, var(--surface) 70%, transparent)', stroke: PAPER.hollow, width: 1.5 },
};

export function PhraseBeads({ marks, markIndex, step, total }: {
  marks: readonly PhraseMarkId[];
  markIndex: number;
  step: number;
  total: number;
}) {
  return (
    <div className="ex2-beads" role="progressbar" aria-label="Шаг упражнения" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
      <svg viewBox="0 0 196 24" aria-hidden="true" focusable="false">
        <path d="M6 12 H190" stroke={PAPER.hollow} strokeWidth="2" strokeLinecap="round" />
        {beadStates(marks, markIndex).map((s, i) => (
          <circle key={i} data-bead={s} cx={14 + i * 21} cy="12" r={s === 'critic' || s === 'care' ? 7 : 6.5}
            fill={BEAD[s].fill} stroke={BEAD[s].stroke} strokeWidth={BEAD[s].width} />
        ))}
      </svg>
    </div>
  );
}
