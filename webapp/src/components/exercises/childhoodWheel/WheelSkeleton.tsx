import { Skeleton } from '../../Skeleton';

/** Силуэт колеса, пока не пришли сохранённые оценки: пять строк по форме результата и шага оценки
 *  (знак потребности, название и строка текста, число справа) и плашка кнопки. Место под сцену —
 *  в листе-герое (chw-scene--skel), не здесь. */
export function WheelSkeleton() {
  return (
    <div className="chw-skeleton" aria-busy="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="chw-skel-row">
          <Skeleton width={44} height={24} radius={8} />
          <span className="chw-skel-lines">
            <Skeleton width="42%" height={14} />
            <Skeleton width="86%" height={12} />
          </span>
          <Skeleton width={40} height={26} />
        </div>
      ))}
      <Skeleton width={180} height={44} radius={22} />
    </div>
  );
}
