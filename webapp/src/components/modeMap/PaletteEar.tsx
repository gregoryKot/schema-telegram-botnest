import { MMIcon } from '../modeMapIcons';

/**
 * «Ушко» палитры холста: раскрытая — кружок на её правом краю, свёрнутая — узкая полоса во всю
 * высоту холста у левого края. Свернуть палитру — отдать её 240px холсту (b34); на узком окне она
 * свёрнута с открытия (paletteOpen.ts). Шеврон — SVG, поворот задаёт CSS (.mm2-ear, sheet-modemap.css).
 */
export function PaletteEar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const label = open ? 'Скрыть панель режимов' : 'Показать панель режимов';
  return (
    <button type="button" onClick={onToggle} title={label} aria-label={label} className={`mm2-ear${open ? '' : ' is-closed'}`}>
      <MMIcon name="caret" size={13} />
    </button>
  );
}
