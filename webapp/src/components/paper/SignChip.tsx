// Чип-переключатель со знаком (docs/design/APP_2026-11.md, принцип 5): один чип на теги, чувства,
// импульсы, темы дня, выбор схем и режимов. Слева — знак сущности строчного размера (nav);
// выбранный чип — бумага сущности (--h) с галочкой Check на месте знака, а не цветная обводка.
// Место знака есть всегда: у невыбранного чипа без своего знака там пустой слот той же ширины
// (бледная галочка читалась «выбрано, но неактивно»), — ширина не прыгает при выборе и ряд чипов
// не перестраивается под пальцем. Вид — общий .ds-chip--toggle (cabinet.css): там же запасной
// оттенок бумаги без --h и зона нажатия 44 на телефоне; состояние читается и без цвета
// (aria-pressed, галочка, кромка).
import type { CSSProperties, ReactNode } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import '../../styles/paper-app.css';

export interface SignChipProps {
  label: ReactNode;
  on: boolean;
  onToggle: () => void;
  /** Знак сущности чипа; без него — пустой слот, галочка только у выбранного. */
  sign?: SignKey;
  /** Бумага выбранного чипа; без неё — --h родителя (лист сущности), нет и его — солома. */
  hue?: number;
  disabled?: boolean;
}

export function SignChip({ label, on, onToggle, sign, hue, disabled }: SignChipProps) {
  const mark: SignKey | undefined = on ? 'check' : sign;
  return (
    <button type="button" className={`ds-chip ds-chip--toggle pa-chip${on ? ' is-on' : ''}`} aria-pressed={on}
      disabled={disabled} onClick={onToggle} style={hue === undefined ? undefined : ({ '--h': hue } as CSSProperties)}>
      <span className="pa-chip-sign" aria-hidden="true" data-sign={mark}>
        {mark && <SignArt sign={mark} size="nav" />}
      </span>
      <span className="pa-chip-label">{label}</span>
    </button>
  );
}
