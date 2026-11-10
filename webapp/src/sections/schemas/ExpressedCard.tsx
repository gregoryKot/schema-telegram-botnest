import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { fmtDate, momentDayKey } from '../../utils/format';
import { useTr } from '../../utils/addressForm';
import { hueStyle } from '../../lib/tone';
import { Skeleton } from '../../components/Skeleton';
import { SignArt } from '../../components/art/SignArt';
import { domainLook } from '../../../../shared/src/theme/entityLook';
import { runStarts } from '../../../../shared/src/utils/runStarts';
import { findSchema, rankExpressed, type YsqScore } from './schemasModel';

const domainOf = (id: string) => findSchema(SCHEMA_DOMAINS, id)?.domain.id ?? id;

/** Знак домена у строки — размер строки (44×24), как в SignGroup (ревью g5 r1), только у первой строки серии одного
 *  домена (ревью g5 r2: две одинаковые пары палочек подряд читались маркером списка). У продолжения серии — тихая
 *  связка, штрих тоном домена по высоте строки: пустое гнездо читалось недостающей картинкой (ревью g5 r3). */
function DomainSign({ id, start }: { id: string; start: boolean }) {
  const look = start ? domainLook(domainOf(id)) : null;
  return (
    <span className={start ? 'cs-bar-sign' : 'cs-bar-sign cs-bar-sign--run'} aria-hidden="true">
      {start ? look && <SignArt sign={look.sign} size="row" /> : <span className="cs-bar-run" />}
    </span>
  );
}

interface Props {
  loading: boolean;
  ysqSchemaIds: string[];
  ysqScores: Record<string, YsqScore>;
  completedAt: string | null;
  onOpenSchema: (id: string) => void;
}

/** Карточка «Выраженные схемы»: бары цвета домена по результатам YSQ — плотный список данных на белом
 *  листе (принцип 6: белая карточка остаётся у плотных списков), у строки — знак домена. Рисуется только с
 *  данными или пока грузится (patternsHero.topPair): пустой карточки нет. */
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
      <div className="cs-expressed-list">
        {loading ? [0, 1, 2, 3].map(i => <Skeleton key={i} height={22} />) : items.map((it, i) => (
          <button key={it.id} className="cs-bar-row" style={hueStyle(it.hue)} onClick={() => onOpenSchema(it.id)}>
            <span className="cs-bar-name"><DomainSign id={it.id} start={starts[i]} />{it.name}</span>
            <span className="cs-bar-track"><span className="cs-bar-fill tone-fill" style={{ width: `${it.barPct}%` }} /></span>
            <span className="cs-bar-val tone-ink">{it.valueLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
