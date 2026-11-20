// Знаки трёх стилей копинга (COPING_STYLES, shared/src/schemaTherapy/guide/copingStyles.ts; язык знаков —
// docs/design/PAPER_2026-11.md). В каждом знаке схема — слои (как у Layers), а лента цвета стиля
// показывает, что человек с ними делает:
//  • CopingSurrender — капитуляция: лента поднялась и поникла, легла на слои — сдалась схеме.
//  • CopingAvoidance — избегание: лента огибает слои снизу широкой петлёй и уходит дальше на том же уровне.
//  • CopingOvercompensation — гиперкомпенсация: лента выгибается от слоёв вверх и закручивается — наоборот.
// Цвет ленты — токен стиля (--coping-*), поле 120×64, как у мотивов кабинета.
import { COPING_STYLES, type CopingStyleId } from '../../../../shared/src/schemaTherapy/guide/copingStyles';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const color = (id: CopingStyleId) => COPING_STYLES.find((s) => s.id === id)?.color;

/** Схема — два слоя: нижний шире, верхний короче, как у Layers. */
function SchemaLayers({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <>
      <rect x={x} y={y + 11} width={w} height="12" rx="6" fill={PAPER.brown} />
      <rect x={x + w * 0.18} y={y} width={w * 0.64} height="12" rx="6" fill={PAPER.amber} />
    </>
  );
}

const RIBBON = { fill: 'none', strokeWidth: 11, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function CopingSurrender({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <SchemaLayers x={62} y={35} w={50} />
      <path d="M14 58 C 12 30, 24 8, 46 8 C 66 8, 76 18, 80 32" {...RIBBON} stroke={color('surrender')} />
    </Svg>
  );
}

export function CopingAvoidance({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <SchemaLayers x={38} y={8} w={44} />
      <path d="M8 22 C 22 22, 22 56, 60 56 C 98 56, 98 22, 112 22" {...RIBBON} stroke={color('avoidance')} />
    </Svg>
  );
}

export function CopingOvercompensation({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <SchemaLayers x={8} y={35} w={50} />
      <path d="M50 38 C 70 36, 74 12, 92 8 C 106 5, 112 18, 102 24 C 94 28, 88 20, 94 16" {...RIBBON} stroke={color('overcompensation')} />
    </Svg>
  );
}
