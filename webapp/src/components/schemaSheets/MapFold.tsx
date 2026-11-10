import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SheetLook } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import { SignArt } from '../art/SignArt';
import { GlyphCheck } from '../exercises/ExScreen';
import '../../styles/sheet-schemas.css';

export interface MapTile { id: string; name: string; desc: string; isMine?: boolean }

interface Props {
  look: SheetLook;
  title: string;
  /** Подпись из данных под названием («2 из 5 отмечены», «4 схемы»). */
  meta?: string;
  tiles: MapTile[];
  /** Тап по плитке; без него плитка — текст (справочник: описание уже на ней). */
  onOpen?: (id: string) => void;
  /** Управляемое раскрытие: справочник держит открытым один домен. Без пропа — своё состояние, свёрнут. */
  open?: boolean;
  onToggle?: () => void;
  /** Плитка, к которой пришли (схема из результата теста): приподнята слоем и подъезжает в окно один раз. */
  highlightId?: string;
}

/**
 * Домен схем или группа режимов аккордеоном на бумаге домена/группы (редизайн 2026-11, b15; ревью g5 r1 —
 * одна механика на «Полную карту», «Карту режимов» и вкладку «Схемы» справочника): шапка-кнопка со знаком,
 * названием Literata и подписью из данных, внутри — белые плитки. Своя — бумагой листа с галочкой, не рамкой.
 * Классы cs-mapfold* / cs-tile* — по ним ищут рецепты стенда и тесты.
 */
export function MapFold({ look, title, meta, tiles, onOpen, open: openProp, onToggle, highlightId }: Props) {
  const [openOwn, setOpenOwn] = useState(false);
  const open = openProp ?? openOwn;
  const hlRef = useRef<HTMLElement>(null);
  useEffect(() => { hlRef.current?.scrollIntoView?.({ block: 'center' }); }, []);
  return (
    <section className="pp-paper cs-mapfold" style={{ '--h': look.hue } as CSSProperties}>
      <button type="button" className="cs-mapfold-head" aria-expanded={open} onClick={onToggle ?? (() => setOpenOwn(o => !o))}>
        {look.sign && <span className="cs-mapfold-sign" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>}
        <span className="cs-mapfold-text">
          <span className="cs-mapfold-name">{glue(title)}</span>
          {meta && <span className="cs-mapfold-meta">{meta}</span>}
        </span>
        <span className="ds-fold-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="cs-tiles">
          {tiles.map(t => {
            const hl = t.id === highlightId;
            const cls = 'cs-tile' + (t.isMine ? ' is-mine' : '') + (hl ? ' is-hl' : '');
            const body = <>
              <span className="cs-tile-name">{t.name}{t.isMine && <span className="cs-tile-check" aria-hidden="true"><GlyphCheck /></span>}</span>
              <span className="cs-tile-desc">{t.desc}</span>
            </>;
            return onOpen
              ? <button key={t.id} type="button" className={cls} onClick={() => onOpen(t.id)} ref={hl ? (el) => { hlRef.current = el; } : undefined} aria-current={hl || undefined}>{body}</button>
              : <div key={t.id} className={cls} ref={hl ? (el) => { hlRef.current = el; } : undefined} aria-current={hl || undefined}>{body}</div>;
          })}
        </div>
      )}
    </section>
  );
}
