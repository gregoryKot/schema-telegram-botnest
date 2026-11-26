import { SignArt } from '../../components/art/SignArt';
import { LineTabs, type LineTab } from '../../components/LineTabs';
import { COPING_STYLES } from '../../../../shared/src/schemaTherapy/guide/copingStyles';
import type { CopingFilter, TableDepth } from './guideSchemaTableModel';

const FILTERS: LineTab<CopingFilter>[] = [
  { id: 'all', label: 'Все три' },
  ...COPING_STYLES.map((s) => ({ id: s.id, label: <><span className="gst-seg-sign"><SignArt sign={s.sign} size="nav" /></span>{s.label}</> })),
];

export type SchemaView = 'list' | 'table';
const SCHEMA_VIEWS: { id: SchemaView; label: string }[] = [{ id: 'list', label: 'Списком' }, { id: 'table', label: 'Таблицей' }];

/** Вид раздела «Схемы» — тихая пара справа на линии вкладок: список по доменам или общая таблица копингов. */
export function SchemaViewSwitch({ view, onPick }: { view: SchemaView; onPick: (v: SchemaView) => void }) {
  return <LineTabs tabs={SCHEMA_VIEWS} value={view} onPick={onPick} label="Вид раздела «Схемы»" look="quiet" />;
}

const DEPTHS: LineTab<TableDepth>[] = [{ id: 'short', label: 'Коротко' }, { id: 'full', label: 'Подробно' }];

/** Липкая шапка таблицы копингов: стиль копинга — вкладками на линии, подробность — тихой парой справа. */
export function GuideSchemaTableBar({ filter, depth, onFilter, onDepth }: {
  filter: CopingFilter; depth: TableDepth; onFilter: (f: CopingFilter) => void; onDepth: (d: TableDepth) => void;
}) {
  return (
    <div className="gst-bar">
      <LineTabs
        tabs={FILTERS} value={filter} onPick={onFilter} label="Стиль копинга" look="scroll"
        aside={<LineTabs tabs={DEPTHS} value={depth} onPick={onDepth} label="Подробность текста" look="quiet" />}
      />
    </div>
  );
}
