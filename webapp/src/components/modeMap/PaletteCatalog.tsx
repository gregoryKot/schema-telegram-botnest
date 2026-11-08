import { useState, type ReactNode } from 'react';
import { DomainArt } from '../art/DomainArt';
import { GuideSignArt } from '../art/GuideSigns';
import { modeGroupSign } from '../art/guideSignsModel';
import { MMIcon } from '../modeMapIcons';
import type { Draft } from './modeDraft';
import { PaletteGroup } from './PaletteGroup';
import { CATALOG_DOMAINS, CATALOG_MODE_GROUPS, CATALOG_TOTAL } from './paletteModel';
import { useCatalogOpen } from './useCatalogOpen';

interface Props {
  /** У клиента нечего брать (концептуализации нет или она не загрузилась) — каталог открыт сразу. */
  clientEmpty: boolean;
  onAdd: (node: Draft) => void;
  /** «Мои режимы», пока своих режимов нет: строка с «+» живёт в каталоге. */
  children?: ReactNode;
}

/**
 * Каталог палитры одной строкой внизу: все 35 режимов по группам и 20 схем по доменам.
 * Знак группы — тот же, что у листа режима в подсказках (modeGroupSign), знак домена — DomainArt.
 */
export function PaletteCatalog({ clientEmpty, onAdd, children }: Props) {
  const [open, toggle] = useCatalogOpen(clientEmpty);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = (id: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  return (
    <div className="mm2-cat">
      <button onClick={toggle} aria-expanded={open} className="mm2-pal-more">
        <span className="mm2-pal-head-name">Все режимы и схемы</span>
        <span className="mm2-pal-head-n">{CATALOG_TOTAL}</span>
        <MMIcon name="caret" size={12} stroke={1.6} className="mm2-pal-chev" />
      </button>
      {open && (
        <>
          {CATALOG_MODE_GROUPS.map(g => (
            <PaletteGroup key={g.id} group={g} art={<GuideSignArt sign={modeGroupSign(g.id)} size="row" />}
              open={openGroups.has(g.id)} onToggle={toggleGroup} onAdd={onAdd} />
          ))}
          {children}
          {CATALOG_DOMAINS.map(d => (
            <PaletteGroup key={d.id} group={d} art={<DomainArt domain={d.domain ?? 0} size="row" />}
              open={openGroups.has(d.id)} onToggle={toggleGroup} onAdd={onAdd} />
          ))}
        </>
      )}
    </div>
  );
}
