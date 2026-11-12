import type { ReactNode } from 'react';
import type { ModeMapMeta } from '../../api';
import { KIND_META } from './mapKinds';
import { FadeSeg } from '../FadeSeg';

interface Props {
  maps: ModeMapMeta[];
  activeId: number | null;
  editingId: number | null;
  /** Поле переименования — рисует селектор (у него состояние и сохранение). */
  renderEdit: (m: ModeMapMeta) => ReactNode;
  onSelect: (id: number) => void;
}

/**
 * Лента карт клиента над холстом (ModeMapSelector). Карт больше, чем входит, — край затухает, а не
 * режет название по букве, активная карта доводится до видимой (FadeSeg).
 */
export function MapTabs({ maps, activeId, editingId, renderEdit, onSelect }: Props) {
  return (
    <FadeSeg role="group" label="Графические карты" watch={`${activeId}:${editingId}:${maps.map(m => m.title).join('|')}`}>
      {maps.map(m => editingId === m.id ? renderEdit(m) : (
        <button key={m.id} type="button" aria-pressed={activeId === m.id} onClick={() => onSelect(m.id)}
          title={KIND_META[m.kind]?.label} className={`ds-seg-btn${activeId === m.id ? ' is-active' : ''}`}>
          {m.title}
        </button>
      ))}
    </FadeSeg>
  );
}
