import type { ReactNode } from 'react';
import type { ModeMapMeta } from '../../api';
import { KIND_META } from './mapKinds';
import { LineTabs } from '../LineTabs';

interface Props {
  maps: ModeMapMeta[];
  activeId: number | null;
  editingId: number | null;
  /** Поле переименования — рисует селектор (у него состояние и сохранение). */
  renderEdit: (m: ModeMapMeta) => ReactNode;
  onSelect: (id: number) => void;
}

/**
 * Лента карт клиента над холстом (ModeMapSelector) — вкладки на линии: карт больше, чем входит, — край
 * затухает, а не режет название по букве, активная карта доводится до видимой (LineTabs, look="scroll").
 */
export function MapTabs({ maps, activeId, editingId, renderEdit, onSelect }: Props) {
  const tabs = maps.map(m => ({
    id: String(m.id), label: m.title, title: KIND_META[m.kind]?.label,
    field: editingId === m.id ? renderEdit(m) : undefined,
  }));
  return <LineTabs tabs={tabs} value={String(activeId)} onPick={id => onSelect(Number(id))} label="Графические карты" look="scroll" />;
}
