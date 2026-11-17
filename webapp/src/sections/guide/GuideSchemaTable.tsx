import { useMemo } from 'react';
import { SignGroup } from '../../components/schemaSheets/SignGroup';
import type { SchemaDomainGuide } from '../../../../shared/src/schemaTherapy/guide';
import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';
import { buildSchemaTable, COPING_COLUMNS } from './guideSchemaTableModel';

export type SchemaView = 'list' | 'table';
const SCHEMA_VIEWS: { id: SchemaView; label: string }[] = [{ id: 'list', label: 'Списком' }, { id: 'table', label: 'Таблицей' }];

/** Вид раздела «Схемы» рядом с вкладками: список по доменам или общая таблица копингов. */
export function SchemaViewSwitch({ view, onPick }: { view: SchemaView; onPick: (v: SchemaView) => void }) {
  return (
    <div className="ds-seg ds-seg--full" role="group" aria-label="Вид раздела «Схемы»">
      {SCHEMA_VIEWS.map((v) => (
        <button
          key={v.id} type="button" aria-pressed={view === v.id}
          className={`ds-seg-btn${view === v.id ? ' is-active' : ''}`} onClick={() => onPick(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

interface Props {
  /** Группы списка «Схем» (buildReference): домены, их вид и строки. */
  groups: ReferenceGroup[];
  guides: SchemaDomainGuide[];
  onOpen: (item: ReferenceItem) => void;
}

/**
 * «Схемы» → «Таблицей» в «Справочнике» терапевта: строка над таблицей отвечает, что такое три копинга,
 * дальше — лист домена (SignGroup, как у списка) с таблицей его схем. На широком контейнере — колонки
 * «Схема / Капитуляция / Избегание / Гиперкомпенсация», на узком — карточка схемы с подписанными
 * строками копингов (guide-reference.css). Тап по схеме открывает её лист.
 */
export function GuideSchemaTable({ groups, guides, onOpen }: Props) {
  const table = useMemo(() => buildSchemaTable(groups, guides), [groups, guides]);
  return (
    <div className="gr-wrap">
      <div className="gst-list">
        <p className="gst-lede">
          Одна схема — три способа с ней жить. Капитуляция: человек живёт так, будто схема права.
          Избегание: обходит всё, что может её включить. Гиперкомпенсация: ведёт себя так, будто верно
          обратное.
        </p>
        {table.map((g) => (
          <SignGroup key={g.key} look={g.look} title={g.title} label={g.title} headAs="h2" rowsClassName="gst-rows">
            <table className="gst-table">
              <thead>
                <tr>
                  <th scope="col">Схема</th>
                  {COPING_COLUMNS.map((c) => <th key={c.key} scope="col">{c.label}</th>)}
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
                    {COPING_COLUMNS.map((c) => (
                      <td key={c.key}>
                        <span className="gst-label">{c.label}</span>
                        {r.coping[c.key]}
                      </td>
                    ))}
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
