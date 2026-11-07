import type { ModeMapNode } from '../../api';

export type Draft = Omit<ModeMapNode, 'position'>;

/** Заготовка узла режима: id уникален на каждый клик/перетаскивание. */
export const makeModeNode = (modeId: string, type: ModeMapNode['type'], label: string, extra?: Partial<ModeMapNode['data']>): Draft => ({
  id: `${modeId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type, data: { modeId, label, ...extra },
});
