// Чип-переключатель со знаком (docs/design/APP_2026-11.md, принцип 5): один чип на теги, чувства,
// импульсы, темы дня, выбор схем и режимов. Слева — знак сущности строчного размера (nav);
// выбранный чип — бумага сущности (--h) с галочкой Check на месте знака, а не цветная обводка.
// Место знака есть всегда: у чипа без своего знака там бледная галочка, — ширина не прыгает при
// выборе и ряд чипов не перестраивается под пальцем. Вид — общий .ds-chip--toggle (cabinet.css),
// зона нажатия 44 на телефоне — там же; состояние читается и без цвета (aria-pressed, галочка).
import type { CSSProperties, ReactNode } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import '../../styles/paper-app.css';

export interface SignChipProps {
  label: ReactNode;
  on: boolean;
  onToggle: () => void;
  /** Знак сущности чипа; без него — бледная галочка. */
  sign?: SignKey;
  /** Бумага выбранного чипа; без неё — --h родителя (лист сущности). */
  hue?: number;
  disabled?: boolean;
}

export function SignChip({ label, on, onToggle, sign, hue, disabled }: SignChipProps) {
  const mark: SignKey = on || !sign ? 'check' : sign;
  const idle = !on && !sign;
  return (
    <button type="button" className={`ds-chip ds-chip--toggle pa-chip${on ? ' is-on' : ''}`} aria-pressed={on}
      disabled={disabled} onClick={onToggle} style={hue === undefined ? undefined : ({ '--h': hue } as CSSProperties)}>
      <span className={idle ? 'pa-chip-sign pa-chip-sign--idle' : 'pa-chip-sign'} aria-hidden="true" data-sign={mark}>
        <SignArt sign={mark} size="nav" />
      </span>
      <span className="pa-chip-label">{label}</span>
    </button>
  );
}
