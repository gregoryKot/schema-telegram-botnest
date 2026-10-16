import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { fmtDate, momentDayKey } from '../../utils/format';
import { useTr } from '../../utils/addressForm';
import { hueStyle } from '../../lib/tone';
import { Skeleton } from '../../components/Skeleton';
import { rankExpressed, type YsqScore } from './schemasModel';

interface Props {
  loading: boolean;
  ysqSchemaIds: string[];
  ysqScores: Record<string, YsqScore>;
  completedAt: string | null;
  onOpenSchema: (id: string) => void;
}

/** Карточка «Выраженные схемы»: бары цвета домена по результатам YSQ. */
export function ExpressedCard({ loading, ysqSchemaIds, ysqScores, completedAt, onOpenSchema }: Props) {
  const tr = useTr();
  const items = rankExpressed(SCHEMA_DOMAINS, ysqSchemaIds, ysqScores);
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
        <p className="cs-empty">
          {tr('Здесь появятся схемы, которые тест покажет самыми выраженными. Пройди его справа.',
              'Здесь появятся схемы, которые тест покажет самыми выраженными. Пройдите его справа.')}
        </p>
      ) : (
        <div className="cs-expressed-list">
          {items.map(it => (
            <button key={it.id} className="cs-bar-row" style={hueStyle(it.hue)} onClick={() => onOpenSchema(it.id)}>
              <span className="cs-bar-name"><i className="cs-bar-mark tone-fill" />{it.name}</span>
              <span className="cs-bar-track"><span className="cs-bar-fill tone-fill" style={{ width: `${it.barPct}%` }} /></span>
              <span className="cs-bar-val tone-ink">{it.valueLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
