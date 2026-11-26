import type { ReactNode } from 'react';
import type { Draft } from './modeDraft';
import type { CatalogGroup } from './paletteModel';
import { PaletteHead, PaletteRow } from './PaletteParts';

interface Props {
  group: CatalogGroup;
  /** Знак группы режимов или домена схем (svg размера row). */
  art: ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
  onAdd: (node: Draft) => void;
}

/** Сворачиваемая группа каталога палитры: группа режимов и домен схем — одна механика. */
export function PaletteGroup({ group, art, open, onToggle, onAdd }: Props) {
  return (
    <div data-group={group.id}>
      <PaletteHead art={art} title={group.title} hint={group.hint} count={group.total} open={open} onToggle={() => onToggle(group.id)} />
      {open && group.items.map(item => <PaletteRow key={item.id} item={item} onAdd={onAdd} />)}
    </div>
  );
}
