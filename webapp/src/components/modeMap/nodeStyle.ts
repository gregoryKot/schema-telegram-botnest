import type { ModeMapNode } from '../../api';

// Данные ноды карты режимов — тот же объект, что хранится в ModeMapNode.data.
export type ModeNodeData = ModeMapNode['data'];

// Размер текста фигуры; бумага, оттенок и толщина контура — nodePaper.ts.
const FONT_PX: Record<string, number> = { sm: 11.5, md: 13.5, lg: 16.5 };
export const fontPx = (d: ModeNodeData) => FONT_PX[d.fontSize ?? 'md'] ?? 13.5;
