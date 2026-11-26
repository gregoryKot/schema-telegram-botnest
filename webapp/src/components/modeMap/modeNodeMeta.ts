import { MODE_GROUPS } from '../../schemaTherapyData';
import { GROUP_TO_TYPE, type NodeType } from '../modeMapData';
import type { CopingSubtype } from './shapeOptions';

export interface ModeNodeMeta {
  type: NodeType;
  copingSubtype?: CopingSubtype;
  color: string;
  name: string;
}

/** Тип ноды, подтип копинга, цвет и название режима по его id; null — режима нет в группах. */
export function findModeMeta(modeId: string): ModeNodeMeta | null {
  for (const group of MODE_GROUPS) {
    const meta = GROUP_TO_TYPE[group.id];
    if (!meta) continue;
    const item = group.items.find((i) => i.id === modeId);
    if (item) return { type: meta.type, copingSubtype: meta.copingSubtype, color: meta.color, name: item.name };
  }
  return null;
}

/**
 * Тип ноды режима на карте — один источник для «Из концептуализации» и для
 * перенесённой схемы случая. Режим вне групп (свой) рисуется как 'custom'.
 */
export function modeNodeType(modeId: string): { type: NodeType; copingSubtype?: CopingSubtype } {
  const meta = findModeMeta(modeId);
  return { type: meta?.type ?? 'custom', ...(meta?.copingSubtype ? { copingSubtype: meta.copingSubtype } : {}) };
}
