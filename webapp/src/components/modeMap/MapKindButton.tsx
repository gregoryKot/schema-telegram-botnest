import type { ModeMapKind } from '../../api';
import { hueStyle } from '../../lib/tone';
import { SignArt } from '../art/SignArt';
import { KIND_LOOK } from './kindLook';
import { KIND_META } from './mapKinds';

interface Props {
  kind: ModeMapKind;
  /** menu — строка меню «Новая карта» со знаком 24×14; cards — плитка бумаги экрана «нет карт». */
  variant: 'menu' | 'cards';
  hint: string;
  disabled?: boolean;
  onPick: (kind: ModeMapKind) => void;
}

/** Один тип графической карты: знак типа, название, пояснение. Бумага плитки — оттенок типа (kindLook.ts). */
export function MapKindButton({ kind, variant, hint, disabled, onPick }: Props) {
  const look = KIND_LOOK[kind];
  const menu = variant === 'menu';
  return (
    <button type="button" onClick={() => onPick(kind)} disabled={disabled} style={menu ? undefined : hueStyle(look.hue)}
      className={menu ? 'ds-menu-item' : 'pp-paper pp-square mm2-kind-card'}>
      <SignArt sign={look.sign} size={menu ? 'nav' : 'square'} />
      <span className="mm2-kind-text">
        <span className="mm2-kind-name">{KIND_META[kind].label}</span>
        <span className="mm2-kind-hint">{hint}</span>
      </span>
    </button>
  );
}
