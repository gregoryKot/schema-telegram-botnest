import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import {
  modeChainVmLocal,
  type ModeChainSuggestionProps,
} from '../../modeChainVm';
import '../../styles/sheet-diary.css';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';

/**
 * Подсказка «разобрать связанный режим» после сохранения записи — в одной
 * ситуации часто работает несколько режимов (Критик наехал → Ребёнку больно
 * → копинг вышел защищать). Вью-модель — shared/mode/modeChain, зависит от
 * семьи сохранённого режима. Тап по кандидату сообщает родителю modeId —
 * тот перезапускает форму с той же ситуацией (ModeEntrySheet).
 * Кандидаты — ds-chip.
 */
export function ModeChainSuggestion({ modeId, onPick }: ModeChainSuggestionProps) {
  const vm = modeChainVmLocal(modeId, useTr());

  return (
    vm && <div className="ds-card ds-card--row sd-chain">
      <div className="sd-chain-q">{vm.question}</div>
      <div className="sd-chips">
        {vm.candidates.map(({ id, mode }) => (
          <button
            key={id}
            type="button"
            className="ds-chip sd-chip"
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
          className="ds-chip sd-chip"
          onClick={() => {
            haptic.tap();
            onPick(null);
          }}
        >
          Другой режим
        </button>
      </div>
      <div className="ds-sub">{vm.hint}</div>
    </div>
  );
}
