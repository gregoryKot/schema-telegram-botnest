import '../../styles/sheet-modemap.css';
import { MMIcon } from '../modeMapIcons';
import { colorPresetLabel } from './editorStyles';

// Общие кирпичи панелей редактора узла и связи: шапка, сегмент-переключатель
// и ряд цветовых кружков. Раньше каждая панель повторяла их инлайном.

export function EditorHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mm2-panel-head">
      <div className="mm2-panel-title">{title}</div>
      <button onClick={onClose} title="Закрыть" aria-label="Закрыть" className="mm2-x"><MMIcon name="close" size={15} /></button>
    </div>
  );
}

export interface SegItem {
  key: string;
  label: string;
  active: boolean;
  onPick: () => void;
  /** Подпись для title/aria-label, если она нужна кнопке. */
  hint?: string;
  /** Иконка над подписью (толщина, стиль линии). */
  lead?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SegRow({ items }: { items: SegItem[] }) {
  return (
    <div className="ds-seg mm2-seg">
      {items.map(it => (
        <button key={it.key} onClick={it.onPick} style={it.style} title={it.hint} aria-label={it.hint}
          className={`ds-seg-btn${it.lead ? ' is-icon' : ''}${it.active ? ' is-active' : ''}${it.className ? ` ${it.className}` : ''}`}>
          {it.lead}{it.label}
        </button>
      ))}
    </div>
  );
}

export function Swatches({ colors, current, onPick, onReset, resetLabel }: {
  colors: string[]; current?: string; onPick: (c: string) => void; onReset: () => void; resetLabel: string;
}) {
  return (
    <div className="mm2-swatches">
      {colors.map(c => (
        <button key={c} onClick={() => onPick(c)} aria-label={colorPresetLabel(c)} title={colorPresetLabel(c)}
          className={`mm2-swatch${current === c ? ' is-active' : ''}`} style={{ background: c }} />
      ))}
      <button onClick={onReset} title={resetLabel} aria-label={resetLabel} className="mm2-swatch is-reset"><MMIcon name="close" size={11} /></button>
    </div>
  );
}
