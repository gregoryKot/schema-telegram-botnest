import { ExScreen } from '../exercises/ExScreen';
import { buildDiaryPayoff } from '../../../../shared/src/case/caseRecognition';
import { modeDisplayName } from '../../../../shared/src/mode/modeDisplayName';
import type { CaseTraits, Tr } from '../../../../shared/src/case/caseTypes';

/** Нет реальных данных → «—», а не выдуманная строка (правило CLAUDE.md про
 *  хардкод-заглушки — тело/порыв могли остаться пустыми). */
function TraitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ex2-trait">
      <div className="ds-label">{label}</div>
      <div className="ex2-trait-text">{value || '—'}</div>
    </div>
  );
}

/** Итог потока. Twin schema-miniapp CaseDoneScreen.tsx. */
export function CaseDoneScreen({
  modeId,
  alias,
  traits,
  onOpenMap,
  onClose,
  tr,
}: {
  modeId: string;
  alias: string;
  traits: CaseTraits;
  onOpenMap: () => void;
  onClose: () => void;
  tr: Tr;
}) {
  return (
    <ExScreen
      onBack={onClose}
      backLabel="Закрыть"
      eyebrow="Разбор случая"
      title={modeDisplayName(modeId, alias)}
    >
      <div className="ds-card ds-card--ink ex2-chain">
        <TraitRow label="Ранний сигнал" value={traits.body} />
        <TraitRow label="Приходит, когда" value={traits.trigger} />
        <TraitRow label="Тянет" value={traits.impulse} />
      </div>

      <p className="ds-sub ex2-gap-b">{buildDiaryPayoff(tr)}</p>

      <div className="ex2-foot">
        <button type="button" className="ds-btn" onClick={onOpenMap}>
          Открыть карту
        </button>
        <button type="button" className="ds-btn ex2-ghost" onClick={onClose}>
          Готово
        </button>
      </div>
    </ExScreen>
  );
}
