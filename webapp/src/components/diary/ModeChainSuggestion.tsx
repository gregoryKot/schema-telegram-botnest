import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import {
  modeChainVmLocal,
  type ModeChainSuggestionProps,
} from '../../modeChainVm';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';

/**
 * Подсказка «разобрать связанный режим» после сохранения записи — в одной
 * ситуации часто работает несколько режимов (Критик наехал → Ребёнку больно
 * → копинг вышел защищать). Вью-модель — shared/mode/modeChain, зависит от
 * семьи сохранённого режима. Тап по кандидату сообщает родителю modeId —
 * тот перезапускает форму с той же ситуацией (ModeEntrySheet).
 * Классы — существующие chip-row/chip-pill (правило webapp: классы, не инлайн).
 */
export function ModeChainSuggestion({ modeId, onPick }: ModeChainSuggestionProps) {
  const vm = modeChainVmLocal(modeId, useTr());

  return (
    vm && <div
      style={{
        marginTop: 20,
        padding: '14px 16px 12px',
        border: '1px solid var(--line)',
        borderRadius: 14,
        background: 'var(--surface-2)',
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: 'var(--text)',
          lineHeight: 1.45,
          marginBottom: 10,
        }}
      >
        {vm.question}
      </div>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {vm.candidates.map(({ id, mode }) => (
          <button
            key={id}
            type="button"
            className="chip-pill"
            onClick={() => {
              haptic.select();
              onPick(id);
            }}
          >
            <IdentityDot color={mode.groupColor} /> {mode.name}
          </button>
        ))}
        <button
          type="button"
          className="chip-pill"
          onClick={() => {
            haptic.tap();
            onPick(null);
          }}
        >
          Другой режим
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
        {vm.hint}
      </div>
    </div>
  );
}
