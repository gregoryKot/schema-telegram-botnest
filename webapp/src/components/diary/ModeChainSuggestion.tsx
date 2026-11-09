import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { SignArt } from '../art/SignArt';
import { GlyphRibbonArrow } from '../exercises/ExScreen';
import { hueStyle } from '../../lib/tone';
import { modeChainVmLocal, type ModeChainSuggestionProps } from '../../modeChainVm';
import { modeLookById, uniqueModeLooks } from './modeLookById';
import '../../styles/sheet-diary.css';

/**
 * «Разобрать связанный режим» после сохранения (Критик наехал → Ребёнку больно → копинг защищает);
 * вью-модель — shared/mode/modeChain. Цепочка видна знаками: знак режима → лента-стрелка → знаки групп
 * кандидатов (Looming → ChildCare); кандидат — плашка бумаги своей группы со знаком, а не цветная
 * точка. Тап сообщает родителю modeId — тот перезапускает форму с той же ситуацией.
 */
export function ModeChainSuggestion({ modeId, onPick }: ModeChainSuggestionProps) {
  const vm = modeChainVmLocal(modeId, useTr());
  if (!vm) return null;
  const from = modeLookById(modeId);

  return (
    <div className="sd-chain" style={hueStyle(from.hue)}>
      <div className="sd-chain-path" aria-hidden="true">
        <span className="pp-paper sd-chain-sign" style={hueStyle(from.hue)}><SignArt sign={from.sign} size="row" /></span>
        <GlyphRibbonArrow className="sd-chain-arrow" />
        {uniqueModeLooks(vm.candidates.map((c) => c.id)).map((l) => (
          <span key={`${l.hue}:${l.sign}`} className="pp-paper sd-chain-sign" style={hueStyle(l.hue)}><SignArt sign={l.sign} size="row" /></span>
        ))}
      </div>
      <div className="sd-chain-q">{vm.question}</div>
      <div className="sd-chips">
        {vm.candidates.map(({ id, mode }) => {
          const look = modeLookById(id);
          return (
            <button key={id} type="button" className="pp-paper sd-chain-chip" style={hueStyle(look.hue)}
              onClick={() => { haptic.select(); onPick(id); }}>
              <span className="sd-chain-chip-sign" aria-hidden="true"><SignArt sign={look.sign} size="nav" /></span>
              {mode.name}
            </button>
          );
        })}
        <button type="button" className="sd-chain-chip sd-chain-chip--other" onClick={() => { haptic.tap(); onPick(null); }}>Другой режим</button>
      </div>
      <div className="sd-chain-hint">{vm.hint}</div>
    </div>
  );
}
