import { ExScreen } from '../exercises/ExScreen';
import { buildDiaryPayoff } from '../../../../shared/src/case/caseRecognition';
import { modeDisplayName } from '../../../../shared/src/mode/modeDisplayName';
import type { CaseTraits, Tr } from '../../../../shared/src/case/caseTypes';

/** Нет реальных данных → «—», а не выдуманная строка (правило CLAUDE.md про
 *  хардкод-заглушки — тело/порыв могли остаться пустыми). */
function TraitRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>{value || '—'}</div>
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
      eyebrowColor="var(--accent-indigo)"
      title={modeDisplayName(modeId, alias)}
    >
      <div className="aside-card" style={{ margin: '0 0 20px' }}>
        <TraitRow label="Ранний сигнал" value={traits.body} />
        <TraitRow label="Приходит, когда" value={traits.trigger} />
        <TraitRow label="Тянет" value={traits.impulse} />
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 24 }}>
        {buildDiaryPayoff(tr)}
      </p>

      <button type="button" className="ex-btn ex-btn-primary" onClick={onOpenMap}>
        Открыть карту
      </button>
      <button
        type="button"
        className="ex-btn ex-btn-ghost"
        style={{ marginTop: 8 }}
        onClick={onClose}
      >
        Готово
      </button>
    </ExScreen>
  );
}
