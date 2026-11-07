// Силуэт холста карты режимов на время загрузки (ModeMapSelector): плашка
// тулбара в левом верхнем углу, где в ModeMapCanvas стоит Panel top-left, и
// три плашки-узла вразброс — правило «загрузка — скелетон по форме контента»,
// а не текст «Загрузка…» (.claude/rules/frontend.md). Плашки — общий Skeleton
// (.skel), раскладка — .mm2-skel* в styles/sheet-modemap.css.
import { Skeleton } from '../Skeleton';

/** Узлы-силуэты: положение в процентах холста и ширина плашки. */
const NODES: { left: string; top: string; width: number }[] = [
  { left: '10%', top: '28%', width: 150 },
  { left: '48%', top: '44%', width: 170 },
  { left: '20%', top: '66%', width: 150 },
];

export function ModeMapSkeleton() {
  return (
    <div className="mm2-skel" data-testid="mm-skeleton" aria-hidden>
      <div className="mm2-skel-bar">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} width={36} height={36} radius={10} />)}
      </div>
      {NODES.map((n) => (
        <Skeleton key={n.left + n.top} width={n.width} height={56} radius={14} style={{ position: 'absolute', left: n.left, top: n.top }} />
      ))}
    </div>
  );
}
