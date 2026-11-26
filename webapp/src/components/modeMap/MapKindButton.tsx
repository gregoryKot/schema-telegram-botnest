import type { ModeMapKind } from '../../api';
import { hueStyle } from '../../lib/tone';
import { SignArt } from '../art/SignArt';
import { KIND_LOOK } from './kindLook';
import { KIND_META } from './mapKinds';

interface Props {
  kind: ModeMapKind;
  /** menu — строка меню «Новая карта» со знаком 24×14; cards — строка на линии экрана «нет карт», знак на бумаге типа. */
  variant: 'menu' | 'cards';
  hint: string;
  disabled?: boolean;
  onPick: (kind: ModeMapKind) => void;
}

/** Один тип графической карты: знак типа, название, пояснение. Цвет типа — только у знака (kindLook.ts): цветной лист —
 *  у групп справочника, тип карты — строка на линии (К31). */
export function MapKindButton({ kind, variant, hint, disabled, onPick }: Props) {
  const look = KIND_LOOK[kind];
  const text = (
    <span className="mm2-kind-text">
      <span className="mm2-kind-name">{KIND_META[kind].label}</span>
      <span className="mm2-kind-hint">{hint}</span>
    </span>
  );
  if (variant === 'menu') return (
    <button type="button" onClick={() => onPick(kind)} disabled={disabled} className="ds-menu-item">
      <SignArt sign={look.sign} size="nav" />{text}
    </button>
  );
  return (
    <button type="button" onClick={() => onPick(kind)} disabled={disabled}
      className="ds-list-row ds-list-row--nav ds-list-row--inset ds-list-row--hover mm2-kind-row">
      <span className="pp-row-art mm2-kind-sign" style={hueStyle(look.hue)} aria-hidden="true"><SignArt sign={look.sign} size="row" /></span>
      {text}
      <span className="ds-chev" aria-hidden="true" />
    </button>
  );
}
