// «Мои схемы»/«Мои режимы» в листе портрета: частота за неделю и статус
// карточки словами; строка открывает экран паттерна. Порядок — общий
// buildMyPatternRows (shared), частоты и статус приходят от usePatternLayer
// (один счёт, не второй). Пока записи грузятся, частота и статус не
// показываются вовсе — «пока пустая» было бы враньём.
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { buildMyPatternRows } from '../../../../shared/src/pattern/myPatternRows';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { FreqMark } from '../schemas/FreqMark';
import { shortName } from '../schemas/schemasModel';

interface Props {
  kind: MyCardsKind;
  ids: string[];
  freq?: Record<string, number>;
  filled: ReadonlySet<string>;
  statusFor?: (id: string) => string;
  onOpen: (id: string) => void;
}

export function PortraitPatternRows({ kind, ids, freq, filled, statusFor, onOpen }: Props) {
  if (ids.length === 0) return null;
  const rows = buildMyPatternRows(kind, ids, freq ?? {}, filled);
  return (
    <section className="ds-card cpf-card">
      <h3 className="ds-h3">{kind === 'schema' ? 'Мои схемы' : 'Мои режимы'}</h3>
      <div className="cpf-prows">
        {rows.map((r) => (
          <button key={r.id} type="button" className="cpf-prow" onClick={() => onOpen(r.id)}>
            <IdentityDot color={r.meta.color} size={10} />
            <span className="cpf-prow-main">
              <span className="cpf-prow-name">{kind === 'schema' ? shortName(r.meta.name) : r.meta.name}</span>
              {statusFor && <span className="cpf-prow-status">{statusFor(r.id)}</span>}
            </span>
            {freq && <FreqMark freq={freq[r.id] ?? 0} />}
            <span aria-hidden className="cpf-chev">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}
