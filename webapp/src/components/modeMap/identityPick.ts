import type { ModeMapNode } from '../../api';
import { getSchemaById } from '../../schemaTherapyData';
import { getNeedData } from '../../needData';
import { needColor } from '../../../../shared/src/needs/needColors';

// Чем является фигура схемы случая: какая схема у «Схемы», какая из пяти
// потребностей у «Потребности». Выбор приносит название и цвет, как у фигуры из
// каталога; подпись, которую терапевт написал сам, и свой цвет он не трогает.

type Data = ModeMapNode['data'];

const NEED_NAMES = getNeedData('ty'); // названия потребностей одинаковы в обеих формах обращения

/** Подпись прежняя по умолчанию: пустая, заготовка палитры или имя прежнего выбора. */
const isStockLabel = (label: string, stock: string, prevName?: string) => !label.trim() || label === stock || label === prevName;

/** Цвет прежний по умолчанию: не задан или цвет прежнего выбора. */
const isStockColor = (color: string | undefined, prevColor?: string) => !color || color === prevColor;

export function pickNeed(d: Data, needId: string): Partial<Data> {
  const prev = d.needId ? NEED_NAMES[d.needId]?.name : undefined;
  const name = NEED_NAMES[needId]?.name;
  return {
    needId,
    ...(name && isStockLabel(d.label, 'Потребность', prev) ? { label: name } : {}),
    ...(isStockColor(d.customColor, d.needId ? needColor(d.needId) : undefined) ? { customColor: needColor(needId) } : {}),
  };
}

export function pickSchema(d: Data, schemaId: string): Partial<Data> {
  const prev = d.schemaId ? getSchemaById(d.schemaId) : undefined;
  const s = schemaId ? getSchemaById(schemaId) : undefined;
  if (!s) return { schemaId: undefined };
  return {
    schemaId,
    ...(isStockLabel(d.label, 'Схема', prev?.name) ? { label: s.name } : {}),
    ...(isStockColor(d.customColor, prev?.domainColor) ? { customColor: s.domainColor } : {}),
  };
}
