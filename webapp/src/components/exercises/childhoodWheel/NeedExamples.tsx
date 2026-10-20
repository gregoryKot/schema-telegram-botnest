import { useState } from 'react';
import { CHILDHOOD_EXAMPLES } from '../../../../../shared/src/childhoodWheel/childhoodExamples';
import { exampleTone } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import '../../../styles/sheet-childhood.css';

/**
 * «Примеры – как это выглядит в жизни» под ползунком потребности: четыре
 * точки шкалы с живыми историями, чтобы было с чем сверить свою оценку.
 */
export function NeedExamples({ needId }: { needId: NeedId }) {
  const [open, setOpen] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="cw-examples">
      <button
        type="button"
        className="ds-link cw-examples-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setOpenIdx(null);
        }}
      >
        Примеры – как это выглядит в жизни {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="cw-examples-list">
          {CHILDHOOD_EXAMPLES[needId].map((ex, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={i} className="cw-example">
                <button
                  type="button"
                  className="cw-example-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                >
                  <span className={'cw-badge is-' + exampleTone(ex.score)}>≈{ex.score}/10</span>
                  <span className="cw-example-chev">{isOpen ? '▴' : '▾'}</span>
                </button>
                {isOpen && <p className="cw-example-text">{ex.text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
