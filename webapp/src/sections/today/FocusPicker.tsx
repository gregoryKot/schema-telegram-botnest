import { FOCUS_OPTIONS, type FocusPractice } from '../../../../shared/src/today/todayFocus';

interface Props {
  practice: FocusPractice;
  onPick: (p: FocusPractice) => void;
}

// Выбор главной практики дня: четыре варианта списком, текущий отмечен.
export function FocusPicker({ practice, onPick }: Props) {
  return (
    <div className="ct-focus-picker" role="radiogroup" aria-label="Главная практика дня">
      {FOCUS_OPTIONS.map(o => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === practice}
          className={'ct-focus-opt' + (o.id === practice ? ' is-on' : '')}
          onClick={() => onPick(o.id)}
        >
          <span className="ct-focus-opt-name">{o.label}</span>
          <span className="ct-focus-opt-sub">{o.sub}</span>
        </button>
      ))}
    </div>
  );
}
