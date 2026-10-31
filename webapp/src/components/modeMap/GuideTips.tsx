import { useMemo, useState } from 'react';
import type { ModeMapKind } from '../../api';
import { pickTips, useModeMapTips } from '../modeMapTips';

// Случайные советы из базы знаний в панели подсказок карты режимов (ModeMapGuide):
// новый набор при каждом открытии панели и по «↻».
export function GuideTips({ kind }: { kind: ModeMapKind }) {
  const [reroll, setReroll] = useState(0);
  const tips = useModeMapTips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const random = useMemo(() => pickTips(tips, kind, 3, []), [tips, kind, reroll]);
  return (
    <div className="mm2-tips">
      <div className="mm2-tips-head">
        <span className="ds-label">Советы</span>
        <button onClick={() => setReroll(r => r + 1)} title="Другие советы" aria-label="Другие советы">↻</button>
      </div>
      <div>
        {random.map((t, i) => (
          <div key={i} className="mm2-tip-row"><i /><span>{t}</span></div>
        ))}
      </div>
    </div>
  );
}
