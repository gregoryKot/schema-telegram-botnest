// Знак «Всё по схеме» (docs/design/PAPER_2026-11.md, «Язык знаков»): дуга-ладони держит
// круг, за ними полоска. Геометрия общая с favicon, иконками PWA и футером карточек шаринга
// (shared/src/share/kit/brandMark.ts), цвета — токены PAPER. Класс light-lock: знак всегда
// на светлой бумаге, как иконка приложения, — и на тёмном лендинге, и при тёмной теме.
// Декор: имя продукта несёт текст рядом.
import {
  ARC, ARC_D, CORE, MARK_VIEW, STRIPE_D, TILE_RX, fitTransform, markFit,
} from '../../../../shared/src/share/kit/brandMark';
import { PAPER } from './paper';

const MARK_STYLE = { display: 'block', flexShrink: 0 } as const;

/** `simple` — без полоски фона (16–24 px: рассыпается в шум); `bare` — без плитки, знак прямо на бумаге листа (r1). */
export function BrandMark({ size = 32, simple = false, bare = false, className }: { size?: number; simple?: boolean; bare?: boolean; className?: string }) {
  return (
    <svg className={className ? `light-lock ${className}` : 'light-lock'} style={MARK_STYLE}
         width={size} height={size} viewBox={`0 0 ${MARK_VIEW} ${MARK_VIEW}`}
         aria-hidden="true" focusable="false" data-brand-mark={simple ? 'simple' : 'full'}>
      {/* Плитка — бумага страницы (--bg). */}
      {!bare && <rect width={MARK_VIEW} height={MARK_VIEW} rx={TILE_RX} fill="var(--bg)" />}
      {!simple && <path d={STRIPE_D} fill={PAPER.sage} />}
      <g transform={fitTransform(markFit(simple))}>
        <path d={ARC_D} fill="none" stroke={PAPER.moss} strokeWidth={ARC.width} strokeLinecap="round" />
        <circle cx={CORE.cx} cy={CORE.cy} r={CORE.r} fill={PAPER.clay} />
      </g>
    </svg>
  );
}
