import { useMemo, useState, type CSSProperties } from 'react';
import { SignGroup } from '../../components/schemaSheets/SignGroup';
import { SignArt } from '../../components/art/SignArt';
import { COPING_ABOUT, type SchemaDomainGuide } from '../../../../shared/src/schemaTherapy/guide';
import { COPING_STYLES, type CopingStyle, type CopingStyleId } from '../../../../shared/src/schemaTherapy/guide/copingStyles';
import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';
import {
  buildSchemaTable, cellKey, showsFull, toggleCell, visibleStyles,
  type CopingFilter, type SchemaTableRow, type TableDepth,
} from './guideSchemaTableModel';
import { GuideSchemaTableBar, GuideSeg } from './GuideSchemaTableBar';

export type SchemaView = 'list' | 'table';
const SCHEMA_VIEWS: { id: SchemaView; label: string }[] = [{ id: 'list', label: 'Списком' }, { id: 'table', label: 'Таблицей' }];

/** Вид раздела «Схемы» рядом с вкладками: список по доменам или общая таблица копингов. */
export function SchemaViewSwitch({ view, onPick }: { view: SchemaView; onPick: (v: SchemaView) => void }) {
  return <GuideSeg options={SCHEMA_VIEWS} value={view} onPick={onPick} label="Вид раздела «Схемы»" fit="full" />;
}

interface Props {
  /** Группы списка «Схем» (buildReference): домены, их вид и строки. */
  groups: ReferenceGroup[];
  guides: SchemaDomainGuide[];
  onOpen: (item: ReferenceItem) => void;
  /** «Про клиента» у раскрытой клетки (#1484); нет — без кнопки. */
  onMark?: (cell: { schemaId: string; style: CopingStyleId }) => void;
}

/** Цвет стиля для клетки и заголовка колонки: --gst-c — заливка, --gst-ink — текст. */
const styleVars = (s: CopingStyle) => ({ '--gst-c': s.color, '--gst-ink': s.ink }) as CSSProperties;

function StyleLabel({ style, className }: { style: CopingStyle; className: string }) {
  return (
    <span className={className}>
      <span className="gst-sign"><SignArt sign={style.sign} size="nav" /></span>{style.label}
    </span>
  );
}

/**
 * «Схемы» → «Таблицей» в «Справочнике» терапевта: строка над таблицей отвечает, что такое три копинга,
 * в липкой шапке — стиль копинга и глубина, дальше — лист домена (SignGroup) с таблицей его схем. В клетке
 * жирная выжимка, полный текст — в «Подробно» или по тапу (одна раскрытая клетка). На узком контейнере
 * строка — карточка схемы с подписанными клетками (guide-reference.css). Тап по схеме открывает её лист.
 */
export function GuideSchemaTable({ groups, guides, onOpen, onMark }: Props) {
  const table = useMemo(() => buildSchemaTable(groups, guides), [groups, guides]);
  const [filter, setFilter] = useState<CopingFilter>('all');
  const [depth, setDepth] = useState<TableDepth>('short');
  const [open, setOpen] = useState<string | null>(null);
  const styles = visibleStyles(filter);
  const cell = (r: SchemaTableRow, s: CopingStyle) => {
    const key = cellKey(r.item.id, s.id);
    const headline = r.headline[s.id];
    return (
      <td key={s.id} style={styleVars(s)}>
        <StyleLabel style={s} className="gst-label" />
        <button
          type="button" className={`gst-cell${open === key ? ' is-open' : ''}`} aria-expanded={open === key}
          onClick={() => setOpen((o) => toggleCell(o, key))}
        >
          {headline && <strong className="gst-head">{headline}</strong>}
          {showsFull(depth, open, key, headline) && <span className="gst-full">{r.coping[s.id]}</span>}
        </button>
        {onMark && open === key && (
          <button type="button" className="ds-link gd-plan gst-mark" aria-label={`Про клиента: ${s.label}`} onClick={() => onMark({ schemaId: r.item.id, style: s.id })}>
            Про клиента
          </button>
        )}
      </td>
    );
  };
  return (
    <div className="gr-wrap">
      <div className="gst-list">
        <p className="gst-lede">
          Одна схема — три способа с ней жить.{' '}
          {COPING_STYLES.map((s) => `${s.label}: человек ${s.gist}.`).join(' ')} {COPING_ABOUT} В строках — примеры: один человек переходит между стилями в разных ситуациях. В клетке —
          суть одной строкой, тап по ней раскрывает полный пример и кнопку «Про клиента»: стиль ляжет в схему случая клиента.
        </p>
        <GuideSchemaTableBar filter={filter} depth={depth} onFilter={setFilter} onDepth={setDepth} />
        {table.map((g) => (
          <SignGroup key={g.key} look={g.look} title={g.title} label={g.title} headAs="h2" rowsClassName="gst-rows">
            <table className={`gst-table${styles.length === 1 ? ' gst-table--one' : ''}`}>
              <thead>
                <tr>
                  <th scope="col">Схема</th>
                  {styles.map((s) => (
                    <th key={s.id} scope="col" style={styleVars(s)}><StyleLabel style={s} className="gst-col" /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.item.id}>
                    <th scope="row">
                      <button type="button" className="gst-schema" onClick={() => onOpen(r.item)}>
                        <span className="gst-name">{r.item.name}</span>
                        {r.desc && <span className="gst-desc">{r.desc}</span>}
                      </button>
                    </th>
                    {styles.map((s) => cell(r, s))}
                  </tr>
                ))}
              </tbody>
            </table>
          </SignGroup>
        ))}
      </div>
    </div>
  );
}
