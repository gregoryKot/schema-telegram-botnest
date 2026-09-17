import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import {
  modeChainVmLocal,
  type ModeChainSuggestionProps,
} from '../../modeChainVm';

/**
 * Подсказка «разобрать связанный режим» после сохранения записи дневника —
 * в одной ситуации часто работает несколько режимов (Критик наехал → Ребёнку
 * больно → копинг вышел защищать). Вью-модель — shared/mode/modeChain,
 * зависит от семьи сохранённого режима. Тап по кандидату сообщает родителю
 * modeId — тот перезапускает визард с той же ситуацией (ModeEntrySheet).
 */
export function ModeChainSuggestion({
  modeId,
  onPick,
}: ModeChainSuggestionProps) {
  const vm = modeChainVmLocal(modeId, useTr());

  return (
    vm && (
      <div
        style={{
          marginTop: 16,
          background: 'rgba(var(--fg-rgb),0.04)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 'var(--r-16)',
          padding: '14px 14px 12px',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.4,
            marginBottom: 10,
          }}
        >
          {vm.question}
        </div>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}
        >
          {vm.candidates.map(({ id, mode }) => (
            <button
              key={id}
              onClick={() => {
                haptic.select();
                onPick(id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(var(--fg-rgb),0.07)',
                border: '1px solid transparent',
                borderRadius: 'var(--r-16)',
                padding: '7px 12px',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {mode.name}
            </button>
          ))}
          <button
            onClick={() => {
              haptic.tap();
              onPick(null);
            }}
            style={{
              background: 'none',
              border: '1px solid rgba(var(--fg-rgb),0.14)',
              borderRadius: 'var(--r-16)',
              padding: '7px 12px',
              color: 'var(--text-sub)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Другой режим
          </button>
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
          }}
        >
          {vm.hint}
        </div>
      </div>
    )
  );
}
