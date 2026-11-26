import { useEffect, useRef, type CSSProperties } from 'react';
import { Disclosure, type DisclosureClasses } from '../../../../shared/src/components/Disclosure';
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

const MAP_FOLD: DisclosureClasses = { root: 'pp-paper cs-mapfold', btn: 'cs-mapfold-head', label: 'cs-mapfold-text', chev: 'ds-fold-chev', body: 'cs-tiles' };

/**
 * Домен схем или группа режимов аккордеоном на бумаге домена/группы (редизайн 2026-11, b15; ревью g5 r1 —
 * одна механика на «Полную карту», «Карту режимов» и вкладку «Схемы» справочника): шапка-кнопка со знаком,
 * названием Literata и подписью из данных, внутри — белые плитки. Своя — бумагой листа с галочкой, не рамкой.
 * Раскрытие — общая Disclosure, здесь только вид. Классы cs-mapfold* / cs-tile* — по ним ищут рецепты стенда и тесты.
 */
export function MapFold({ look, title, meta, tiles, onOpen, open, onToggle, highlightId }: Props) {
  const hlRef = useRef<HTMLElement>(null);
  useEffect(() => { hlRef.current?.scrollIntoView?.({ block: 'center' }); }, []);
  return (
    <Disclosure
      classes={MAP_FOLD} style={{ '--h': look.hue } as CSSProperties} open={open} onToggle={onToggle}
      lead={look.sign && <span className="cs-mapfold-sign" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>}
      title={<><span className="cs-mapfold-name">{glue(title)}</span>{meta && <span className="cs-mapfold-meta">{meta}</span>}</>}
    >
      {tiles.map(t => {
        const hl = t.id === highlightId;
        const cls = 'cs-tile' + (t.isMine ? ' is-mine' : '') + (hl ? ' is-hl' : '');
        const body = <>
          <span className="cs-tile-name">{glue(t.name)}{t.isMine && <span className="cs-tile-check" aria-hidden="true"><GlyphCheck /></span>}</span>
          <span className="cs-tile-desc">{glue(t.desc)}</span>
        </>;
        return onOpen
          ? <button key={t.id} type="button" className={cls} onClick={() => onOpen(t.id)} ref={hl ? (el) => { hlRef.current = el; } : undefined} aria-current={hl || undefined}>{body}</button>
          : <div key={t.id} className={cls} ref={hl ? (el) => { hlRef.current = el; } : undefined} aria-current={hl || undefined}>{body}</div>;
      })}
    </Disclosure>
  );
}
