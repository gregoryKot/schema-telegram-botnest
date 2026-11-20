import type { ReactNode } from 'react';
import { SignArt } from '../../components/art/SignArt';
import { COPING_STYLES } from '../../../../shared/src/schemaTherapy/guide/copingStyles';
import type { CopingFilter, TableDepth } from './guideSchemaTableModel';

interface SegOption<T extends string> { id: T; label: string; art?: ReactNode }

/** Ряд ds-seg кнопок справочника: вид «Схем», стиль копинга, глубина таблицы. */
export function GuideSeg<T extends string>({ options, value, onPick, label, className = '' }: {
  options: readonly SegOption<T>[]; value: T; onPick: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div className={`ds-seg ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id} type="button" aria-pressed={value === o.id}
          className={`ds-seg-btn${value === o.id ? ' is-active' : ''}`} onClick={() => onPick(o.id)}
        >
          {o.art}{o.label}
        </button>
      ))}
    </div>
  );
}

const FILTERS: SegOption<CopingFilter>[] = [
  { id: 'all', label: 'Все три' },
  ...COPING_STYLES.map((s) => ({ id: s.id, label: s.label, art: <span className="gst-seg-sign"><SignArt sign={s.sign} size="nav" /></span> })),
];
const DEPTHS: SegOption<TableDepth>[] = [{ id: 'short', label: 'Коротко' }, { id: 'full', label: 'Подробно' }];

/** Липкая шапка таблицы копингов: какой стиль показать и насколько подробно. */
export function GuideSchemaTableBar({ filter, depth, onFilter, onDepth }: {
  filter: CopingFilter; depth: TableDepth; onFilter: (f: CopingFilter) => void; onDepth: (d: TableDepth) => void;
}) {
  return (
    <div className="gst-bar">
      <GuideSeg options={FILTERS} value={filter} onPick={onFilter} label="Стиль копинга" className="gst-seg" />
      <GuideSeg options={DEPTHS} value={depth} onPick={onDepth} label="Подробность текста" />
    </div>
  );
}
