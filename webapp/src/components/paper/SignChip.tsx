// Чип-переключатель со знаком (docs/design/APP_2026-11.md, принцип 5): один чип на теги, чувства,
// импульсы, темы дня, выбор схем и режимов. Слева — знак сущности строчного размера (nav);
// выбранный чип — бумага сущности (--h) с галочкой Check на месте знака, а не цветная обводка.
// Слот знака — только у чипа со знаком или у выбранного (галочка): пустой слот у невыбранного чипа
// без знака давал кривые поля (36px слева, 10 справа) — такой чип при выборе растёт на ширину
// галочки (бледная галочка у невыбранного читалась «выбрано, но неактивно»). Вид — общий
// .ds-chip--toggle (cabinet.css): там же запасной оттенок бумаги без --h и зона нажатия 44 на
// телефоне; состояние читается и без цвета (aria-pressed, галочка, кромка, жирность). radio — тот
// же чип в радиогруппе (теги быстрой записи: один тег на запись) — role="radio" и aria-checked; art —
// свой рисунок вместо знака по ключу (Pebbles filled у благодарности).
import type { CSSProperties, ReactNode } from 'react';
import type { PaperHue, SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';

export interface SignChipProps {
  label: ReactNode;
  on: boolean;
  onToggle: () => void;
  /** Знак сущности чипа; без него слота нет, у выбранного — галочка. */
  sign?: SignKey;
  /** Свой рисунок невыбранного чипа вместо знака по ключу (вариант мотива с данными). */
  art?: ReactNode;
  /** Чип в радиогруппе (role="radio", aria-checked); по умолчанию — переключатель (aria-pressed). */
  radio?: boolean;
  /** Бумага выбранного чипа (оттенок палитры: `domainLook(id)?.hue`, `modeGroupLook(g).hue`); без неё —
   *  --h родителя (лист сущности), нет и его — солома. */
  hue?: PaperHue;
  disabled?: boolean;
  className?: string;
}

export function SignChip({ label, on, onToggle, sign, art, radio, hue, disabled, className }: SignChipProps) {
  const mark: SignKey | undefined = on ? 'check' : sign;
  const picture = on || !art ? (mark && <SignArt sign={mark} size="nav" />) : art;
  const cls = ['ds-chip ds-chip--toggle pa-chip', picture && 'pa-chip--mark', on && 'is-on', className].filter(Boolean).join(' ');
  const state = radio ? { role: 'radio', 'aria-checked': on } : { 'aria-pressed': on };
  return (
    <button type="button" className={cls} {...state}
      disabled={disabled} onClick={onToggle} style={hue === undefined ? undefined : ({ '--h': hue } as CSSProperties)}>
      {picture && <span className="pa-chip-sign" aria-hidden="true" data-sign={on ? 'check' : mark}>{picture}</span>}
      <span className="pa-chip-label">{label}</span>
    </button>
  );
}
