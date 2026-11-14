// «Мои схемы»/«Мои режимы» в листе портрета: знак домена схемы или группы режима (patternLook —
// тот же вид, что у экрана паттерна, b15) вместо цветной точки, частота за неделю и статус
// карточки словами; строка открывает экран паттерна. Порядок — общий buildMyPatternRows (shared),
// частоты и статус приходят от usePatternLayer (один счёт, не второй). Пока записи грузятся,
// частота и статус не показываются вовсе — «пока пустая» было бы враньём.
import { buildMyPatternRows } from '../../../../shared/src/pattern/myPatternRows';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { SignArt } from '../../components/art/SignArt';
import { patternLook } from '../../components/patternSheet/patternHue';
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
    <section className="cpf-plist">
      <h3 className="ds-h3 cpf-plist-title">{kind === 'schema' ? 'Мои схемы' : 'Мои режимы'}</h3>
      <div className="cpf-plist-rows">
        {rows.map((r) => {
          const look = patternLook(kind, r.id);
          return (
            <button key={r.id} type="button" className="ds-list-row ds-list-row--inset ds-list-row--hover cpf-prow" onClick={() => onOpen(r.id)}>
              <span className="pp-row-art" aria-hidden="true">{look && <SignArt sign={look.sign} size="row" />}</span>
              <span className="ds-list-body">
                <span className="ds-list-title">{kind === 'schema' ? shortName(r.meta.name) : r.meta.name}</span>
                {statusFor && <span className="ds-list-sub">{statusFor(r.id)}</span>}
              </span>
              {freq && <FreqMark freq={freq[r.id] ?? 0} />}
              <span className="ds-chev" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
