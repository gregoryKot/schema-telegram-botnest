import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { PaperEmpty } from '../../components/art/PaperEmpty';
import { fmtDate, momentDayKey } from '../../utils/format';
import { useTr } from '../../utils/addressForm';
import { hueStyle } from '../../lib/tone';
import { Skeleton } from '../../components/Skeleton';
import { SignArt } from '../../components/art/SignArt';
import { domainLook } from '../../../../shared/src/theme/entityLook';
import { runStarts } from '../../../../shared/src/utils/runStarts';
import { findSchema, rankExpressed, type YsqScore } from './schemasModel';

const domainOf = (id: string) => findSchema(SCHEMA_DOMAINS, id)?.domain.id ?? id;

/** Знак домена у строки — размер строки (44×24), как в SignGroup (ревью g5 r1); только у первой строки серии
 *  одного домена, у остальных — отступ того же размера: две одинаковые пары палочек подряд читались маркером
 *  списка (ревью g5 r2). */
function DomainSign({ id, show }: { id: string; show: boolean }) {
  const look = show ? domainLook(domainOf(id)) : null;
  return <span className="cs-bar-sign" aria-hidden="true">{look && <SignArt sign={look.sign} size="row" />}</span>;
}

interface Props {
  loading: boolean;
  ysqSchemaIds: string[];
  ysqScores: Record<string, YsqScore>;
  completedAt: string | null;
  onOpenSchema: (id: string) => void;
}

/** Карточка «Выраженные схемы»: бары цвета домена по результатам YSQ — плотный список данных на белом
 *  листе (принцип 6: белая карточка остаётся у плотных списков), у строки — знак домена. */
export function ExpressedCard({ loading, ysqSchemaIds, ysqScores, completedAt, onOpenSchema }: Props) {
  const tr = useTr();
  const items = rankExpressed(SCHEMA_DOMAINS, ysqSchemaIds, ysqScores);
  const starts = runStarts(items.map(it => domainOf(it.id)));
  return (
    <div className="ds-card cs-expressed">
      <div className="ds-head-row">
        <h3 className="ds-h3">{tr('Твои выраженные схемы', 'Ваши выраженные схемы')}</h3>
        {completedAt && <span className="ds-sub">тест от {fmtDate(momentDayKey(completedAt))}</span>}
      </div>
      {loading ? (
        <div className="cs-expressed-list">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height={22} />)}
        </div>
      ) : items.length === 0 ? (
        <PaperEmpty>{tr('Здесь появятся схемы, которые тест покажет самыми выраженными. Пройди его справа.', 'Здесь появятся схемы, которые тест покажет самыми выраженными. Пройдите его справа.')}</PaperEmpty>
      ) : (
        <div className="cs-expressed-list">
          {items.map((it, i) => (
            <button key={it.id} className="cs-bar-row" style={hueStyle(it.hue)} onClick={() => onOpenSchema(it.id)}>
              <span className="cs-bar-name"><DomainSign id={it.id} show={starts[i]} />{it.name}</span>
              <span className="cs-bar-track"><span className="cs-bar-fill tone-fill" style={{ width: `${it.barPct}%` }} /></span>
              <span className="cs-bar-val tone-ink">{it.valueLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
