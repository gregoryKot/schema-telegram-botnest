import { useState, type CSSProperties } from 'react';
import type { SheetLook } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../../components/art/SignArt';
import { GlyphCheck } from '../../components/exercises/ExScreen';

export interface MapTile { id: string; name: string; desc: string; isMine: boolean }

interface Props {
  look: SheetLook;
  title: string;
  /** Подпись из данных под названием («2 из 5 отмечены»). */
  meta?: string;
  tiles: MapTile[];
  onOpen: (id: string) => void;
}

/**
 * Домен «Полной карты» или группа «Карты режимов» — аккордеон на бумаге домена/группы (редизайн 2026-11,
 * b15): шапка-кнопка со знаком 60px, названием Literata и подписью из данных, внутри — белые плитки.
 * Свёрнут по умолчанию: длинная простыня из 20 схем и 35 режимов становится пятью-шестью цветными
 * листами, и ритм страницы держит смена бумаги. Отмеченная своя — бумага листа с галочкой, не рамка.
 */
export function MapFold({ look, title, meta, tiles, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pp-paper cs-mapfold" style={{ '--h': look.hue } as CSSProperties}>
      <button type="button" className="cs-mapfold-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {look.sign && <span className="sg-sign" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>}
        <span className="cs-mapfold-text">
          <span className="cs-mapfold-name">{title}</span>
          {meta && <span className="cs-mapfold-meta">{meta}</span>}
        </span>
        <span className="ds-fold-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="cs-tiles">
          {tiles.map(t => (
            <button key={t.id} type="button" className={'cs-tile' + (t.isMine ? ' is-mine' : '')} onClick={() => onOpen(t.id)}>
              <span className="cs-tile-name">{t.name}{t.isMine && <span className="cs-tile-check" aria-hidden="true"><GlyphCheck /></span>}</span>
              <span className="cs-tile-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
