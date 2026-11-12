// Выбор типа цели / задания (TaskCreateSheet, b20) — плитки цветной бумаги со знаком сущности, как библиотека
// упражнений на «Практиках» (принцип 3: выбор из равных — плитки, не белые строки). Бумага и знак — из ENTITY_LOOK
// (taskOptions), тот же знак, что у строки задания. Выбранная — тон глубже, приподнята сдвинутым слоем и с печатью-
// галочкой в углу (не обводкой: красная рамка читалась ошибкой). Один компонент у клиента и у терапевта.
import { haptic } from '../../haptic';
import { hueStyle } from '../../lib/tone';
import { SignArt } from '../art/SignArt';
import { GlyphCheck } from '../exercises/ExGlyphs';
import type { TaskOption, TaskType } from './taskOptions';

export function TaskTypeTiles({ options, value, onPick }: { options: TaskOption[]; value: TaskType; onPick: (t: TaskType) => void }) {
  return (
    <div className="sk-grid">
      {options.map(opt => {
        const on = value === opt.type;
        return (
          <button
            key={opt.type} type="button" aria-pressed={on}
            className={'pp-paper sk-tpl' + (on ? ' is-selected' : '')} style={hueStyle(opt.hue)}
            onClick={() => { haptic.select(); onPick(opt.type); }}
          >
            <span className="sk-tpl-top">
              <span className="sk-tpl-sign" aria-hidden="true"><SignArt sign={opt.sign} size="row" /></span>
              {on && <span className="sk-tpl-stamp" aria-hidden="true"><GlyphCheck /></span>}
            </span>
            <span className="sk-tpl-label">{opt.label}</span>
            <span className="sk-tpl-sub">{opt.sub}</span>
            {opt.time !== '–' && <span className="sk-tpl-time">{opt.time}</span>}
          </button>
        );
      })}
    </div>
  );
}
