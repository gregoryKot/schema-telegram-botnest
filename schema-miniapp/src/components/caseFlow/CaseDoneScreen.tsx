import { PrimaryAction } from '../diary/diaryFlowUi';
import { TertiaryLink } from './caseFlowUi';
import { buildDiaryPayoff } from '../../../../shared/src/case/caseRecognition';
import { modeDisplayName } from '../../../../shared/src/mode/modeDisplayName';
import type { CaseTraits, Tr } from '../../../../shared/src/case/caseTypes';

/** Нет реальных данных → «—», а не выдуманная строка (правило CLAUDE.md про
 *  хардкод-заглушки — тело/порыв могли остаться пустыми, если шаги
 *  пропустили без выбора чипа). */
function TraitRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--faint)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>
        {value || '—'}
      </div>
    </div>
  );
}

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
    <div>
      <div className="d-display" style={{ fontSize: 21, marginBottom: 4 }}>
        {modeDisplayName(modeId, alias)}
      </div>

      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-14)',
          padding: 14,
          margin: '14px 0',
        }}
      >
        <TraitRow label="Ранний сигнал" value={traits.body} />
        <TraitRow label="Приходит, когда" value={traits.trigger} />
        <TraitRow label="Тянет" value={traits.impulse} />
      </div>

      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        {buildDiaryPayoff(tr)}
      </div>

      <PrimaryAction label="Открыть карту" onClick={onOpenMap} />
      <TertiaryLink label="Готово" onClick={onClose} />
    </div>
  );
}
